import re


PRONOUN_PATTERNS = re.compile(
    r"\b(it|its|they|them|their|this|that|these|those|the first one|the second one|he|she)\b",
    flags=re.IGNORECASE,
)


def rewrite_query(question: str, recent_messages: list[dict] | None = None) -> str:
    """
    Produce a retrieval-optimized search query without silently altering user intent.
    Resolves anaphoric references using the previous user/assistant turn when present.
    """
    cleaned = question.strip()
    if not recent_messages:
        return cleaned

    if PRONOUN_PATTERNS.search(cleaned):
        # Extract topic keywords from the most recent user question
        prev_user_msgs = [m["content"] for m in recent_messages if m.get("role") == "user"]
        if prev_user_msgs:
            last_q = prev_user_msgs[-1].strip()
            if last_q and last_q.lower() != cleaned.lower():
                return f"{cleaned} (context: {last_q[:160]})"

    return cleaned
