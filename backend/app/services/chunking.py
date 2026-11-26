import re


def estimate_tokens(text: str) -> int:
    """Fast whitespace/subword token count approximation."""
    if not text:
        return 0
    return max(1, len(re.findall(r"\w+|[^\w\s]", text, flags=re.UNICODE)))


def _split_paragraphs_with_overlap(
    text: str,
    max_tokens: int = 450,
    overlap_tokens: int = 75,
) -> list[str]:
    """Split text on paragraph/sentence boundaries while respecting token budgets and overlap."""
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    if not paragraphs:
        return []

    # Break any oversized paragraph into sentences
    units: list[str] = []
    for para in paragraphs:
        if estimate_tokens(para) <= max_tokens:
            units.append(para)
        else:
            sentences = [s.strip() for s in re.split(r"(?<=[.!?।])\s+", para) if s.strip()]
            units.extend(sentences if sentences else [para])

    chunks: list[str] = []
    current_units: list[str] = []
    current_tokens = 0

    for unit in units:
        unit_tokens = estimate_tokens(unit)
        if current_units and current_tokens + unit_tokens > max_tokens:
            chunks.append("\n\n".join(current_units))
            # Retain trailing units up to overlap_tokens
            overlap_buf: list[str] = []
            overlap_count = 0
            for prev in reversed(current_units):
                t = estimate_tokens(prev)
                if overlap_count + t > overlap_tokens:
                    break
                overlap_buf.insert(0, prev)
                overlap_count += t
            current_units = overlap_buf
            current_tokens = overlap_count

        current_units.append(unit)
        current_tokens += unit_tokens

    if current_units:
        chunks.append("\n\n".join(current_units))

    return chunks


def create_chunks(
    page_records: list[dict],
    max_tokens: int = 450,
    overlap_tokens: int = 75,
) -> list[dict]:
    """
    Create structure-aware chunks from extracted page records,
    preserving page_number, section_title, extraction_method, and token_count.
    """
    results: list[dict] = []
    for page in page_records:
        text = (page.get("text") or "").strip()
        if not text:
            continue
        split_texts = _split_paragraphs_with_overlap(
            text, max_tokens=max_tokens, overlap_tokens=overlap_tokens
        )
        for idx, chunk_text in enumerate(split_texts):
            results.append(
                {
                    "page_number": page["page_number"],
                    "chunk_index": idx,
                    "section_title": page.get("section_title", ""),
                    "extraction_method": page.get("extraction_method", "native_text"),
                    "text": chunk_text,
                    "token_count": estimate_tokens(chunk_text),
                }
            )
    return results
