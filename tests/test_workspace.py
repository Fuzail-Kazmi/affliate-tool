import tempfile
import unittest
from datetime import date, datetime, timedelta
from pathlib import Path
from unittest.mock import patch

from src.app import create_app
from src.database import db, report


class WorkspaceTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.path = str(Path(temp.name) / "workspace.sqlite")
        self.app = create_app(self.path)
        self.admin = self.app.test_client()
        self.owner = self.admin.post(
            "/api/setup",
            json={
                "name": "Owner",
                "email": "admin@example.org",
                "password": "test-only-123",
            },
        ).json
        self.csrf = {"X-CSRF-Token": self.owner["csrf"]}

    def post(self, path, data, client=None, headers=None):
        return (client or self.admin).post(
            "/api/" + path, json=data, headers=self.csrf if headers is None else headers
        )

    def employee(self, role="Store Adder"):
        email = role.split()[-1] + "@example.org"
        response = self.post(
            "people",
            {"email": email, "name": role, "role": role, "password": "employee-pass"},
        )
        self.assertEqual(response.status_code, 200, response.json)
        client = self.app.test_client()
        login = client.post(
            "/api/login", json={"email": email, "password": "employee-pass"}
        )
        return response.json, client, {"X-CSRF-Token": login.json["csrf"]}

    def store(self, person=None, name="Example store", url="https://example.org"):
        result = self.post(
            "stores",
            {"name": name, "url": url, "category": "Apparel", "person": person},
        )
        self.assertEqual(result.status_code, 200, result.json)
        return result.json["id"]

    def test_setup_authentication_and_csrf(self):
        anon = self.app.test_client()
        self.assertEqual(anon.get("/api/workspace").status_code, 401)
        self.assertEqual(anon.post("/api/setup", json={}).status_code, 409)
        self.assertEqual(
            self.post("stores", {"name": "x"}, headers={}).status_code, 403
        )
        self.assertEqual(
            self.admin.post(
                "/api/logout",
                json={},
                headers={**self.csrf, "Origin": "https://example.org"},
            ).status_code,
            403,
        )

    def test_assigned_scope_and_protected_urls(self):
        p, client, headers = self.employee()
        s = self.store(p["id"])
        hidden = self.store(name="Private", url="https://private.example")
        self.assertEqual(
            [s["id"] for s in client.get("/api/workspace").json["stores"]], [s]
        )
        for operation, payload in [
            (f"stores/{s}/edit", {"url": "https://changed.example"}),
            (f"stores/{s}/delete", {}),
            (f"stores/{hidden}/start", {}),
            ("analyze", {"id": s, "url": "https://changed.example"}),
            ("people", {}),
            ("sheets", {"name": "Unauthorized"}),
        ]:
            self.assertEqual(
                self.post(
                    operation, {"version": 1, **payload}, client, headers
                ).status_code,
                403,
            )
        self.assertEqual(client.get("/api/reports").status_code, 403)
        self.assertEqual(client.get("/api/audit").status_code, 403)
        self.assertEqual(
            self.admin.get("/api/workspace").json["stores"][-1]["url"],
            "https://example.org/",
        )

    def test_updater_can_monitor_team_but_edits_only_assigned_details(self):
        p, client, headers = self.employee("Store Updater")
        sid = self.store(p["id"])
        other = self.store(url="https://unassigned.example")
        self.assertEqual(len(client.get("/api/workspace").json["stores"]), 2)
        self.assertEqual(
            self.post(
                f"stores/{sid}/edit",
                {"version": 1, "notes": "Reviewed"},
                client,
                headers,
            ).status_code,
            200,
        )
        self.assertEqual(
            self.post(
                f"stores/{other}/edit", {"version": 1, "notes": "x"}, client, headers
            ).status_code,
            403,
        )
        self.assertEqual(
            self.post(
                f"stores/{sid}/edit", {"version": 2, "url": ""}, client, headers
            ).status_code,
            403,
        )
        self.assertEqual(
            client.get("/api/workspace").json["performance"]["people"][-1]["updated"], 1
        )

    def test_grants_revocation_and_audit(self):
        p, client, headers = self.employee()
        sid = self.store(p["id"])
        grant = {
            **p,
            "active": True,
            "permissions": p["permissions"] + ["links.update"],
        }
        self.post("people", grant)
        self.assertEqual(
            self.post(
                f"stores/{sid}/edit",
                {"version": 1, "url": "https://new.example"},
                client,
                headers,
            ).status_code,
            200,
        )
        self.post("people", {**p, "active": True})
        self.assertEqual(
            self.post(
                f"stores/{sid}/edit",
                {"version": 2, "url": "https://again.example"},
                client,
                headers,
            ).status_code,
            403,
        )
        audit = self.admin.get("/api/audit").json
        event = next(a for a in audit if a["action"] == "Updated store")
        self.assertIn("https://new.example/", event["updated"])
        self.assertIn("https://example.org/", event["previous"])
        self.assertEqual(event["name"], p["name"])
        self.assertEqual(
            sum(a["action"] == "Updated employee access" for a in audit), 2
        )

    def test_work_completion_report_reassignment_and_stale_writes(self):
        p, client, headers = self.employee()
        sid = self.store(p["id"])
        sid2 = self.store(p["id"], url="https://another.example")
        cmd = lambda sid, action, version: self.post(
            f"stores/{sid}/{action}", {"version": version}, client, headers
        )
        self.assertEqual(cmd(sid, "start", 1).status_code, 200)
        self.assertEqual(cmd(sid2, "start", 1).status_code, 409)
        self.assertEqual(cmd(sid, "complete", 1).status_code, 409)
        self.assertEqual(cmd(sid, "pause", 2).status_code, 200)
        self.assertEqual(cmd(sid, "start", 3).status_code, 200)
        self.assertEqual(cmd(sid, "complete", 4).status_code, 200)
        self.assertEqual(cmd(sid, "complete", 5).status_code, 409)
        self.assertEqual(
            client.get("/api/workspace").json["stores"][-1]["status"], "Done"
        )
        self.assertEqual(
            self.post(
                f"stores/{sid}/assign", {"version": 5, "person": p["id"]}
            ).status_code,
            409,
        )
        totals = self.admin.get("/api/reports").json
        self.assertEqual(
            next(x for x in totals["people"] if x["person"] == p["id"])["added"], 1
        )
        self.assertIn(
            "seconds", next(x for x in totals["stores"] if x["person"] == p["id"])
        )

    def test_sheets_and_inactive_accounts(self):
        p, client, _ = self.employee()
        self.assertEqual(
            self.post(
                "sheets",
                {
                    "name": "Assignments",
                    "url": "https://example.org/s",
                    "person": p["id"],
                },
            ).status_code,
            200,
        )
        self.assertEqual(
            client.get("/api/workspace").json["sheets"][0]["name"], "Assignments"
        )
        self.post("people", {**p, "active": False})
        self.assertEqual(client.get("/api/workspace").status_code, 401)
        self.post("people", {**p, "active": True})
        self.assertEqual(client.get("/api/workspace").status_code, 401)

    def test_persistence_and_archived_history(self):
        sid = self.store()
        self.assertEqual(
            self.post(f"stores/{sid}/delete", {"version": 1}).status_code, 200
        )
        second = create_app(self.path).test_client()
        self.assertEqual(
            second.post(
                "/api/login",
                json={"email": "admin@example.org", "password": "test-only-123"},
            ).status_code,
            200,
        )
        self.assertEqual(second.get("/api/workspace").json["stores"], [])
        self.assertTrue(
            any(a["action"] == "Deleted store" for a in second.get("/api/audit").json)
        )

    def test_analysis_review_is_explicit_and_receipts_cannot_be_forged(self):
        p, client, headers = self.employee()
        sid = self.store(p["id"])
        mocked = {
            "offers": [
                {
                    "title": "Free shipping over $50",
                    "source": "https://example.org/",
                    "trials": [],
                    "verification": "Advertised",
                }
            ],
            "warnings": [],
            "engine": "Website evidence",
        }
        with patch("src.app.analyze", return_value=mocked):
            draft = self.post(
                "analyze", {"id": sid, "url": "https://example.org"}, client, headers
            ).json
        self.assertEqual(client.get("/api/workspace").json["stores"][0]["offers"], [])
        tampered = [{**draft["offers"][0], "verification": "Sitewide coupon (sampled)"}]
        self.assertEqual(
            self.post(
                f"stores/{sid}/edit",
                {"version": 1, "offers": tampered},
                client,
                headers,
            ).status_code,
            400,
        )
        self.post(f"stores/{sid}/start", {"version": 1}, client, headers)
        result = self.post(
            f"stores/{sid}/complete",
            {"version": 2, "offers": draft["offers"]},
            client,
            headers,
        )
        self.assertEqual(result.status_code, 200, result.json)
        saved = client.get("/api/workspace").json["stores"][0]
        self.assertEqual((saved["offers"], saved["status"]), (draft["offers"], "Done"))

    def test_midnight_time_is_split_between_daily_reports(self):
        sid = self.store()
        day = date.today() - timedelta(days=2)
        midnight = int(datetime.combine(day, datetime.min.time()).timestamp())
        uid = self.owner["person"]["id"]
        with self.app.app_context():
            db().execute(
                "INSERT INTO work(store,person,start,end) VALUES(?,?,?,?)",
                (sid, uid, midnight - 40, midnight + 25),
            )
            people = [{"id": uid, "name": "Owner"}]
            self.assertEqual(report(day, people)["people"][0]["seconds"], 25)
            self.assertEqual(
                report(day - timedelta(days=1), people)["people"][0]["seconds"], 40
            )

    def test_invalid_inputs_and_unique_urls_roll_back(self):
        self.store()
        self.assertEqual(
            self.post(
                "stores", {"name": "Duplicate", "url": "https://EXAMPLE.org/"}
            ).status_code,
            409,
        )
        self.assertEqual(
            self.post(
                "stores", {"name": "Bad", "url": "javascript:alert(1)"}
            ).status_code,
            400,
        )
        self.assertEqual(
            self.post(
                "stores", {"name": "", "url": "https://valid.example"}
            ).status_code,
            400,
        )
        self.assertEqual(len(self.admin.get("/api/workspace").json["stores"]), 1)

    def test_employee_authored_offers_do_not_inherit_cart_evidence(self):
        p, client, headers = self.employee("Store Updater")
        sid = self.store(p["id"])
        manual = {
            "title": "Free shipping on footwear",
            "code": "",
            "verification": "Employee entered",
            "trials": [{"result": "Applied"}],
            "source": "https://other.example/",
        }
        result = self.post(
            f"stores/{sid}/edit", {"version": 1, "offers": [manual]}, client, headers
        )
        self.assertEqual(result.status_code, 200)
        saved = client.get("/api/workspace").json["stores"][0]["offers"][0]
        self.assertEqual(
            (saved["trials"], saved["source"]), ([], "https://example.org/")
        )
