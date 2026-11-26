import re


def clean_extracted_text(text: str) -> str:
    """
    Clean PDF-extracted text while preserving headings, numbered lists,
    mathematical symbols, table rows, and Bangla/Unicode characters.
    """
    if not text:
        return ""

    # Normalize line endings
    text = text.replace("\r\n", "\n").replace("\r", "\n")

    # Remove null bytes and non-printable control characters (keep \n and \t)
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)

    # De-hyphenate words split across line breaks (e.g. "knowl-\nedge" -> "knowledge")
    text = re.sub(r"([A-Za-z])-\n([a-z])", r"\1\2", text)

    lines = text.split("\n")
    cleaned_lines: list[str] = []
    for line in lines:
        stripped = line.strip()
        # Skip standalone page-number-only lines like "12" or "Page 12"
        if re.fullmatch(r"(?:page\s*)?\d{1,4}", stripped, flags=re.IGNORECASE):
            continue
        # Collapse excessive horizontal whitespace while keeping single spaces
        collapsed = re.sub(r"[ \t]{2,}", " ", line).rstrip()
        cleaned_lines.append(collapsed)

    result = "\n".join(cleaned_lines)
    # Collapse 3+ consecutive blank lines into 2
    result = re.sub(r"\n{3,}", "\n\n", result)
    return result.strip()
