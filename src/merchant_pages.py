"""Collect public merchant promotion copy, carousel creatives and crawl targets."""

import json
import re
from dataclasses import dataclass, field
from urllib.parse import urljoin, urlsplit, urlunsplit

from bs4 import BeautifulSoup

PROMOTION = re.compile(
    r"banner|carousel|swiper|slider|slideshow|hero|promo|campaign|voucher|hero-image",
    re.IGNORECASE,
)
DEAL_PATH = re.compile(
    r"coupon|voucher|deals?|promo|offers?|discount|clearance|campaign|sale|free-shipping",
    re.IGNORECASE,
)
CATEGORY = re.compile(r"shop|collection|categor|brand|department", re.IGNORECASE)
SKIP = re.compile(
    r"/(?:login|logout|register|account|cart|checkout|wishlist|search|help|careers|privacy|terms-of-use)(?:[/?#-]|$)|\.(?:pdf|zip|jpg|png|jpeg|gif|svg|webp|mp4|css|js)(?:[?#]|$)",
    re.IGNORECASE,
)
CODE = re.compile(
    r"\b(?:use\s+(?:the\s+)?(?:promo\s+|coupon\s+)?code|(?:promo|coupon|discount)\s+codes?|codes?)\b\s*[:=–-]?\s*[\"'“]?([A-Za-z0-9][\w-]{2,29})\b",
    re.IGNORECASE,
)
PERCENT = re.compile(
    r"(?:(?:up\s*to|extra|flat|additional|at least)\s*)?\d{1,3}(?:[.,]\d+)?\s*%\s*(?:off\b|discount\b)",
    re.IGNORECASE,
)
SHIPPING = re.compile(
    r"\bfree\s+(?:standard\s+|express\s+)?(?:shipping|delivery)\b", re.IGNORECASE
)
MONEY = re.compile(
    r"\b(?:save|get|take)\s+(?:(?:up to|an extra)\s+)?(?:Rs\.?\s*|PKR\s*|USD\s*|[$€£])\d",
    re.IGNORECASE,
)
CUE = re.compile(
    r"(?:\b(?:save|coupon|voucher|code|shipping|delivery|bogo|buy one|cashback)\b|%\s*(?:off|discount))",
    re.IGNORECASE,
)
DISCOUNT_CODE_STOP = {
    "for",
    "enter",
    "offer",
    "applied",
    "available",
    "here",
    "and",
    "with",
    "required",
    "automatically",
    "discount",
    "code",
    "codes",
    "checkout",
    "needed",
    "that",
    "this",
    "which",
    "your",
    "will",
    "only",
    "can",
    "sent",
    "given",
    "after",
    "below",
    "above",
    "off",
    "via",
    "not",
    "per",
    "the",
    "you",
    "get",
    "may",
    "was",
    "at",
    "there",
    "from",
    "must",
    "would",
    "should",
    "provided",
    "during",
    "before",
    "found",
    "once",
    "then",
    "redeem",
    "valid",
    "use",
    "save",
}


def link(base, value):
    if not isinstance(value, str) or not value.strip():
        return ""
    try:
        u = urlsplit(urljoin(base, value.strip()))
        if (
            u.scheme not in ("https", "http")
            or not u.hostname
            or u.username
            or u.password
        ):
            return ""
        return urlunsplit((u.scheme, u.netloc, u.path or "/", u.query, ""))
    except ValueError:
        return ""


def merchant_host(url, root):
    domain = urlsplit(root).hostname.removeprefix("www.")
    host = (urlsplit(url).hostname or "").lower()
    return host == domain or host.endswith("." + domain)


NUMBER = r"\d+(?:,\d{3})*(?:\.\d+)?"
CURRENCY = r"(?:Rs\.?|PKR|USD|[$€£])"
AMOUNT = rf"(?:{CURRENCY}\s*{NUMBER}|{NUMBER}\s*{CURRENCY})"


def display_amount(raw):
    value = raw.strip()
    if value.startswith("$"):
        return value[1:].strip() + "$"
    return re.sub(r"\s+([$€£])$", r"\1", value)


def coupon_codes(evidence):
    for match in CODE.finditer(evidence):
        prefix = evidence[match.start() : match.start(1)]
        directive = re.search(r"\b(?:use|enter|apply)\b", prefix, re.IGNORECASE)
        if not re.search(
            r"\b(?:use|enter|apply|coupon|discount|promo|voucher|save)\b|%\s*off|\bcodes?\s*:",
            evidence,
            re.IGNORECASE,
        ):
            continue
        token = match[1]
        marked = re.search(r"""[:="'“]\s*$""", prefix)
        if token.casefold() in DISCOUNT_CODE_STOP or not (
            token.isupper() or re.search(r"\d", token) or marked or directive
        ):
            continue
        yield token
        # Merchants sometimes list several alternatives after one "codes:" label.
        tail = evidence[match.end() :]
        while True:
            extra = re.match(
                r"\s*(?:,\s*(?:or\s+)?|/|\bor\s+)([A-Z0-9][A-Z0-9_-]{2,29})\b", tail
            )
            if not extra or extra[1].lower() in DISCOUNT_CODE_STOP:
                break
            yield extra[1]
            tail = tail[extra.end() :]


