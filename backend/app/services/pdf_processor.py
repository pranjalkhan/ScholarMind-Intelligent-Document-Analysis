import re
from pathlib import Path
import fitz  # PyMuPDF

from app.services.ocr_service import run_ocr_on_image_bytes
from app.services.text_cleaner import clean_extracted_text

MIN_NATIVE_TEXT_CHARS = 30


def _detect_section_title(text: str, fallback: str = "") -> str:
    """Heuristically extract the most likely heading from the top of a page."""
    for line in text.splitlines():
        s = line.strip()
        if not s or len(s) > 100:
            continue
        if re.match(r"^(\d+(\.\d+)*\.?\s+)?[A-Z][A-Za-z0-9\s,:\-()]{2,80}$", s):
            return s
        if s.isupper() and 3 <= len(s) <= 80:
            return s.title()
    return fallback


def extract_pdf_pages(file_path: str | Path) -> list[dict]:
    """
    Extract text page-by-page using PyMuPDF.
    If a page has fewer than MIN_NATIVE_TEXT_CHARS characters, render it and run OCR.
    Preserves page_number, section_title, and extraction_method.
    """
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"PDF not found: {path}")

    doc = fitz.open(str(path))
    pages: list[dict] = []
    current_section = ""

    try:
        for page_index, page in enumerate(doc):
            raw_text = page.get_text("text") or ""
            cleaned = clean_extracted_text(raw_text)
            extraction_method = "native_text"

            if len(cleaned) < MIN_NATIVE_TEXT_CHARS:
                # Likely a scanned image page; render at 200 DPI and run OCR
                pix = page.get_pixmap(dpi=200)
                ocr_text = run_ocr_on_image_bytes(pix.tobytes("png"))
                ocr_cleaned = clean_extracted_text(ocr_text)
                if len(ocr_cleaned) > len(cleaned):
                    cleaned = ocr_cleaned
                    extraction_method = "ocr"

            current_section = _detect_section_title(cleaned, fallback=current_section)
            pages.append(
                {
                    "page_number": page_index + 1,
                    "text": cleaned,
                    "section_title": current_section,
                    "extraction_method": extraction_method,
                }
            )
    finally:
        doc.close()

    return pages
