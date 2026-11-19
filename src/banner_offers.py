"""Read independently positioned discount blocks on merchant banner artwork."""

import re
from io import BytesIO

from .merchant_pages import AMOUNT, simple_offer


def recognize(engine, data):
    import numpy as np
    from PIL import Image

    with Image.open(BytesIO(data)) as image:
        if image.width * image.height > 16_000_000:
            raise ValueError("Oversized banner")
        image.thumbnail((2000, 1200))
        lines, _ = engine(np.array(image.convert("RGB")))
    return lines or []


def banner_offers(banner, lines):
    words = []
    for points, raw, score in lines:
        if score < 0.84:
            continue
        text = re.sub(r"UP\s*T[O0]\s*", "up to ", raw, flags=re.IGNORECASE)
        text = re.sub(r"(?<=%)\s*[0O]FF\b", " off", text, flags=re.IGNORECASE)
        text = re.sub("BRANDDAYVOUCHER", "Brand Day voucher", text, flags=re.IGNORECASE)
        xs, ys = zip(*points)
        words.append((text.strip(), min(xs), min(ys), max(xs), max(ys)))
    found = []
    for text, x, y, right, bottom in words:
        if not re.search(rf"%|\bfree\b|{AMOUNT}", text, re.IGNORECASE):
            continue
        nearby = [
            w
            for w in words
            if w[0] != text
            and min(right, w[3]) - max(x, w[1]) > 0.45 * min(right - x, w[3] - w[1])
        ]
        above = sorted(
            (w for w in nearby if w[2] < y and y - w[4] < bottom - y),
            key=lambda w: -w[4],
        )
        below = sorted(
            (w for w in nearby if w[2] > y and w[2] - bottom < bottom - y),
            key=lambda w: w[2],
        )
        prefix = above[0][0] if above else ""
        suffix = below[0][0] if below else ""
        claim = re.sub(
            r"\b(extra|flat|additional)\s*(?=\d)",
            lambda m: m[1].lower() + " ",
            text,
            flags=re.IGNORECASE,
        )
        if re.fullmatch(r"up to|extra|flat", prefix, re.IGNORECASE):
            claim = prefix + " " + claim
        if re.fullmatch(r"off|shipping|delivery", suffix, re.IGNORECASE):
            claim += " " + suffix
        if re.search(r"voucher", prefix, re.IGNORECASE):
            claim += " with the " + prefix.rstrip(":").strip()
        if re.match(
            r"(?:on |orders? |min(?:imum)?[. ]|when |with |over |above )",
            suffix,
            re.IGNORECASE,
        ):
            claim += " " + suffix
        item = simple_offer(claim, banner.destination)
        if not item:
            continue
        label = banner.label.strip()[:100]
        details = [label, " · ".join(w[0] for w in words)]
        item.update(
            image=banner.image, evidence=" · ".join(filter(None, details))[:1500]
        )
        found.append(item)
    return found
