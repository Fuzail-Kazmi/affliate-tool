import hmac
import json
import os
import re
import secrets
import sqlite3
import time
from datetime import date, datetime, timedelta
from pathlib import Path

import urllib3
from flask import (
    Flask,
    abort,
    current_app,
    g,
    jsonify,
    render_template,
    request,
    session,
)
from werkzeug.security import check_password_hash, generate_password_hash

from .database import (
    DEFAULTS,
    PERMISSIONS,
    ROLES,
    db,
    initialize,
    one,
    public_person,
    record,
    report,
    rows,
)
from .discovery import analyze, website


def fail(message, status=400):
    abort(status, description=message)


def field(data, key, limit=200, required=True):
    value = data.get(key, "")
    if (
        not isinstance(value, str)
        or len(value) > limit
        or (required and not value.strip())
    ):
        fail(f"Enter a valid {key} (up to {limit} characters).")
    return value.strip()


def positive_id(value):
    if type(value) is not int or value <= 0:
        fail("Choose a valid record.")
    return value


def can(permission):
    return permission in g.actor["permissions"]


def require(*permissions):
    if not all(can(p) for p in permissions):
        fail("Your account does not have permission for this action.", 403)


def store_by_id(store_id):
    item = one("SELECT * FROM stores WHERE id=? AND archived=0", (store_id,))
    if not item:
        fail("This store is unavailable.", 404)
    item["offers"] = json.loads(item["offers"])
    return item


def access_store(store_id, writing=False):
    require("stores.read")
    item = store_by_id(store_id)
    scoped = g.actor["role"] != "Admin" and not can("assign.write")
    if scoped and (
        (writing or not can("team.read")) and item["person"] != g.actor["id"]
    ):
        fail("This store is outside your assignment.", 403)
    return item


def unchanged(data, item):
    if data.get("version") != item["version"]:
        fail("This store changed. Reopen it to use the latest version.", 409)


def stop_timer(where, value):
    assert where in ("store", "person")
    db().execute(
        f"UPDATE work SET end=? WHERE {where}=? AND end IS NULL",
        (int(time.time()), value),
    )


def assignee(value):
    if value is None:
        return None
    if not one("SELECT id FROM people WHERE id=? AND active=1", (positive_id(value),)):
        fail("Choose an active employee.")
    return value


def validate_assignment(item, person, url):
    if person and one(
        "SELECT id FROM completions WHERE person=? AND (store=? OR (url<>'' AND url=?))",
        (person, item.get("id", 0), url),
    ):
        fail(
            "This employee has already completed this store. Choose another employee.",
            409,
        )


def validate_sheet(value):
    if value is not None and not one(
        "SELECT id FROM sheets WHERE id=?", (positive_id(value),)
    ):
        fail("Choose an existing sheet.")
    return value


def current_day():
    try:
        return date.fromisoformat(request.args.get("day", date.today().isoformat()))
    except ValueError:
        fail("Choose a valid report date.")


def add_person(data, first=False):
    name, email = field(data, "name", 80), field(data, "email", 200).lower()
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        fail("Enter a valid email address.")
    password = data.get("password")
    if not isinstance(password, str) or not 10 <= len(password) <= 256:
        fail("Use a password between 10 and 256 characters.")
    role = "Admin" if first else data.get("role")
    if role not in ROLES:
        fail("Choose a valid role.")
    person = (
        db()
        .execute(
            "INSERT INTO people(name,email,password,role,permissions) VALUES(?,?,?,?,?)",
            (
                name,
                email,
                generate_password_hash(password),
                role,
                json.dumps(DEFAULTS[role]),
            ),
        )
        .lastrowid
    )
    return public_person(one("SELECT * FROM people WHERE id=?", (person,)))


