"""Live merchant smoke test. Use a disposable portal with an admin login."""
import os
from playwright.sync_api import sync_playwright, expect

base = os.environ["UNITY_TEST_URL"]
with sync_playwright() as runner:
    browser = runner.chromium.launch(channel="chrome")
    context = browser.new_context(permissions=["clipboard-read", "clipboard-write"])
    p = context.new_page()
    p.goto(base+"/login")
    p.locator("[name=email]").fill(os.environ["ADMIN_EMAIL"])
    p.locator("[name=password]").fill(os.environ["ADMIN_PASSWORD"])
    p.get_by_role("button", name="Sign in").click()
    p.wait_for_url("**/admin**")
    p.goto(base+"/admin/stores/new")
    p.locator("[name=name]").fill("Daraz QA")
    p.locator("[name=website]").fill("https://www.daraz.pk/")
    p.get_by_role("button",name="Save").click()
    p.wait_for_url("**/admin/stores")
    p.goto(base+"/admin/affliate-tool")
    p.locator("select").select_option(label="Daraz QA")
    expect(p.locator("input[type=url]")).to_have_value("https://www.daraz.pk/")
    p.get_by_role("button",name="Analyze website").click()
    copy=p.get_by_role("button",name="Copy offer")
    expect(copy.first).to_be_visible(timeout=165000)
    assert copy.count()>1
    copy.first.click()
    assert p.evaluate("navigator.clipboard.readText()").strip()
    p.get_by_text("Select all unpublished offers").click()
    p.get_by_role("button",name="Publish selected",exact=False).click()
    expect(p.get_by_text("new offers published",exact=False)).to_be_visible()
    print(f"Live Daraz scan returned {copy.count()} offers. Clipboard and publication passed.",flush=True)
    p.get_by_role("button",name="Store assistant").click()
    p.get_by_role("button",name="How do I verify a coupon?").click()
    expect(p.locator(".ua-message.assistant")).to_contain_text("cart",ignore_case=True)
    p.goto(base+"/daraz-qa/view/vouchers")
    assert p.locator("body").inner_text().count("Daraz")>0
    print("Catalog assistant and public voucher page passed.")

