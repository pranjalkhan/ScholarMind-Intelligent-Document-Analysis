import io
import logging
from PIL import Image

logger = logging.getLogger(__name__)


def run_ocr_on_image_bytes(image_bytes: bytes, lang: str = "eng+ben") -> str:
    """Run Tesseract OCR on raw PNG/JPEG bytes. Falls back gracefully if Tesseract is missing."""
    try:
        import pytesseract

        image = Image.open(io.BytesIO(image_bytes))
        try:
            return pytesseract.image_to_string(image, lang=lang).strip()
        except pytesseract.TesseractError:
            # Fallback to English only if Bengali traineddata is not installed
            return pytesseract.image_to_string(image, lang="eng").strip()
    except Exception as exc:
        logger.warning("OCR skipped or unavailable: %s", exc)
        return ""
