import json
import unittest
from unittest.mock import patch

from src.discovery import (
    PublicSite,
    choose,
    extract,
    model_review,
    sample_catalog,
    verify,
    website,
)


class DiscoveryTests(unittest.TestCase):
    def test_ai_formatting_keeps_source_and_rejects_changed_amounts(self):
        offers, _ = extract(
            "<p>Save 20% on orders over $75.</p><p>Save 10% on shoes.</p>",
            "https://store.example/",
        )
        decisions = [
            {"id": 0, "title": "20% off orders over $75"},
            {"id": 1, "title": "30% off shoes"},
        ]
        with (
            patch.dict("os.environ", {"OPENAI_API_KEY": "test-key"}),
            patch("src.discovery.requests.post") as post,
        ):
            post.return_value.json.return_value = {
                "choices": [{"message": {"content": json.dumps({"offers": decisions})}}]
            }
            selected, engine = model_review(offers)
        self.assertEqual(engine, "AI-assisted review")
        self.assertEqual(selected[0]["title"], "Get 20% Off On Orders Over 75$")
        self.assertEqual(selected[0]["evidence"], offers[0]["evidence"])
        self.assertEqual(selected[1]["title"], offers[1]["title"])

    def test_banner_text_codes_restrictions_and_hidden_content(self):
        html = '<script>80% off</script><aside><img alt="Get 20% off orders over $75 with code SAVE20"></aside><p>Free shipping on shoes.</p><p>Help center</p>'
        offers, _ = extract(html, "https://store.example/")
        self.assertEqual(len(offers), 2)
        self.assertEqual(offers[0]["code"], "SAVE20")
        self.assertIn("over $75", offers[0]["evidence"])
        self.assertEqual(offers[0]["verification"], "Untested")

    def test_short_storefront_has_no_fabricated_offers(self):
        with patch.dict("os.environ", {"OPENAI_API_KEY": ""}):
            self.assertEqual(model_review([])[0], [])
        self.assertEqual(
            extract("<p>No promotions available</p>", "https://example.org")[0], []
        )

    def test_keeps_all_distinct_codes_ahead_of_deals(self):
        offers = [{"code": str(i)} for i in range(6)] + [{"code": ""} for _ in range(9)]
        selected = choose(offers)
        self.assertEqual(len(selected), 15)
        self.assertEqual(sum(bool(o["code"]) for o in selected), 6)

    def test_private_and_non_web_addresses_rejected(self):
        for url in [
            "file:///etc/passwd",
            "ftp://store.example",
            "https://a:b@example.org",
            "https://example.org:9000",
        ]:
            with self.subTest(url=url), self.assertRaises(ValueError):
                website(url)
        with self.assertRaises(ValueError):
            PublicSite().request("http://127.0.0.1/")

    def verify_with(self, codes, prices, total=800):
        class Cart:
            def json(self, url, data=None):
                if url.endswith("update.js"):
                    return {
                        "total_price": total,
                        "discount_codes": codes,
                        "currency": "USD",
                    }
                return {"total_price": 1000}

        offer = {
            "title": "Get 20% Off",
            "code": "SAVE20",
            "verification": "Untested",
            "trials": [],
        }
        verify(
            offer,
            "https://shop.example",
            [(price, i, "Sample") for i, price in enumerate(prices)],
            Cart,
        )
        return offer

    def test_sitewide_requires_price_spread_and_actual_cart_savings(self):
        codes = [{"code": "save20", "applicable": True}]
        self.assertEqual(
            self.verify_with(codes, [10, 50, 100])["verification"],
            "Sitewide coupon (sampled)",
        )
        self.assertEqual(
            self.verify_with(codes, [10])["verification"], "Applied on sampled products"
        )
        self.assertEqual(
            self.verify_with(codes, [10, 100], 1000)["verification"], "Untested"
        )
        self.assertEqual(self.verify_with([], [10, 100])["verification"], "Untested")

    def test_rejected_codes_remain_ineligible(self):
        offer = self.verify_with([{"code": "SAVE20", "applicable": False}], [10, 100])
        self.assertEqual(offer["verification"], "Ineligible on sampled products")

    def test_compact_offer_titles_and_gated_code(self):
        examples = {
            "Up to 10% off": "Get Upto 10% Off",
            "Take 10% off": "Get 10% Off",
            "Get $10 off": "Get 10$ Off",
            "10% off on orders over $100": "Get 10% Off On Orders Over 100$",
            "Free Shipping on orders over $100": "Get Free Shipping On Orders Over 100$",
            "Free Shipping on your first order": "Get Free Shipping On First Order",
            "Once verified through GovX, receive a single-use promo code that you can use for 15% off your order. US only.": "Get 15% Off With GovX Verification (US Only)",
        }
        for source, expected in examples.items():
            with self.subTest(source=source):
                offer = extract("<p>" + source + "</p>", "https://store.example/")[0][0]
                self.assertEqual(
                    (offer["title"], offer["code"], offer["evidence"]),
                    (expected, "", source),
                )

    def test_explicit_code_lists_and_distinct_benefits(self):
        html = "<p>Get 10% off with codes: SAVE10, HELLO10 or FALL10</p><p>Use code WIN20 for 20% off; use code BAGS30 for 30% off</p>"
        found = extract(html, "https://store.example/")[0]
        self.assertEqual(
            [(o["code"], o["title"]) for o in found],
            [
                ("SAVE10", "Get 10% Off"),
                ("HELLO10", "Get 10% Off"),
                ("FALL10", "Get 10% Off"),
                ("WIN20", "Get 20% Off"),
                ("BAGS30", "Get 30% Off"),
            ],
        )

    def test_cart_checks_use_only_available_extremes(self):
        from unittest.mock import Mock

        site = Mock()
        site.json.return_value = {
            "products": [
                {
                    "title": "Item",
                    "variants": [
                        {"id": i, "price": str(price), "available": i != 4}
                        for i, price in enumerate([50, 10, 100, 20, 200])
                    ],
                }
            ]
        }
        self.assertEqual(
            [int(row[0]) for row in sample_catalog(site, "https://store.example")],
            [10, 100],
        )
        offer = self.verify_with([{"code": "SAVE20", "applicable": True}], [10, 100])
        self.assertEqual(offer["title"], "Get 20% Off Sitewide")
        site.json.return_value = {"products": [{"variants": []}] * 250}
        self.assertEqual(sample_catalog(site, "https://store.example"), [])
