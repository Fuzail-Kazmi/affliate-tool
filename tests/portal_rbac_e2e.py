"""Run against a disposable, empty local portal with Playwright and Chrome."""
import base64
import json
import os
import secrets

from playwright.sync_api import sync_playwright, expect

base = os.environ["UNITY_TEST_URL"]
password = secrets.token_urlsafe(18)
with sync_playwright() as runner:
    browser = runner.chromium.launch(channel="chrome")
    def session(email):
        context = browser.new_context()
        page = context.new_page()
        page.goto(base + "/login")
        page.locator("[name=email]").fill(email)
        page.locator("[name=password]").fill(password)
        page.locator("button[type=submit]").click()
        page.wait_for_url("**/admin**")
        cookie = next(c for c in context.cookies() if c["name"] == "session")
        claims = json.loads(base64.urlsafe_b64decode(cookie["value"].split(".")[1] + "==="))
        assert cookie["httpOnly"] and claims["userId"] and claims["exp"]
        return page
    admin = session("owner@example.test")
    for area in ("products","coupons"):
        admin.goto(base + "/admin/" + area + "/new")
        if area == "products":
            admin.locator("[name=name]").fill("QA display product")
            admin.locator("[name=price]").fill("15")
        else:
            admin.locator("[name=storeId]").select_option(label="Allbirds")
            admin.locator("[name=title]").fill("Get 10% off")
            admin.locator("[name=code]").fill("QA10")
        admin.get_by_role("button",name="Save",exact=True).click()
        admin.wait_for_url(base + "/admin/" + area)
    admin.goto(base + "/allbirds/view/vouchers")
    expect(admin.get_by_text("Get 10% off")).to_be_visible()

    for name, role in [("adder", "Store Adder"), ("updater", "Store Updater")]:
        admin.goto(base + "/admin/users/new")
        admin.locator("[name=email]").fill(name + "@example.test")
        admin.locator("[name=password]").fill(password)
        admin.locator("[name=role]").select_option(label=role)
        admin.get_by_role("button", name="Create User").click()
        admin.wait_for_url("**/admin/users")
    admin.goto(base + "/admin")
    admin.locator("[name=employee]").select_option(label="updater@example.test")
    admin.get_by_role("button", name="Assign task").click()
    expect(admin.get_by_text("Changes saved.")).to_be_visible()
    updater = session("updater@example.test")
    adder = session("adder@example.test")
    for employee in [adder, updater]:
        employee.goto(base + "/admin/users")
        expect(employee).to_have_url(base + "/admin")
        expect(employee.get_by_role("button", name="Store assistant")).to_have_count(0)
    expect(adder.get_by_text("No assignments yet.")).to_be_visible()
    updater.get_by_text("Edit store", exact=True).click()
    updater.locator("[name=website]").fill("https://example.test/")
    updater.get_by_role("button", name="Save", exact=True).click()
    expect(updater.get_by_text("Website permission required.")).to_be_visible()
    admin.goto(base + "/admin/users")
    card = admin.locator("section.work-card").filter(has_text="updater@example.test")
    card.get_by_text("Manage access").click()
    card.locator("[name=custom]").check()
    card.locator("[value='links.update']").check()
    card.get_by_role("button",name="Save access").click()
    expect(card.get_by_text("Changes saved.")).to_be_visible()
    updater.goto(base + "/admin")
    expect(updater).to_have_url(base + "/login")
    updater = session("updater@example.test")
    updater.goto(base + "/admin")
    updater.get_by_text("Edit store",exact=True).click()
    updater.locator("[name=website]").fill("https://www.allbirds.com/sale")
    updater.get_by_role("button",name="Save",exact=True).click()
    expect(updater.get_by_text("Changes saved.")).to_be_visible()
    admin.goto(base + "/admin")
    updater.get_by_role("button", name="Start task").click()
    updater.get_by_role("button", name="Pause timer").click()
    updater.get_by_role("button", name="Start task").click()
    updater.get_by_role("button", name="Save as done").click()
    expect(updater.get_by_text("updater@example.test · Add · Done")).to_be_visible()
    admin.reload()
    admin.locator("[name=employee]").select_option(label="updater@example.test")
    admin.get_by_role("button", name="Assign task").click()
    expect(admin.get_by_text("This store already has an open task", exact=False)).to_be_visible()
    admin.goto(base + "/admin/users")
    card = admin.locator("section.work-card").filter(has_text="updater@example.test")
    card.get_by_text("Manage access").click()
    card.locator("[name=active]").uncheck()
    card.get_by_role("button", name="Save access").click()
    expect(card.get_by_text("Changes saved.")).to_be_visible()
    updater.goto(base + "/admin")
    expect(updater).to_have_url(base + "/login")
    token = next(c for c in adder.context.cookies() if c["name"]=="session")["value"]
    parts = token.split(".")
    parts[2] = ("B" if parts[2][0]=="A" else "A") + parts[2][1:]
    adder.context.add_cookies([dict(name="session",value=".".join(parts),url=base)])
    adder.goto(base + "/admin")
    expect(adder).to_have_url(base + "/login")
    admin.set_viewport_size({"width":375,"height":812})
    for path in ["/admin","/admin/affliate-tool","/admin/users"]:
        admin.goto(base + path)
        assert admin.evaluate("document.documentElement.scrollWidth <= innerWidth"), path
    print("Passed JWT login, role isolation, link protection, task lifecycle, duplicate prevention, session revocation, tampering and mobile widths.")

