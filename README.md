# UnityAffliate powered by UnityAlgo

The integrated portal uses the supplied storefront, its Next.js admin panel, PostgreSQL store and coupon records

```sh
python -m pip install -r requirements.txt
cd storefront
bun install --frozen-lockfile
bun run local
```

Open [Affliate Tool](http://127.0.0.1:5081/admin/affliate-tool). On first use, create the local administrator account. The optional Allbirds starter adds a merchant website for a first scan. You can add your own merchants under **Stores**.

Select a catalog store, enter its merchant URL and click **Analyze website**. Review each offer's source and coupon trials, use **Copy offer** to copy an individual offer, select the offers you want, then click **Publish selected**. Published offers appear in **Coupons** and the store's public voucher page. The latest analysis is retained per employee and store. A repeated save skips coupons already in the catalog.

The **Store assistant** in the lower-right corner of every admin page answers questions about store listings, current deals, coupon codes, expiring offers, and the review workflow. It uses the current catalog and the selected store where available. Administrators manage employees under Team & access. Store Adders work on their own assignments. Store Updaters can also view team progress and edit assigned store details. Website changes require an explicit link permission. Changing account access invalidates its existing JWT sessions. Storefront visitors can browse published offers.

Set `OPENAI_API_KEY` before starting the server to enable model-assisted offer formatting and question interpretation. Without a key, discovery uses merchant text and chat uses supported catalog lookups. Coupon testing uses guest carts on compatible Shopify storefronts. Set `PYTHON_BIN` if the server should use a specific Python interpreter.

The local launcher provisions a dedicated PostgreSQL instance on port 55438. It keeps data and generated secrets in `.local/unityaffliate/`. Configure `PORT`, `UNITY_DB_PORT`, and `UNITY_DATA_DIR` to run an independent instance. The original site's database is separate. For an externally managed PostgreSQL instance, set `DATABASE_URL`, `JWT_SECRET` (at least 32 random characters), and `NEXT_PUBLIC_BASE_URL`, then run `bun scripts/migrate.mjs` from `storefront/`. To provision an admin, supply `ADMIN_EMAIL` and `ADMIN_PASSWORD` and run `bun run seed:admin`. Run `bun run build` followed by `bun run start` behind HTTPS.

Run `bun test` in `storefront/` and `python -m unittest discover -s tests -v` in the repository root.

Task timers support start, pause and completion. Reports use Asia/Karachi dates. The activity log includes timestamps and before-and-after values. Existing administrative accounts retain their role during migration.

Browser tests use Python Playwright and Chrome. Run `tests/portal_rbac_e2e.py` with `UNITY_TEST_URL` pointing to an empty disposable local portal. It creates its own accounts and catalog records. Run `tests/portal_offers_e2e.py` against a disposable portal with an Allbirds starter store, supplying `UNITY_TEST_URL`, `ADMIN_EMAIL` and `ADMIN_PASSWORD`. This live test publishes Daraz offers in the test database.

## Standalone Fieldwork application

Fieldwork is a local affiliate operations panel for administrators, store adders, and store updaters. It stores team accounts, assignments, reviewed offers, time intervals, and audit history in SQLite.

## Run locally

Use Python 3.10 or newer. From the repository root, create and activate a virtual environment if desired, then run the following commands.

```sh
python -m pip install -r requirements.txt
python -m src.app
```

Open [the workspace](http://127.0.0.1:5080/). The first visitor creates the administrator account. The optional sample includes fictional employees and stores. To use a sample employee account, use **Team & access → Manage** to set its password. Sample website addresses are illustrative. Create a store with a real merchant URL to try discovery.

The local launcher binds to loopback. Set `PORT` to choose a different port. The ignored `.local/` directory contains the database and the session-signing key. Preserve both when backing up the workspace. Stop the server before copying the directory.

## Daily workflows

- **Administrators** create accounts and assign a role in **Team & access**. **Manage** changes individual feature grants, resets passwords, and disables accounts. Access changes apply to existing sessions on their next request. Password resets and disabling an account invalidate prior sessions.
- **Stores** supports creating a record, setting its website, assigning an employee and sheet, choosing an Add or Update task, editing store details, and deleting the record. Each URL operation has its own permission. Removing a store that has a URL requires both store-delete and link-delete permission.
- **Sheets** holds named links to external worksheets. Administrators can assign a sheet to an employee and attach it to store tasks. Employees open the external sheet using their existing access to its provider.
- **Store Adders** see their assigned store links. **Store Updaters** can monitor team assignments and performance and edit their own assigned records. Employees with work permission use **Start work**, **Pause timer**, and **Save & complete**. Saving a completed task marks it Done and stops the timer. Assignment history prevents sending a completed store back to the same employee.
- **Performance** generates daily totals from recorded changes and completions. A store counts once per employee, operation, and local calendar date. Time totals use explicit work timers, including paused and resumed intervals. Reports split intervals at local midnight. For an already completed assigned store, updaters can use **Start update timer** before editing.
- **Activity log** records the actor and role at the time of each change, the timestamp, target, and previous and updated values. Expand an entry to inspect the changes. Deleted stores retain their reporting and audit history.

## Offer discovery

Open an assigned store, start work, and choose **Discover offers**. Analyze its URL, review the evidence and cart tests, select offers, then choose **Save offers** for a draft or **Save & complete** to finish the active assignment.

Discovery follows public links across the merchant site and its campaign subdomains, prioritizing carousel destinations, promotions and categories. Each interactive scan tries up to 32 pages within a crawl time budget and reads up to 20 distinct promotional images using local English OCR. It returns up to ten deals plus every distinct coupon code identified in the scanned evidence. Codes that pass both cart tests appear first. Expand the evidence to check merchant wording, dates, eligibility, and the original banner. Pages that require client-side interaction or sign-in can have limited coverage.

Set `OPENAI_API_KEY` in the server environment before starting the app to enable AI-assisted offer selection and formatting. `OPENAI_MODEL` optionally changes the model, which defaults to `gpt-4o-mini`. The model receives candidate promotion text. Without a key or when model review is unavailable, the built-in extractor returns source-backed candidates. The review screen identifies which mode ran.

Automated verification supports compatible Shopify guest-cart endpoints. It samples the lowest and highest available variant prices when the product feed can be exhausted within 1,000 products, uses a fresh anonymous cart for each trial, and compares the cart totals before and after applying the code. A **Sitewide coupon (sampled)** needs matching-code acceptance and measurable savings at every tested price, with at least two distinct prices. This is sampled evidence. Customer-specific, checkout-only, shipping, or unsupported coupons can remain untested. Tests stop at the guest cart. Review and save are separate actions, and the server signs discovery results to preserve their recorded evidence.

## Verification

```sh
python -m unittest discover -s tests -v
```

The test suite uses temporary databases and controlled cart responses. It covers access restrictions, URL protection, grant revocation, assignments, history, work timing, daily reports, reviewed offers, and verification outcomes.

