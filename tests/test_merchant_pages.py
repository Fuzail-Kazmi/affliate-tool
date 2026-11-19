import unittest

from src.banner_offers import banner_offers
from src.merchant_pages import Banner, merchant_host, read_page


class MerchantPagesTests(unittest.TestCase):
    def test_product_activation_code_is_not_a_coupon(self):
        page = read_page(
            "<p>ASSASSIN'S CREED UNITY CODE XBOX ONE</p>", "https://example.org"
        )
        self.assertEqual(page.offers, [])

    def test_campaign_subdomain_and_lazy_carousel(self):
        page = read_page(
            '<div class="swiper-slide"><a bannerTitle="Sereno" href="https://pages.daraz.pk/campaign"><img data-src="//cdn.example/a.jpg"></a></div>',
            "https://www.daraz.pk/",
        )
        self.assertEqual(page.banners[0].image, "https://cdn.example/a.jpg")
        self.assertEqual(page.links[page.banners[0].destination], 0)
        self.assertTrue(
            merchant_host(page.banners[0].destination, "https://www.daraz.pk")
        )
        self.assertFalse(
            merchant_host("https://daraz.pk.example.com", "https://www.daraz.pk")
        )

    def test_shipping_keeps_the_stated_minimum(self):
        page = read_page(
            "<div><h2>Free shipping</h2><p>On orders over Rs. 100</p></div>",
            "https://example.org/",
        )
        self.assertEqual(
            [o["title"] for o in page.offers],
            ["Get Free Shipping On Orders Over Rs. 100"],
        )

    def test_spatially_separate_voucher_and_up_to_discount(self):
        def line(text, x, y, w):
            return ([[x, y], [x + w, y], [x + w, y + 20], [x, y + 20]], text, 0.98)

        lines = [
            line("BRANDDAYVOUCHER:", 0, 0, 150),
            line("UPTO", 300, 0, 50),
            line("EXTRA 18% 0FF", 0, 21, 150),
            line("70%", 300, 21, 50),
            line("OFF", 305, 43, 40),
        ]
        offers = banner_offers(
            Banner(
                "https://cdn.example/b.jpg",
                "https://example.org/p",
                "Sereno",
                "https://example.org",
            ),
            lines,
        )
        self.assertEqual(
            [o["title"] for o in offers],
            [
                "Get Extra 18% Off",
                "Get Upto 70% Off",
            ],
        )
        self.assertTrue(all(not o["code"] and o["image"] for o in offers))
