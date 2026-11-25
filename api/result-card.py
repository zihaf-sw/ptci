"""Serve result cards as ordinary PNG files for mobile download managers."""

from functools import lru_cache
from http.server import BaseHTTPRequestHandler
from io import BytesIO
import json
from pathlib import Path
import re
from urllib.parse import parse_qs, urlsplit

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent.parent
# Use the catalog that the survey uses for its labels and character artwork.
catalog_source = (ROOT / "ptci-data.js").read_text(encoding="utf-8")
catalog = json.JSONDecoder().raw_decode(catalog_source.split("globalThis.PTCI_DATA=", 1)[1])[0]
TYPES = {profile["code"]: profile for profile in catalog["types"]}


@lru_cache(maxsize=8)
def font(size):
    return ImageFont.truetype(str(ROOT / "assets/card-font/ptci-ko.ttf"), size)


def render_card(code, scores):
    profile = TYPES[code]
    card = Image.new("RGB", (900, 1120))
    draw = ImageDraw.Draw(card)
    for y in range(card.height):
        color = tuple(255 - round((255 - end) * y / (card.height - 1)) for end in (238, 218, 247))
        draw.line((0, y, card.width, y), fill=color)

    ink = "#35123f"

    def center(y, text, size, color=ink, bold=False):
        draw.text((450, y), text, font=font(size), fill=color, anchor="ms", stroke_width=int(bold))

    center(88, "FOODING CLUB", 44, bold=True)
    with Image.open(ROOT / profile["characterSrc"]) as source:
        art = source.convert("RGBA")
    art.thumbnail((340, 340), Image.Resampling.LANCZOS)
    card.paste(art, ((900 - art.width) // 2, 140 + (340 - art.height) // 2), art)
    center(565, code, 54, "#70248f", bold=True)
    center(630, profile["name"], 42, bold=True)

    lines = [""]
    for word in profile["summary"].split():
        candidate = (lines[-1] + " " + word).strip()
        if lines[-1] and draw.textlength(candidate, font=font(23)) > 750:
            lines.append(word)
        else:
            lines[-1] = candidate
    for index, line in enumerate(lines):
        center(690 + index * 33, line, 23)

    if scores is None:
        center(870, "유형 안내 예시 · 실제 점수는 검사 후 표시", 22)
    else:
        for index, (axis, letter, value) in enumerate(zip(catalog["axes"], code, scores)):
            y = 835 + index * 55
            draw.text((160, y), f"{axis['name']} {letter}", font=font(24), fill=ink, anchor="ls")
            draw.text((740, y), f"{value}%", font=font(24), fill=ink, anchor="rs")
    center(1070, "PTCI · 음식 취향 결과", 18, "#806d86")
    output = BytesIO()
    card.save(output, format="PNG")
    return output.getvalue()


class handler(BaseHTTPRequestHandler):
    def do_HEAD(self):
        self.serve_card()

    def do_GET(self):
        self.serve_card()

    def serve_card(self):
        query = parse_qs(urlsplit(self.path).query)
        card_id = query.get("card", [""])[0]
        code, *parts = card_id.split("-")
        scores = None
        if parts:
            if len(parts) != 4 or not all(re.fullmatch(r"[5-9][0-9]|100", value) for value in parts):
                self.send_error(404)
                return
            scores = [int(value) for value in parts]
        if code not in TYPES:
            self.send_error(404)
            return
        image = render_card(code, scores)
        disposition = "inline" if query.get("view") == ["1"] else "attachment"
        self.send_response(200)
        self.send_header("Content-Type", "image/png")
        self.send_header("Content-Disposition", f'{disposition}; filename="PTCI_{code}.png"')
        self.send_header("Content-Length", str(len(image)))
        self.send_header("Cache-Control", "private, no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(image)
