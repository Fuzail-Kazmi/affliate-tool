"""Optional fictional records for an administrator exploring a new workspace."""

import json
from datetime import datetime, timedelta

from .database import DEFAULTS, db, record


def populate(admin):
    people = []
    for name, role in [
        ("Maya Chen", "Store Adder"),
        ("Oliver Reed", "Store Updater"),
        ("Nora Patel", "Store Adder"),
        ("Theo Brooks", "Store Updater"),
    ]:
        uid = (
            db()
            .execute(
                "INSERT INTO people(name,email,password,role,permissions) VALUES(?,?,?,?,?)",
                (
                    name,
                    name.lower().replace(" ", ".") + "@example.invalid",
                    "!",
                    role,
                    json.dumps(DEFAULTS[role]),
                ),
            )
            .lastrowid
        )
        people.append({"id": uid, "name": name, "role": role})
        record(admin, "Added sample employee", name)
    sheet = (
        db()
        .execute(
            "INSERT INTO sheets(name,url,person) VALUES(?,?,?)",
            ("Retail partners", "https://example.com/retail-sheet", people[0]["id"]),
        )
        .lastrowid
    )
    names = [
        ("Forma Living", "Home & living"),
        ("Northline", "Outdoors"),
        ("Studio Vale", "Apparel"),
        ("Common Ground", "Coffee"),
        ("Aster Beauty", "Beauty"),
        ("Arc Supply", "Accessories"),
        ("Juniper Home", "Home & living"),
        ("Peak Goods", "Sports"),
        ("Union Market", "Lifestyle"),
        ("Orbit Audio", "Electronics"),
        ("Field Notes", "Stationery"),
        ("Dune Studio", "Apparel"),
    ]
    now = datetime.now()
    for index, (name, category) in enumerate(names):
        actor = people[index % len(people)]
        done = index < 7
        kind = "Add" if actor["role"] == "Store Adder" else "Update"
        url = "https://" + name.lower().replace(" ", "") + ".example/"
        sid = (
            db()
            .execute(
                "INSERT INTO stores(name,url,category,person,sheet,status,kind) VALUES(?,?,?,?,?,?,?)",
                (
                    name,
                    url,
                    category,
                    actor["id"],
                    sheet,
                    "Done" if done else "Pending",
                    kind,
                ),
            )
            .lastrowid
        )
        at = int(
            (
                now
                - timedelta(days=(6 - index) if done else 0, minutes=8 * (12 - index))
            ).timestamp()
        )
        record(
            admin,
            "Assigned store",
            name,
            after={"person": actor["name"], "sample": True},
            at=at - 900,
        )
        if done:
            db().execute(
                "INSERT INTO completions(store,person,url,kind,at) VALUES(?,?,?,?,?)",
                (sid, actor["id"], url, kind, at),
            )
            db().execute(
                "INSERT INTO work(store,person,start,end) VALUES(?,?,?,?)",
                (sid, actor["id"], at - 390 - index * 41, at),
            )
            record(
                actor,
                "Completed store",
                name,
                after={"status": "Done", "sample": True},
                at=at,
            )
