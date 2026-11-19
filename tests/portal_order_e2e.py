"""Run against a disposable portal seeded with an assigned store and two offers."""
import os
from playwright.sync_api import expect, sync_playwright

base = os.environ["UNITY_TEST_URL"]
with sync_playwright() as runner:
    browser = runner.chromium.launch(channel="chrome")
    visitor = browser.new_page()
    visitor.goto(base)
    expect(visitor.get_by_role("link",name="Edit offer order",exact=False)).to_have_count(0)
    employee = browser.new_page(viewport={"width":375,"height":812})
    employee.goto(base + "/login")
    employee.locator("[name=email]").fill(os.environ["ORDER_TEST_EMAIL"])
    employee.locator("[name=password]").fill(os.environ["ORDER_TEST_PASSWORD"])
    employee.get_by_role("button",name="Sign in").click()
    employee.wait_for_url("**/admin**")
    employee.goto(base)
    expect(employee.get_by_role("link",name="Edit offer order for Other")).to_have_count(0)
    employee.get_by_role("link",name="Edit offer order for Assigned").click()
    employee.get_by_role("button",name="Move Second up").click()
    employee.get_by_role("button",name="Save order").click()
    employee.wait_for_url(base+"/assigned/view/vouchers")
    visitor.goto(base+"/assigned/view/vouchers?edit=order")
    expect(visitor.get_by_text("Edit offer order",exact=True)).to_have_count(0)
    cards=visitor.locator(".stagger-grid")
    expect(cards).to_contain_text("Second")
    text=cards.inner_text()
    assert text.index("Second") < text.index("First")
    print("Passed employee pencil, mobile reordering, public persistence and role visibility.")
