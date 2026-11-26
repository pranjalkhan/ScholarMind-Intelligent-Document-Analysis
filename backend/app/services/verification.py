import re


def _token_overlap_ratio(claim_text: str, evidence_text: str) -> float:
    c_tokens = {t.lower() for t in re.findall(r"\w+", claim_text, flags=re.UNICODE) if len(t) >= 2}
    e_tokens = {t.lower() for t in re.findall(r"\w+", evidence_text, flags=re.UNICODE) if len(t) >= 2}
    if not c_tokens:
        return 0.0
    return len(c_tokens & e_tokens) / len(c_tokens)


def verify_claims_and_detect_conflicts(
    validated_claims: list[dict],
    retrieved_chunks: list[dict],
    llm_conflicts: list[dict] | None = None,
) -> tuple[list[dict], bool, list[dict]]:
    """
    Verify each claim against its cited evidence passages.
    Returns (verified_claims, should_abstain, detected_conflicts).
    """
    chunk_map = {c["chunk_id"]: c for c in retrieved_chunks}
    verified: list[dict] = []
    supported_count = 0

    for claim in validated_claims:
        eids = claim.get("evidence_ids", [])
        if not eids:
            verified.append({**claim, "verification_status": "unsupported"})
            continue

        combined_evidence = " ".join(chunk_map[eid]["text"] for eid in eids if eid in chunk_map)
        overlap = _token_overlap_ratio(claim["claim_text"], combined_evidence)

        if overlap >= 0.35:
            status = "supported"
            supported_count += 1
        elif overlap >= 0.18:
            status = "partially_supported"
            supported_count += 1
        else:
            status = "unsupported"

        verified.append({**claim, "verification_status": status})

    # Detect numeric/factual conflicts across different documents
    conflicts: list[dict] = list(llm_conflicts or [])
    if not conflicts and len({c["document_id"] for c in retrieved_chunks}) >= 2:
        conflicts.extend(_heuristic_numeric_conflict_check(retrieved_chunks))

    should_abstain = len(verified) > 0 and supported_count == 0
    return verified, should_abstain, conflicts


def _heuristic_numeric_conflict_check(chunks: list[dict]) -> list[dict]:
    """
    Lightweight conflict detector: flags when two different documents report
    different numbers alongside shared domain keywords in top retrieved chunks.
    """
    by_doc: dict[str, list[dict]] = {}
    for ch in chunks:
        by_doc.setdefault(ch["document_id"], []).append(ch)

    doc_ids = list(by_doc.keys())
    if len(doc_ids) < 2:
        return []

    conflicts: list[dict] = []
    ch_a = by_doc[doc_ids[0]][0]
    ch_b = by_doc[doc_ids[1]][0]

    nums_a = set(re.findall(r"\b\d+(?:\.\d+)?%?\b", ch_a["text"]))
    nums_b = set(re.findall(r"\b\d+(?:\.\d+)?%?\b", ch_b["text"]))
    toks_a = {t.lower() for t in re.findall(r"[A-Za-z]{4,}", ch_a["text"])}
    toks_b = {t.lower() for t in re.findall(r"[A-Za-z]{4,}", ch_b["text"])}

    shared_terms = toks_a & toks_b
    if len(shared_terms) >= 3 and nums_a and nums_b and nums_a != nums_b:
        # Only flag if both chunks share a strong subject overlap and have differing numbers
        diff_a = sorted(nums_a - nums_b)[:2]
        diff_b = sorted(nums_b - nums_a)[:2]
        if diff_a and diff_b:
            conflicts.append(
                {
                    "subject": ", ".join(sorted(shared_terms)[:3]),
                    "source_a": f"{ch_a.get('filename', 'Doc A')} (p.{ch_a['page_number']})",
                    "statement_a": ch_a["text"][:200],
                    "source_b": f"{ch_b.get('filename', 'Doc B')} (p.{ch_b['page_number']})",
                    "statement_b": ch_b["text"][:200],
                }
            )
    return conflicts