def create_app(database=None):
    app = Flask(__name__)
    local = Path(__file__).resolve().parents[1] / ".local"
    local.mkdir(exist_ok=True)
    keyfile = local / "session.key"
    if not keyfile.exists():
        try:
            with keyfile.open("xb") as f:
                f.write(secrets.token_bytes(48))
        except FileExistsError:
            pass
    app.config.update(
        SECRET_KEY=keyfile.read_bytes(),
        DATABASE=database or str(local / "fieldwork.sqlite"),
        TRUSTED_HOSTS=["localhost", "127.0.0.1", "[::1]"],
        MAX_CONTENT_LENGTH=256 * 1024,
        SESSION_COOKIE_SAMESITE="Strict",
        SESSION_COOKIE_HTTPONLY=True,
        PERMANENT_SESSION_LIFETIME=timedelta(hours=12),
    )
    with app.app_context():
        initialize()
        db().close()

    @app.teardown_appcontext
    def close(error):
        if "db" in g:
            g.db.close()

    @app.before_request
    def authenticate():
        if not request.path.startswith("/api/"):
            return
        if request.method == "POST":
            if not request.is_json:
                fail("Send JSON data.", 415)
            origin = request.headers.get("Origin")
            if origin and origin != request.host_url.rstrip("/"):
                fail("Request origin is invalid.", 403)
            if not isinstance(request.get_json(), dict):
                fail("Send a JSON object.")
            if request.path != "/api/analyze":
                db().execute("BEGIN IMMEDIATE")
        person = one(
            "SELECT * FROM people WHERE id=? AND active=1", (session.get("person"),)
        )
        version = one(
            "SELECT version FROM credentials_version WHERE person=?",
            (session.get("person"),),
        )
        valid = session.get("credentials_version") == (
            version["version"] if version else 0
        )
        g.actor = public_person(person) if person and valid else None
        if request.path in ("/api/session", "/api/login", "/api/setup"):
            return
        if not g.actor:
            fail("Sign in to open your workspace.", 401)
        if request.method == "POST" and not hmac.compare_digest(
            request.headers.get("X-CSRF-Token", ""), session.get("csrf", "")
        ):
            fail("Refresh the page to renew your session.", 403)

    @app.after_request
    def finish(response):
        if request.path.startswith("/api/"):
            if "db" in g:
                (db().commit if response.status_code < 400 else db().rollback)()
            response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
        )
        response.headers["Referrer-Policy"] = "no-referrer"
        return response

    @app.errorhandler(sqlite3.IntegrityError)
    def conflict(error):
        return jsonify(error="That email or store URL is already in use."), 409

    @app.errorhandler(ValueError)
    def invalid(error):
        return jsonify(error=str(error)), 400

    from werkzeug.exceptions import HTTPException

    @app.errorhandler(HTTPException)
    def http_error(error):
        return jsonify(error=error.description), error.code

    @app.get("/")
    def index():
        return render_template("index.html")

    @app.get("/api/session")
    def who():
        return jsonify(
            person=g.actor,
            csrf=session.get("csrf"),
            setup=one("SELECT id FROM people LIMIT 1") is None,
        )

    def sign_in(person):
        session.clear()
        session.permanent = True
        session.update(person=person["id"], csrf=secrets.token_urlsafe(32))
        version = one(
            "SELECT version FROM credentials_version WHERE person=?", (person["id"],)
        )
        session["credentials_version"] = version["version"] if version else 0
        record(person, "Signed in", "Workspace")
        return jsonify(person=person, csrf=session["csrf"])

    @app.post("/api/setup")
    def setup():
        if one("SELECT id FROM people LIMIT 1"):
            fail("The workspace is already configured.", 409)
        data = request.get_json()
        person = add_person(data, first=True)
        record(person, "Created workspace", "Fieldwork", after=person)
        if data.get("sample") is True:
            from .sample import populate

            populate(person)
        return sign_in(person)

    @app.post("/api/login")
    def login():
        data = request.get_json()
        key = (request.remote_addr or "") + "|" + field(data, "email").lower()
        now = int(time.time())
        db().execute("DELETE FROM login_attempts WHERE since<?", (now - 600,))
        attempts = one("SELECT * FROM login_attempts WHERE key=?", (key,))
        if attempts and attempts["count"] >= 8:
            fail("Too many attempts. Try again in ten minutes.", 429)
        person = one(
            "SELECT * FROM people WHERE email=? AND active=1", (data["email"].strip(),)
        )
        password = data.get("password")
        if (
            not person
            or not isinstance(password, str)
            or len(password) > 256
            or not check_password_hash(person["password"], password)
        ):
            db().execute(
                "INSERT INTO login_attempts VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET count=count+1",
                (key, now),
            )
            db().commit()
            fail("The email or password is incorrect.", 401)
        db().execute("DELETE FROM login_attempts WHERE key=?", (key,))
        return sign_in(public_person(person))

    @app.post("/api/logout")
    def logout():
        stop_timer("person", g.actor["id"])
        record(g.actor, "Signed out", "Workspace")
        session.clear()
        return jsonify(ok=True)

    @app.get("/api/workspace")
    def workspace():
        team = can("team.read") or can("assign.write") or g.actor["role"] == "Admin"
        people = rows(
            "SELECT id,name,role,active FROM people" + ("" if team else " WHERE id=?"),
            () if team else (g.actor["id"],),
        )
        stores = (
            rows(
                "SELECT * FROM stores WHERE archived=0"
                + ("" if team else " AND person=?")
                + " ORDER BY id DESC",
                () if team else (g.actor["id"],),
            )
            if can("stores.read")
            else []
        )
        for store in stores:
            store["offers"] = json.loads(store["offers"])
        sheets = (
            rows(
                "SELECT * FROM sheets"
                + (
                    ""
                    if team
                    else " WHERE person=? OR id IN (SELECT sheet FROM stores WHERE person=? AND archived=0)"
                ),
                () if team else (g.actor["id"], g.actor["id"]),
            )
            if can("sheets.read") or can("assign.write")
            else []
        )
        timers = rows(
            "SELECT person,store,start FROM work WHERE end IS NULL"
            + ("" if team else " AND person=?"),
            () if team else (g.actor["id"],),
        )
        activity = rows(
            "SELECT name,role,action,target,at FROM activity"
            + ("" if can("audit.read") else " WHERE actor=?")
            + " ORDER BY at DESC,id DESC LIMIT 6",
            () if can("audit.read") else (g.actor["id"],),
        )
        week = []
        for offset in reversed(range(7)):
            day = date.today() - timedelta(days=offset)
            start = int(datetime.combine(day, datetime.min.time()).timestamp())
            stop = int(
                datetime.combine(
                    day + timedelta(days=1), datetime.min.time()
                ).timestamp()
            )
            counts = rows(
                "SELECT kind,COUNT(*) AS count FROM (SELECT DISTINCT store,person,kind FROM store_performance WHERE at>=? AND at<?"
                + ("" if team else " AND person=?")
                + ") GROUP BY kind",
                (start, stop) if team else (start, stop, g.actor["id"]),
            )
            week.append({"date": str(day), **{c["kind"]: c["count"] for c in counts}})
        performance = report(date.today(), people)
        if not can("reports.read"):
            performance.pop("stores")
        return jsonify(
            me=g.actor,
            people=people,
            stores=stores,
            sheets=sheets,
            timers=timers,
            activity=activity,
            week=week,
            today=str(date.today()),
            performance=performance,
        )

    @app.get("/api/reports")
    def reports():
        require("reports.read")
        day = current_day()
        result = report(day, rows("SELECT id,name FROM people"))
        start = int(datetime.combine(day, datetime.min.time()).timestamp())
        stop = int(
            datetime.combine(day + timedelta(days=1), datetime.min.time()).timestamp()
        )
        result["activity"] = rows(
            "SELECT name,role,action,target,at FROM activity WHERE at>=? AND at<? ORDER BY at DESC,id DESC",
            (start, stop),
        )
        return jsonify(result)

    @app.get("/api/audit")
    def audit():
        require("audit.read")
        before = request.args.get("before", 2**62, type=int)
        return jsonify(
            rows(
                "SELECT * FROM activity WHERE id<? ORDER BY id DESC LIMIT 100",
                (before,),
            )
        )

    @app.get("/api/people")
    def employees():
        if g.actor["role"] != "Admin":
            fail("Administrator access is required.", 403)
        return jsonify(
            people=[public_person(p) for p in rows("SELECT * FROM people")],
            permissions=PERMISSIONS,
            defaults=DEFAULTS,
        )

    @app.post("/api/people")
    def manage_employee():
        if g.actor["role"] != "Admin":
            fail("Administrator access is required.", 403)
        data = request.get_json()
        if not data.get("id"):
            person = add_person(data)
            record(g.actor, "Added employee", person["name"], after=person)
        else:
            person = one("SELECT * FROM people WHERE id=?", (positive_id(data["id"]),))
            if not person:
                fail("Employee unavailable.", 404)
            previous = public_person(person)
            role, grants = data.get("role"), data.get("permissions")
            if (
                role not in ROLES
                or not isinstance(grants, list)
                or not all(isinstance(p, str) and p in PERMISSIONS for p in grants)
            ):
                fail("Choose a valid role and permissions.")
            active = int(data.get("active") is True)
            if person["id"] == g.actor["id"] and (not active or role != "Admin"):
                fail("Keep your current administrator account active.")
            db().execute(
                "UPDATE people SET role=?,permissions=?,active=? WHERE id=?",
                (role, json.dumps(sorted(set(grants))), active, person["id"]),
            )
            if data.get("password"):
                password = data["password"]
                if not isinstance(password, str) or not 10 <= len(password) <= 256:
                    fail("Use a password between 10 and 256 characters.")
                db().execute(
                    "UPDATE people SET password=? WHERE id=?",
                    (generate_password_hash(password), person["id"]),
                )
                record(g.actor, "Reset password", person["name"])
            if data.get("password") or not active:
                db().execute(
                    "INSERT INTO credentials_version VALUES(?,1) ON CONFLICT(person) DO UPDATE SET version=version+1",
                    (person["id"],),
                )
                if person["id"] == g.actor["id"]:
                    session["credentials_version"] = one(
                        "SELECT version FROM credentials_version WHERE person=?",
                        (person["id"],),
                    )["version"]
            stop_timer("person", person["id"])
            person = public_person(
                one("SELECT * FROM people WHERE id=?", (person["id"],))
            )
            record(g.actor, "Updated employee access", person["name"], previous, person)
        return jsonify(person)

    @app.post("/api/sheets")
    def sheets():
        require("assign.write")
        data = request.get_json()
        name, url, person = (
            field(data, "name"),
            website(field(data, "url", 2000)),
            assignee(data.get("person")),
        )
        old = None
        if data.get("id"):
            old = one("SELECT * FROM sheets WHERE id=?", (positive_id(data["id"]),))
            if not old:
                fail("Sheet unavailable.", 404)
            sid = old["id"]
            db().execute(
                "UPDATE sheets SET name=?,url=?,person=? WHERE id=?",
                (name, url, person, sid),
            )
        else:
            sid = (
                db()
                .execute(
                    "INSERT INTO sheets(name,url,person) VALUES(?,?,?)",
                    (name, url, person),
                )
                .lastrowid
            )
        record(
            g.actor,
            "Updated sheet" if old else "Added sheet",
            name,
            old,
            one("SELECT * FROM sheets WHERE id=?", (sid,)),
        )
        return jsonify(ok=True)

    @app.post("/api/stores")
    def create_store():
        require("stores.read", "stores.add")
        data = request.get_json()
        name, category = field(data, "name", 100), field(data, "category", 80, False)
        url = field(data, "url", 2000, False)
        if url:
            require("links.add")
            url = website(url)
        person = (
            g.actor["id"] if not can("assign.write") else assignee(data.get("person"))
        )
        if not can("assign.write") and (
            data.get("sheet") or data.get("person") not in (None, person)
        ):
            fail("Assignment permission is required.", 403)
        sheet = validate_sheet(data.get("sheet"))
        validate_assignment({}, person, url)
        sid = (
            db()
            .execute(
                "INSERT INTO stores(name,category,url,person,sheet) VALUES(?,?,?,?,?)",
                (name, category, url, person, sheet),
            )
            .lastrowid
        )
        db().execute(
            "INSERT INTO store_changes(store,person,kind,at) VALUES(?,?,'Add',?)",
            (sid, g.actor["id"], int(time.time())),
        )
        record(g.actor, "Created store", name, after=store_by_id(sid))
        return jsonify(id=sid)

    @app.post("/api/stores/<int:sid>/<action>")
    def mutate_store(sid, action):
        item = access_store(sid, writing=True)
        data = request.get_json()
        unchanged(data, item)
        if action == "assign":
            require("assign.write")
            person, sheet = (
                assignee(data.get("person")),
                validate_sheet(data.get("sheet")),
            )
            validate_assignment(item, person, item["url"])
            kind = data.get("kind", "Add")
            if kind not in ("Add", "Update"):
                fail("Choose a valid task type.")
            stop_timer("store", sid)
            db().execute(
                "UPDATE stores SET person=?,sheet=?,kind=?,status='Pending' WHERE id=?",
                (person, sheet, kind, sid),
            )
            label = "Assigned store"
        elif action == "delete":
            require("stores.delete")
            if item["url"]:
                require("links.delete")
            stop_timer("store", sid)
            db().execute("UPDATE stores SET archived=1 WHERE id=?", (sid,))
            record(g.actor, "Deleted store", item["name"], item, None)
            return jsonify(ok=True)
        elif action in ("start", "pause", "complete"):
            require("work.write")
            if item["person"] != g.actor["id"]:
                fail("This action requires a task assigned to you.", 409)
            if item["status"] == "Done" and (
                action == "complete" or not can("stores.update")
            ):
                fail("This assignment is already complete.", 409)
            timer = one(
                "SELECT * FROM work WHERE person=? AND end IS NULL", (g.actor["id"],)
            )
            if action == "start":
                if timer:
                    fail("Pause your current task before starting another.", 409)
                db().execute(
                    "INSERT INTO work(person,store,start) VALUES(?,?,?)",
                    (g.actor["id"], sid, int(time.time())),
                )
                label = "Started task"
            else:
                if not timer or timer["store"] != sid:
                    fail("Start this store's timer first.", 409)
                stop_timer("store", sid)
                label = "Paused task"
                if action == "complete":
                    validate_assignment(item, g.actor["id"], item["url"])
                    if "offers" in data:
                        save_offers(sid, data)
                    notes = (
                        field(data, "notes", 4000, False)
                        if "notes" in data
                        else item["notes"]
                    )
                    db().execute(
                        "UPDATE stores SET status='Done',notes=? WHERE id=?",
                        (notes, sid),
                    )
                    db().execute(
                        "INSERT INTO completions(store,person,url,kind,at) VALUES(?,?,?,?,?)",
                        (
                            sid,
                            g.actor["id"],
                            item["url"],
                            item["kind"],
                            int(time.time()),
                        ),
                    )
                    label = "Completed store"
        elif action == "edit":
            name = field(data, "name", 100) if "name" in data else item["name"]
            category = (
                field(data, "category", 80, False)
                if "category" in data
                else item["category"]
            )
            notes = (
                field(data, "notes", 4000, False) if "notes" in data else item["notes"]
            )
            if (name, category, notes) != (
                item["name"],
                item["category"],
                item["notes"],
            ):
                require("stores.update")
            url = field(data, "url", 2000, False) if "url" in data else item["url"]
            if url:
                url = website(url)
            if url != item["url"]:
                require(
                    "links.delete"
                    if not url
                    else "links.update"
                    if item["url"]
                    else "links.add"
                )
                if item["status"] != "Done":
                    validate_assignment(item, item["person"], url)
            if "offers" in data:
                save_offers(sid, data)
            if not any(
                can(p)
                for p in (
                    "stores.update",
                    "links.add",
                    "links.update",
                    "links.delete",
                    "offers.write",
                )
            ):
                fail("Store editing permission is required.", 403)
            db().execute(
                "UPDATE stores SET name=?,category=?,notes=?,url=? WHERE id=?",
                (name, category, notes, url, sid),
            )
            label = "Updated store"
            if store_by_id(sid) != item:
                db().execute(
                    "INSERT INTO store_changes(store,person,kind,at) VALUES(?,?,'Update',?)",
                    (sid, g.actor["id"], int(time.time())),
                )
                if item["status"] == "Done" and item["person"] == g.actor["id"]:
                    stop_timer("store", sid)
        else:
            fail("Unknown store action.", 404)
        db().execute("UPDATE stores SET version=version+1 WHERE id=?", (sid,))
        record(g.actor, label, item["name"], item, store_by_id(sid))
        return jsonify(ok=True)

    @app.post("/api/analyze")
    def discovery():
        require("offers.write")
        data = request.get_json()
        item = access_store(positive_id(data.get("id")), writing=True)
        url = website(field(data, "url", 2000))
        if url != item["url"] and not can("links.update"):
            fail("Use the website assigned to this store.", 403)
        try:
            result = analyze(url)
        except (OSError, urllib3.exceptions.HTTPError):
            fail(
                "The website could not be reached. Check the address and try again.",
                422,
            )
        for offer in result["offers"]:
            offer["receipt"] = offer_receipt(item["id"], offer)
        record(
            g.actor,
            "Analyzed website",
            item["name"],
            after={"url": url, "offers": len(result["offers"])},
        )
        return jsonify(result)

    return app


