"""Exporta los documentos Markdown de docs/ a PDF con portada, indice y paginacion.

Requisitos:
    python -m pip install markdown reportlab pypdf

Uso:
    python docs/tools/md2pdf.py docs/inception.md
    python docs/tools/md2pdf.py docs/inception.md docs/inception.pdf
    python docs/tools/md2pdf.py docs/inception.md docs/sprint-planning.md
    python docs/tools/md2pdf.py --all

El PDF se genera con Chrome (o Edge) en modo headless y luego se numera con pypdf.
No requiere pandoc ni LaTeX.
"""

from __future__ import annotations

import argparse
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import markdown
from pypdf import PdfReader, PdfWriter
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

DOCS_DIR = Path(__file__).resolve().parents[1]
CHROME_CANDIDATES = [
    os.environ.get("CHROME_PATH", ""),
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
]

CSS = """
@page { size: A4; margin: 20mm 18mm 24mm 18mm; }
* { box-sizing: border-box; }
html { font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif; color: #1b1d21; }
body { font-size: 10.5pt; line-height: 1.55; margin: 0; }
h1, h2, h3, h4 { font-family: "Segoe UI Semibold", "Segoe UI", Arial, sans-serif; color: #0f2740; page-break-after: avoid; }
h1 { font-size: 20pt; margin: 0 0 10pt; }
h2 { font-size: 14pt; margin: 20pt 0 8pt; padding-bottom: 3pt; border-bottom: 1.5pt solid #1f6feb; }
h3 { font-size: 11.5pt; margin: 14pt 0 6pt; }
p, li { orphans: 3; widows: 3; }
a { color: #1f6feb; text-decoration: none; }
code { font-family: Consolas, "Courier New", monospace; font-size: 9pt; background: #f2f4f7; padding: 0 2pt; border-radius: 2pt; }
pre { background: #f6f8fa; border: 0.5pt solid #d6dbe2; border-radius: 4pt; padding: 8pt; font-size: 8.5pt; white-space: pre-wrap; word-wrap: break-word; }
pre code { background: none; }
table { border-collapse: collapse; width: 100%; margin: 8pt 0 12pt; font-size: 8.8pt; page-break-inside: auto; }
thead { display: table-header-group; }
tr { page-break-inside: avoid; page-break-after: auto; }
th { background: #e8eef7; color: #0f2740; text-align: left; padding: 4pt 5pt; border: 0.5pt solid #c3ccd8; font-weight: 600; }
td { padding: 4pt 5pt; border: 0.5pt solid #d6dbe2; vertical-align: top; }
td a { word-break: break-all; }
img { max-width: 100%; height: auto; border: 0.5pt solid #d6dbe2; border-radius: 4pt; }
figure { margin: 10pt 0 14pt; page-break-inside: avoid; break-inside: avoid; }
figure img { display: block; margin: 0 auto; max-height: 110mm; width: auto; }
figcaption { font-size: 8.8pt; color: #47505c; margin-top: 5pt; text-align: center; }
blockquote { margin: 8pt 0; padding: 6pt 10pt; border-left: 3pt solid #1f6feb; background: #f5f8ff; }
hr { border: none; border-top: 0.5pt solid #d6dbe2; margin: 14pt 0; }
.cover { height: 245mm; display: flex; flex-direction: column; justify-content: space-between; page-break-after: always; }
.cover .brand { font-size: 9pt; letter-spacing: 2pt; text-transform: uppercase; color: #6a7480; }
.cover h1.title { font-size: 34pt; line-height: 1.1; margin: 0 0 8pt; color: #0f2740; }
.cover .subtitle { font-size: 12.5pt; color: #47505c; margin: 0; max-width: 150mm; }
.cover .rule { width: 60mm; height: 3pt; background: #1f6feb; margin: 14pt 0 0; }
.cover dl { display: grid; grid-template-columns: 34mm 1fr; gap: 3pt 8pt; font-size: 9.5pt; margin: 0; }
.cover dt { color: #6a7480; text-transform: uppercase; letter-spacing: 0.6pt; font-size: 8pt; padding-top: 2pt; }
.cover dd { margin: 0; }
.toc { page-break-after: always; }
.toc h2 { border-bottom: 1.5pt solid #1f6feb; }
.toc ul { list-style: none; padding-left: 0; margin: 0; font-size: 10pt; }
.toc ul.sub { padding-left: 14pt; font-size: 9.5pt; color: #47505c; }
.toc li { margin: 3.5pt 0; }
.toc a { color: #1b1d21; }
"""