def simple_offer(text, source):
    evidence = " ".join(text.split()).strip()
    if not 4 <= len(evidence) <= 600:
        return None
    code = next(iter(coupon_codes(evidence)), "")
    percent = re.search(
        r"(?:(up\s*to|extra|additional|flat)\s*)?(\d{1,3}(?:[.,]\d+)?)\s*%\s*(?:off|discount)\b",
        evidence,
        re.IGNORECASE,
    )
    if not percent:
        percent = re.search(
            r"\bsave\s+(?:(up\s*to)\s*)?(\d{1,3}(?:[.,]\d+)?)\s*%",
            evidence,
            re.IGNORECASE,
        )
    cash = re.search(
        rf"(?:(up\s*to)\s+)?({AMOUNT})\s*(?:off|discount)\b", evidence, re.IGNORECASE
    )
    if not cash:
        cash = re.search(
            rf"\bsave\s+(?:(up\s*to)\s+)?({AMOUNT})", evidence, re.IGNORECASE
        )
    shipping = SHIPPING.search(evidence)
    discount = percent or cash
    if discount:
        qualifier = (discount[1] or "").lower().replace(" ", "")
        prefix = {
            "upto": "Upto ",
            "extra": "Extra ",
            "additional": "Extra ",
            "flat": "Flat ",
        }.get(qualifier, "")
        amount = discount[2] + "%" if percent else display_amount(discount[2])
        title = f"Get {prefix}{amount} Off"
    elif shipping:
        title = "Get " + shipping[0].title()
    elif code:
        title = "Get a Discount With Code " + code
    else:
        return None

    minimum = re.search(
        rf"\b(over|above|at least|minimum(?: spend| order| purchase)?(?: of)?|from|under)\s*:?\s*({AMOUNT}|\d+(?:[.,]\d+)?)",
        evidence,
        re.IGNORECASE,
    )
    qualifiers = []
    if minimum:
        relation = minimum[1].lower()
        relation = (
            "Over"
            if relation in ("over", "above")
            else "Under"
            if relation == "under"
            else "of at Least"
        )
        qualifiers.append(f"On Orders {relation} {display_amount(minimum[2])}")
    if re.search(
        r"\bfirst(?:[- ]time)? (?:order|purchase)|\bnew customers?\b",
        evidence,
        re.IGNORECASE,
    ):
        qualifiers.append("On First Order")
    if re.search(r"\bGovX\b", evidence, re.IGNORECASE):
        qualifiers.append("With GovX Verification")
    if re.search(r"\bUS only\b", evidence, re.IGNORECASE):
        qualifiers.append("(US Only)")
    if discount or shipping:
        scope = re.match(
            r"\s+(?:on|for)\s+((?:selected? |all )?[\w-]+(?: [\w-]+){0,3})",
            evidence[(discount or shipping).end() :],
            re.IGNORECASE,
        )
        if scope:
            words = re.split(
                r"\s+(?:with|using|and|when|until|through|over|at)\b",
                scope[1],
                flags=re.IGNORECASE,
            )[0]
            if not re.search(
                r"\b(?:order|orders|purchase|purchases|sitewide|your|the|first|all items|everything)\b",
                words,
                re.IGNORECASE,
            ):
                qualifiers.append("On " + words.title())
    title = " ".join([title, *qualifiers])
    return {
        "title": title,
        "evidence": evidence,
        "code": code,
        "source": source,
        "verification": "Untested" if code else "Advertised",
        "trials": [],
    }


@dataclass(frozen=True)
class Banner:
    image: str
    destination: str
    label: str
    page: str


@dataclass
class Page:
    logo: str = ""
    offers: list = field(default_factory=list)
    banners: list = field(default_factory=list)
    links: dict = field(default_factory=dict)

    def target(self, url, priority):
        if url and not SKIP.search(url):
            self.links[url] = min(priority, self.links.get(url, 10))