def offer_receipt(sid, offer):
    payload = {k: v for k, v in offer.items() if k != "receipt"}
    encoded = json.dumps([sid, payload], sort_keys=True, ensure_ascii=False).encode()
    return hmac.digest(current_app.secret_key, encoded, "sha256").hex()


def save_offers(sid, data):
    require("offers.write")
    offers = data["offers"]
    if not isinstance(offers, list) or len(offers) > 100:
        fail("Save up to 100 offers per store.")
    sanitized = []
    for offer in offers:
        if not isinstance(offer, dict):
            fail("Invalid offer.")
        title = field(offer, "title", 600)
        if offer.get("verification") == "Employee entered":
            sanitized.append(
                {
                    "title": title,
                    "code": field(offer, "code", 80, False),
                    "source": store_by_id(sid)["url"],
                    "verification": "Employee entered",
                    "trials": [],
                }
            )
            continue
        if offer.get("source"):
            website(field(offer, "source", 2000))
        if not isinstance(offer.get("trials", []), list):
            fail("Invalid coupon trials.")
        receipt = offer.get("receipt")
        if not isinstance(receipt, str) or not hmac.compare_digest(
            offer_receipt(sid, offer), receipt
        ):
            fail("The discovery result has changed. Analyze the website again.")
        sanitized.append(offer)
    db().execute(
        "UPDATE stores SET offers=? WHERE id=?",
        (json.dumps(sanitized, ensure_ascii=False), sid),
    )


if __name__ == "__main__":
    create_app().run(
        host="127.0.0.1", port=int(os.getenv("PORT", "5080")), threaded=True
    )