def parse_front_matter(text: str) -> tuple[dict[str, str], str]:
    meta: dict[str, str] = {}
    if not text.startswith("---"):
        return meta, text
    parts = text.split("---", 2)
    if len(parts) < 3:
        return meta, text
    for line in parts[1].strip().splitlines():
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        meta[key.strip()] = value.strip().strip('"').strip("'")
    return meta, parts[2].lstrip("\n")


def build_toc(html: str) -> str:
    headings = re.findall(r'<h([23]) id="([^"]+)">(.*?)</h\1>', html, flags=re.S)
    if not headings:
        return ""
    items: list[str] = []
    open_h2 = False
    open_sub = False
    for level, anchor, label in headings:
        text = re.sub(r"<[^>]+>", "", label).strip()
        link = f'<a href="#{anchor}">{text}</a>'
        if level == "2":
            if open_sub:
                items.append("</ul></li>")
                open_sub = False
            elif open_h2:
                items.append("</li>")
            items.append(f"<li>{link}")
            open_h2 = True
        else:
            if not open_sub:
                items.append('<ul class="sub">')
                open_sub = True
            items.append(f"<li>{link}</li>")
    if open_sub:
        items.append("</ul></li>")
    elif open_h2:
        items.append("</li>")
    return '<nav class="toc"><h2>Contenido</h2><ul>' + "".join(items) + "</ul></nav>"


def build_cover(meta: dict[str, str], fallback_title: str) -> str:
    title = meta.get("title", fallback_title)
    subtitle = meta.get("subtitle", "")
    rows = [
        ("Proyecto", "Trackhive"),
        ("Equipo", meta.get("team", "Equipo Trackhive")),
        ("Integrantes", meta.get("members", "")),
        ("Fecha", meta.get("date", "")),
        ("Versión", meta.get("version", "1.0")),
    ]
    dl = "".join(f"<dt>{name}</dt><dd>{value}</dd>" for name, value in rows if value)
    return (
        '<section class="cover">'
        '<div><p class="brand">Universidad del Norte · Proyecto final</p>'
        f'<h1 class="title">{title}</h1>'
        f'<p class="subtitle">{subtitle}</p>'
        '<div class="rule"></div></div>'
        f"<dl>{dl}</dl>"
        "</section>"
    )


def render_html(source: Path, meta: dict[str, str], body_md: str) -> str:
    body = markdown.markdown(
        body_md,
        extensions=["extra", "toc", "sane_lists", "attr_list", "md_in_html"],
        extension_configs={"toc": {"permalink": False}},
    )
    body = re.sub(r"<h1[^>]*>.*?</h1>", "", body, count=1, flags=re.S)
    cover = build_cover(meta, source.stem)
    toc = build_toc(body)
    return (
        "<!doctype html><html lang=\"es\"><head><meta charset=\"utf-8\">"
        f"<title>{meta.get('title', source.stem)}</title><style>{CSS}</style></head>"
        f"<body>{cover}{toc}{body}</body></html>"
    )


def find_chrome() -> str:
    for candidate in CHROME_CANDIDATES:
        if candidate and Path(candidate).exists():
            return candidate
    found = shutil.which("chrome") or shutil.which("google-chrome") or shutil.which("msedge")
    if found:
        return found
    raise SystemExit("No se encontro Chrome ni Edge. Define CHROME_PATH.")


