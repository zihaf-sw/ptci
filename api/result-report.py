"""Create a PDF from the explanation blocks shown on the participant's device."""

import base64
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler
from io import BytesIO
import json
from pathlib import Path
import re
from urllib.parse import parse_qs, urlsplit
from xml.sax.saxutils import escape
import zlib

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate


ROOT = Path(__file__).resolve().parent.parent
source = (ROOT / "ptci-data.js").read_text(encoding="utf-8")
catalog = json.JSONDecoder().raw_decode(source.split("globalThis.PTCI_DATA=", 1)[1])[0]
TYPES = {item["code"]: item["name"] for item in catalog["types"]}
FONT = "PTCI-Korean"
pdfmetrics.registerFont(TTFont(FONT, str(ROOT / "assets/card-font/ptci-ko.ttf")))
MAX_DOCUMENT = 64000
STYLES = {
    key: ParagraphStyle(key, fontName=FONT, fontSize=size, leading=leading,
                        textColor=HexColor(color), spaceBefore=before, spaceAfter=after,
                        wordWrap="CJK", keepWithNext=key in ("h2", "h3", "title"))
    for key, size, leading, color, before, after in (
        ("title", 27, 36, "#35123f", 0, 12),
        ("h2", 17, 24, "#70248f", 14, 6),
        ("h3", 12, 18, "#432b4d", 6, 3),
        ("p", 10.5, 16, "#342c38", 0, 4),
        ("note", 9, 14, "#706375", 0, 5),
    )
}


def make_pdf(code, blocks):
    output = BytesIO()
    title = f"{code} · {TYPES[code]}"
    doc = SimpleDocTemplate(output, pagesize=A4, leftMargin=48, rightMargin=48,
                            topMargin=58, bottomMargin=50, title=title, author="FOODING CLUB")
    story = [Paragraph(title, STYLES["title"])]
    for kind, text in blocks:
        story.append(Paragraph(escape(text), STYLES[kind]))

    def decorate(canvas, document):
        canvas.saveState()
        canvas.setFillColor(HexColor("#70248f"))
        canvas.setFont(FONT, 9)
        canvas.drawString(54, A4[1] - 36, "FOODING CLUB  /  PTCI")
        canvas.setStrokeColor(HexColor("#e2d8e7"))
        canvas.line(54, 39, A4[0] - 54, 39)
        canvas.setFillColor(HexColor("#706375"))
        canvas.drawString(54, 24, title)
        canvas.drawRightString(A4[0] - 54, 24, str(document.page))
        canvas.restoreState()

    doc.build(story, onFirstPage=decorate, onLaterPages=decorate)
    return output.getvalue()


def valid_blocks(blocks):
    return isinstance(blocks, list) and 0 < len(blocks) <= 400 and all(
        isinstance(block, list) and len(block) == 2 and isinstance(block[0], str)
        and block[0] in ("h2", "h3", "p", "note") and isinstance(block[1], str)
        and 0 < len(block[1]) <= 3000 for block in blocks
    )


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        self.serve_pdf()

    def do_GET(self):
        self.serve_pdf()

    def do_HEAD(self):
        self.serve_pdf()

    def serve_pdf(self):
        query = parse_qs(urlsplit(self.path).query)
        code = query.get("code", [""])[0]
        if code not in TYPES:
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        try:
            if self.command == "POST":
                size = int(self.headers.get("Content-Length", 0))
                if not 0 < size <= MAX_DOCUMENT * 3:
                    raise ValueError
                fields = parse_qs(self.rfile.read(size).decode(), max_num_fields=2)
                raw = fields["report"][0]
                if len(raw.encode()) > MAX_DOCUMENT:
                    raise ValueError
            else:
                ticket = query.get("ticket", [""])[0]
                if not re.fullmatch("[0-9a-f]{16}", ticket):
                    raise ValueError
                cookies = SimpleCookie(self.headers.get("Cookie", ""))
                prefix = "ptci_" + ticket + "_"
                encoded = cookies[prefix + "0"].value
                if prefix + "1" in cookies:
                    encoded += cookies[prefix + "1"].value
                compressed = base64.b64decode(encoded, validate=True)
                decoder = zlib.decompressobj(16 + zlib.MAX_WBITS)
                raw = decoder.decompress(compressed, MAX_DOCUMENT + 1)
                if not decoder.eof or len(raw) > MAX_DOCUMENT:
                    raise ValueError
            blocks = json.loads(raw)
            if not valid_blocks(blocks):
                raise ValueError
        except (ValueError, KeyError, zlib.error, RecursionError):
            self.send_error(HTTPStatus.BAD_REQUEST, "Return to your result and download the PDF again.")
            return
        pdf = make_pdf(code, blocks)
        self.send_response(200)
        self.send_header("Content-Type", "application/pdf")
        self.send_header("Content-Disposition", f'attachment; filename="PTCI_{code}_report.pdf"')
        self.send_header("Content-Length", str(len(pdf)))
        self.send_header("Cache-Control", "private, no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(pdf)
