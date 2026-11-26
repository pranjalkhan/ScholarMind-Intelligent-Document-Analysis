def validate_and_resolve_citations(
    raw_claims: list[dict],
    retrieved_chunks: list[dict],
) -> list[dict]:
    """
    Verify that every evidence_id returned by the LLM actually exists in the
    retrieved candidate set. Never trust LLM-generated page numbers or filenames;
    always resolve metadata from the database/retrieved chunk records.
    """
    chunk_map = {c["chunk_id"]: c for c in retrieved_chunks}
    validated_claims: list[dict] = []

    for claim in raw_claims:
        claim_text = (claim.get("text") or "").strip()
        if not claim_text:
            continue

        raw_ids = claim.get("evidence_ids") or []
        valid_ids: list[str] = []
        resolved_citations: list[dict] = []

        for eid in raw_ids:
            if eid in chunk_map and eid not in valid_ids:
                valid_ids.append(eid)
                ch = chunk_map[eid]
                resolved_citations.append(
                    {
                        "document_id": ch["document_id"],
                        "chunk_id": ch["chunk_id"],
                        "filename": ch.get("filename", "document.pdf"),
                        "page_number": ch["page_number"],
                        "section_title": ch.get("section_title", ""),
                        "quote": ch["text"][:320],
                    }
                )

        validated_claims.append(
            {
                "claim_text": claim_text,
                "evidence_ids": valid_ids,
                "citations": resolved_citations,
            }
        )

    return validated_claims