def print_pdf(chrome: str, html_path: Path, pdf_path: Path) -> None:
    with tempfile.TemporaryDirectory(prefix="md2pdf-") as profile:
        cmd = [
            chrome,
            "--headless=new",
            "--disable-gpu",
            "--no-first-run",
            "--no-default-browser-check",
            "--no-pdf-header-footer",
            "--virtual-time-budget=8000",
            f"--user-data-dir={profile}",
            f"--print-to-pdf={pdf_path}",
            html_path.resolve().as_uri(),
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
    if not pdf_path.exists():
        raise SystemExit(f"Chrome no genero el PDF.\n{result.stdout}\n{result.stderr}")


def stamp_pages(pdf_path: Path, title: str, meta: dict[str, str]) -> int:
    writer = PdfWriter(clone_from=str(pdf_path))
    total = len(writer.pages)
    footer_left = f"Trackhive · {title}"
    footer_right = f"v{meta.get('version', '1.0')} · {meta.get('date', '')}".strip(" ·")
    with tempfile.TemporaryDirectory(prefix="md2pdf-stamp-") as tmp:
        for index, page in enumerate(writer.pages, start=1):
            if index == 1:
                continue
            width = float(page.mediabox.width)
            height = float(page.mediabox.height)
            overlay_path = Path(tmp) / f"stamp-{index}.pdf"
            layer = canvas.Canvas(str(overlay_path), pagesize=(width, height))
            layer.setStrokeColor(HexColor("#d6dbe2"))
            layer.setLineWidth(0.4)
            layer.line(50, 40, width - 50, 40)
            layer.setFillColor(HexColor("#6a7480"))
            layer.setFont("Helvetica", 7.5)
            layer.drawString(50, 28, footer_left)
            layer.drawRightString(width - 50, 28, footer_right)
            layer.setFillColor(HexColor("#1b1d21"))
            layer.setFont("Helvetica", 8)
            layer.drawCentredString(width / 2, 28, f"Página {index} de {total}")
            layer.save()
            page.merge_page(PdfReader(str(overlay_path)).pages[0])
        output = Path(tmp) / "final.pdf"
        with output.open("wb") as handle:
            writer.write(handle)
        shutil.move(str(output), str(pdf_path))
    return total


def export(source: Path, target: Path | None = None) -> Path:
    text = source.read_text(encoding="utf-8")
    meta, body_md = parse_front_matter(text)
    html = render_html(source, meta, body_md)
    target = target or source.with_suffix(".pdf")
    html_path = source.with_suffix(".export.html")
    html_path.write_text(html, encoding="utf-8")
    chrome = find_chrome()
    started = time.time()
    try:
        print_pdf(chrome, html_path, target)
    finally:
        html_path.unlink(missing_ok=True)
    total = stamp_pages(target, meta.get("title", source.stem), meta)
    size_kb = target.stat().st_size / 1024
    print(f"{target.relative_to(DOCS_DIR.parent)}: {total} paginas, {size_kb:.0f} KB, {time.time() - started:.1f} s")
    return target


def main() -> int:
    parser = argparse.ArgumentParser(description="Exporta Markdown de docs/ a PDF.")
    parser.add_argument("files", nargs="*", help="Archivos .md (o .pdf de salida opcional tras cada .md)")
    parser.add_argument("--all", action="store_true", help="Exporta los documentos de evidencia")
    args = parser.parse_args()
    if args.all:
        names = ["inception", "daily-scrum", "evidencias", "sprint-planning", "sprint-review"]
        for name in names:
            export(DOCS_DIR / f"{name}.md")
        return 0
    pending = list(args.files)
    while pending:
        source = Path(pending.pop(0))
        if not source.is_absolute():
            source = (Path.cwd() / source).resolve()
        target = None
        if pending and pending[0].lower().endswith(".pdf"):
            target = Path(pending.pop(0))
            if not target.is_absolute():
                target = (Path.cwd() / target).resolve()
        export(source, target)
    return 0


if __name__ == "__main__":
    sys.exit(main())