def read_page(html, source):
    doc = BeautifulSoup(html, "html.parser")
    result = Page()
    for selector, attr in [
        ('header img[alt*="logo" i]', "src"),
        ('link[rel~="apple-touch-icon"]', "href"),
        ('link[rel~="icon"]', "href"),
    ]:
        icon = doc.select_one(selector)
        if icon:
            result.logo = link(source, icon.get(attr))
            if result.logo:
                break

    def offer(text, url=source):
        text = text or ""
        clauses = re.split(r"\s*[;|]\s*|(?<=[.!?])\s+", text)
        # Separate independent benefits before pairing each code with its amount.
        if (
            len(clauses) > 1
            and sum(
                bool(list(coupon_codes(c)))
                and bool(PERCENT.search(c) or MONEY.search(c))
                for c in clauses
            )
            > 1
        ):
            for clause in clauses:
                offer(clause, url)
            return
        item = simple_offer(text, url)
        if item:
            result.offers.append(item)
            for code in dict.fromkeys(coupon_codes(text)):
                if code.casefold() != item["code"].casefold():
                    title = item["title"]
                    if title.startswith("Get a Discount With Code "):
                        title = "Get a Discount With Code " + code
                    result.offers.append(
                        {**item, "code": code, "title": title, "trials": []}
                    )

    # Modern storefronts often ship their visible hero slides in a JSON hydration payload.
    for script in doc.find_all(
        "script", type=re.compile(r"application/(?:ld\+)?json", re.IGNORECASE)
    ):
        try:
            data = json.loads(script.string or "")
        except (ValueError, RecursionError):
            continue
        stack = [(data, "")]
        while stack:
            value, context = stack.pop()
            if isinstance(value, dict):
                title = next(
                    (
                        value[k]
                        for k in ("bannerTitle", "title", "headline", "alt", "name")
                        if isinstance(value.get(k), str)
                    ),
                    "",
                )
                dest = (
                    link(
                        source,
                        value.get("linkUrl") or value.get("href") or value.get("url"),
                    )
                    or source
                )
                if PROMOTION.search(context) or value.get("@type") in (
                    "Offer",
                    "SaleEvent",
                ):
                    offer(title, dest)
                    if isinstance(value.get("description"), str):
                        offer(value["description"], dest)
                    image = link(
                        source,
                        value.get("imageUrl") or value.get("image") or value.get("src"),
                    )
                    if image and PROMOTION.search(context):
                        result.banners.append(Banner(image, dest, title, source))
                    result.target(dest, 1)
                stack.extend(
                    (v, (context + " " + k)[-120:])
                    for k, v in value.items()
                    if isinstance(v, (dict, list))
                )
            elif isinstance(value, list):
                stack.extend((v, context) for v in value if isinstance(v, (dict, list)))
    for tag in doc(["script", "style", "noscript", "template", "svg"]):
        tag.decompose()

    for a in doc.find_all("a", href=True):
        dest = link(source, a["href"])
        descriptor = dest + " " + a.get_text(" ", strip=True)[:120]
        result.target(
            dest,
            1
            if DEAL_PATH.search(descriptor)
            else 2
            if CATEGORY.search(descriptor)
            else 4,
        )

    for image in doc.select("img, [style*='background-image'], [data-bg]"):
        chain = [image, *list(image.parents)[:7]]
        context = " ".join(
            " ".join(t.get("class") or []) + " " + str(t.get("id") or "") for t in chain
        )
        a = image.find_parent("a", href=True)
        if image.name == "a":
            a = image
        dest = link(source, a.get("href")) if a else source
        dest = dest or source
        alt = image.get("alt") or image.get("aria-label") or ""
        offer(alt, dest)
        if not PROMOTION.search(context + " " + alt + " " + dest) and not (
            a and a.has_attr("bannertitle")
        ):
            continue
        image_url = (
            image.get("data-src")
            or image.get("data-original")
            or image.get("data-lazy-src")
            or image.get("data-bg")
            or image.get("src")
        )
        if not image_url:
            bg = re.search(r'url\([\'"]?([^\'")]+)', image.get("style", ""))
            srcset = image.get("data-srcset") or image.get("srcset") or ""
            image_url = (
                bg[1] if bg else (srcset.split(",")[-1].strip().split() or [""])[0]
            )
        image_url = link(source, image_url)
        if image_url:
            label = (
                (a.get("bannertitle") or a.get("aria-label") or a.get("title") or "")
                if a
                else ""
            )
            result.banners.append(Banner(image_url, dest, label or alt, source))
            result.target(dest, 0)

    for meta in doc.select("meta[name=description]"):
        offer(meta.get("content"))
    # Read inline markup together; keep a shipping threshold in the same offer as its heading.
    for block in doc.find_all(
        ["p", "li", "h1", "h2", "h3", "h4", "a", "div", "span", "section", "article"]
    ):
        if block.find(["p", "li", "div", "section", "article", "h1", "h2", "h3", "h4"]):
            continue
        if (
            block.name == "span"
            and block.parent
            and block.parent.name in ("p", "li", "span", "a", "h1", "h2", "h3", "h4")
        ):
            continue
        text = block.get_text(" ", strip=True)
        if not text:
            continue
        neighbor = block.find_next_sibling()
        if neighbor:
            terms = neighbor.get_text(" ", strip=True)
            if (
                0 < len(terms) < 180
                and not (
                    PERCENT.search(terms)
                    or SHIPPING.search(terms)
                    or MONEY.search(terms)
                )
                and re.match(
                    r"^(?:on orders?|orders? over|minimum (?:spend|purchase)|when you|with (?:code|voucher)|use code|excludes?|valid (?:on|until))\b",
                    terms,
                    re.IGNORECASE,
                )
            ):
                text += " " + terms
        dest = link(source, block.get("href")) if block.name == "a" else source
        offer(text, dest or source)
    return result
