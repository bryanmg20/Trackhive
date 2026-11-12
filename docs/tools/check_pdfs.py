"""Verifica los PDF generados: portada, indice, paginacion y enlaces activos.

Uso:
    python docs/tools/check_pdfs.py
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

from pypdf import PdfReader

DOCS_DIR = Path(__file__).resolve().parents[1]
DOCUMENTS = ["inception", "daily-scrum", "evidencias", "sprint-planning", "sprint-review"]


def compact(text: str) -> str:
    return re.sub(r"\s+", "", text).lower()


def urls_in_pdf(reader: PdfReader) -> set[str]:
    found: set[str] = set()
    for page in reader.pages:
        annots = page.get("/Annots")
        if not annots:
            continue
        for annot in annots:
            obj = annot.get_object()
            if obj.get("/Subtype") != "/Link":
                continue
            action = obj.get("/A") or {}
            uri = action.get_object().get("/URI") if hasattr(action, "get_object") else None
            if uri:
                found.add(str(uri))
    return found


def images_in_pdf(reader: PdfReader) -> int:
    total = 0
    for page in reader.pages:
        resources = page.get("/Resources") or {}
        xobjects = resources.get("/XObject")
        if xobjects:
            for obj in xobjects.get_object().values():
                if obj.get_object().get("/Subtype") == "/Image":
                    total += 1
    return total


def check(name: str) -> list[str]:
    problems: list[str] = []
    pdf = DOCS_DIR / f"{name}.pdf"
    md = DOCS_DIR / f"{name}.md"
    if not pdf.exists():
        return [f"{name}: falta {pdf.name}"]
    reader = PdfReader(str(pdf))
    pages = [page.extract_text() or "" for page in reader.pages]
    if len(pages) < 3:
        problems.append(f"{name}: solo {len(pages)} paginas")
    first = compact(pages[0])
    for keyword in ("universidaddelnorte", "trackhive", "fecha", "versión"):
        if keyword not in first:
            problems.append(f"{name}: portada sin '{keyword}'")
    if "contenido" not in compact(pages[1]):
        problems.append(f"{name}: pagina 2 sin indice")
    footer_ok = any(re.search(r"P[aá]gina\s*2\s*de\s*\d+", page) for page in pages[1:2])
    if not footer_ok:
        problems.append(f"{name}: pagina 2 sin numeracion")
    expected = set(re.findall(r"https://[^\s<>|)]+", md.read_text(encoding="utf-8")))
    expected = {url.rstrip(".,;") for url in expected}
    found = urls_in_pdf(reader)
    missing = {url for url in expected if url not in found}
    if missing:
        problems.append(f"{name}: {len(missing)} enlaces sin anotacion activa, p. ej. {sorted(missing)[0][:70]}")
    extra = f", {len(found)} enlaces activos"
    if images_in_pdf(reader):
        extra += f", {images_in_pdf(reader)} imagen(es)"
    print(f"OK {name}: {len(pages)} paginas{extra}")
    return problems


def main() -> int:
    problems: list[str] = []
    for name in DOCUMENTS:
        problems.extend(check(name))
    if problems:
        print("\nPROBLEMAS:")
        for problem in problems:
            print(f"- {problem}")
        return 1
    print("\nTodos los PDF cumplen portada, indice, paginacion y enlaces.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
