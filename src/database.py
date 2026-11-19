import json
import sqlite3
import time
from datetime import datetime, timedelta

from flask import current_app, g

ROLES = ("Admin", "Store Adder", "Store Updater")
PERMISSIONS = {
    "stores.read": "View stores",
    "stores.add": "Create stores",
    "stores.update": "Update store information",
    "stores.delete": "Delete stores",
    "work.write": "Work on assigned stores",
    "links.add": "Add website links",
    "links.update": "Replace website links",
    "links.delete": "Remove website links",
    "offers.write": "Discover and save offers",
    "team.read": "View team workload",
    "sheets.read": "View assigned sheets",
    "assign.write": "Assign stores and sheets",
    "reports.read": "Read daily reports",
    "audit.read": "Read the full activity log",
}
DEFAULTS = {
    "Admin": list(PERMISSIONS),
    "Store Adder": ["stores.read", "sheets.read", "work.write", "offers.write"],
    "Store Updater": [
        "stores.read",
        "sheets.read",
        "stores.update",
        "work.write",
        "offers.write",
        "team.read",
    ],
}


def db():
    if "db" not in g:
        g.db = sqlite3.connect(current_app.config["DATABASE"], timeout=10)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys=ON")
    return g.db


def rows(sql, args=()):
    return [dict(row) for row in db().execute(sql, args)]


def one(sql, args=()):
    return next(iter(rows(sql, args)), None)


def initialize():
    db().executescript("""
        PRAGMA journal_mode=WAL;
        CREATE TABLE IF NOT EXISTS people(
            id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE COLLATE NOCASE NOT NULL,
            password TEXT NOT NULL, role TEXT NOT NULL, permissions TEXT NOT NULL, active INTEGER DEFAULT 1);
        CREATE TABLE IF NOT EXISTS sheets(
            id INTEGER PRIMARY KEY, name TEXT NOT NULL, url TEXT NOT NULL, person INTEGER REFERENCES people);
        CREATE TABLE IF NOT EXISTS stores(
            id INTEGER PRIMARY KEY, name TEXT NOT NULL, url TEXT NOT NULL DEFAULT '', category TEXT NOT NULL,
            notes TEXT NOT NULL DEFAULT '', offers TEXT NOT NULL DEFAULT '[]', person INTEGER REFERENCES people,
            sheet INTEGER REFERENCES sheets, status TEXT NOT NULL DEFAULT 'Pending', kind TEXT NOT NULL DEFAULT 'Add',
            version INTEGER NOT NULL DEFAULT 1, archived INTEGER DEFAULT 0);
        CREATE UNIQUE INDEX IF NOT EXISTS store_url ON stores(url) WHERE url <> '' AND archived=0;
        CREATE TABLE IF NOT EXISTS work(
            id INTEGER PRIMARY KEY, store INTEGER NOT NULL REFERENCES stores, person INTEGER NOT NULL REFERENCES people,
            start INTEGER NOT NULL, end INTEGER);
        CREATE UNIQUE INDEX IF NOT EXISTS one_timer ON work(person) WHERE end IS NULL;
        CREATE TABLE IF NOT EXISTS completions(
            id INTEGER PRIMARY KEY, store INTEGER NOT NULL REFERENCES stores, person INTEGER NOT NULL REFERENCES people,
            url TEXT NOT NULL, kind TEXT NOT NULL, at INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS store_changes(
            id INTEGER PRIMARY KEY, store INTEGER NOT NULL REFERENCES stores, person INTEGER NOT NULL REFERENCES people,
            kind TEXT NOT NULL, at INTEGER NOT NULL);
        CREATE VIEW IF NOT EXISTS store_performance AS
            SELECT store,person,kind,at FROM completions UNION ALL SELECT store,person,kind,at FROM store_changes;
        CREATE TABLE IF NOT EXISTS credentials_version(person INTEGER PRIMARY KEY REFERENCES people, version INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS activity(
            id INTEGER PRIMARY KEY, actor INTEGER NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL,
            action TEXT NOT NULL, target TEXT NOT NULL, at INTEGER NOT NULL, previous TEXT, updated TEXT);
        CREATE TABLE IF NOT EXISTS login_attempts(key TEXT PRIMARY KEY, since INTEGER NOT NULL, count INTEGER NOT NULL);
    """)


def record(actor, action, target, before=None, after=None, at=None):
    db().execute(
        "INSERT INTO activity(actor,name,role,action,target,at,previous,updated) VALUES(?,?,?,?,?,?,?,?)",
        (
            actor["id"],
            actor["name"],
            actor["role"],
            action,
            target,
            at or int(time.time()),
            json.dumps(before, ensure_ascii=False),
            json.dumps(after, ensure_ascii=False),
        ),
    )


def public_person(person):
    return {key: person[key] for key in ("id", "name", "email", "role", "active")} | {
        "permissions": list(PERMISSIONS)
        if person["role"] == "Admin"
        else json.loads(person["permissions"])
    }


def report(day, people):
    start = int(datetime.combine(day, datetime.min.time()).timestamp())
    stop = int(
        datetime.combine(day + timedelta(days=1), datetime.min.time()).timestamp()
    )
    summary = {
        p["id"]: {
            "person": p["id"],
            "name": p["name"],
            "added": 0,
            "updated": 0,
            "seconds": 0,
        }
        for p in people
    }
    details = {}

    def entry(person, store, name):
        return details.setdefault(
            (person, store),
            {
                "person": person,
                "store": store,
                "name": name,
                "added": 0,
                "updated": 0,
                "seconds": 0,
            },
        )

    for item in rows(
        """SELECT DISTINCT c.store,c.person,c.kind,s.name FROM store_performance c JOIN stores s ON s.id=c.store
                       WHERE at>=? AND at<?""",
        (start, stop),
    ):
        if item["person"] in summary:
            field = "added" if item["kind"] == "Add" else "updated"
            summary[item["person"]][field] += 1
            entry(item["person"], item["store"], item["name"])[field] += 1
    now = int(time.time())
    for item in rows(
        """SELECT w.*,s.name FROM work w JOIN stores s ON s.id=w.store
                        WHERE start<? AND COALESCE(end,?)>?""",
        (stop, now, start),
    ):
        if item["person"] in summary:
            seconds = max(0, min(item["end"] or now, stop) - max(item["start"], start))
            summary[item["person"]]["seconds"] += seconds
            entry(item["person"], item["store"], item["name"])["seconds"] += seconds
    return {
        "people": list(summary.values()),
        "stores": list(details.values()),
        "day": str(day),
    }
