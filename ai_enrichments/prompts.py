"""
All prompt templates live here.
Keeping prompts separate from logic makes them easy to tune
without touching any other file.
"""

SYSTEM_PROMPT = """\
You are a rigorous academic research assistant specializing in economics \
and social sciences. Your task is to analyze academic papers and extract \
structured knowledge from them.

You always respond with valid JSON only — no markdown, no explanation, \
no preamble. Your JSON must exactly match the schema provided in the user message.

Be precise, concise, and faithful to the source text. \
Never invent claims or concepts not present in the paper. \
When uncertain, use null rather than guessing.
"""


def build_user_prompt(
    title: str,
    abstract: str | None,
    authors: list[str],
    annotations: list[dict],
    pdf_text: str | None,
    max_claims: int,
) -> str:
    """
    Builds the user-facing prompt.
    pdf_text is None in annotation-driven mode.
    """

    # ── Paper header ──────────────────────────────────────────────────────────
    lines = [
        "## PAPER TO ANALYZE",
        f"**Title:** {title}",
        f"**Authors:** {', '.join(authors) if authors else 'Unknown'}",
        f"**Abstract:** {abstract or 'Not available'}",
        "",
    ]

    # ── Full text (Mode B) ────────────────────────────────────────────────────
    if pdf_text:
        lines += [
            "## FULL TEXT",
            pdf_text,
            "",
        ]

    # ── Annotations (both modes) ──────────────────────────────────────────────
    if annotations:
        lines.append("## RESEARCHER ANNOTATIONS (highlights and notes)")
        for i, ann in enumerate(annotations, 1):
            ann_type = ann.get("annotation_type", "highlight")
            page = ann.get("page_number")
            text = ann.get("highlight_text", "")
            note = ann.get("user_note", "")
            color = ann.get("color", "")

            parts = [f"{i}. [{ann_type.upper()}]"]
            if page:
                parts.append(f"p.{page}")
            if color:
                parts.append(f"({color})")
            if text:
                parts.append(f'"{text}"')
            if note:
                parts.append(f"[Note: {note}]")

            lines.append(" ".join(parts))
        lines.append("")

    # ── Output schema ─────────────────────────────────────────────────────────
    _schema_example = '''```json
{
  "paper_meta": {
    "discipline": ["economics", "sociology"],
    "theoretical_framework": "New Institutional Economics",
    "citation_intent": ["motivation", "theoretical_foundation"],
    "language": "en"
  },
  "claims": [
    {
      "claim_type": "empirical",
      "claim": "One declarative sentence summarizing the finding.",
      "quote": "Exact quote from the paper supporting this claim, or null.",
      "page_number": 12,
      "direction": "positive",
      "effect_size": "0.1 increase in wages",
      "population": "Urban workers in Ecuador",
      "period": "2005-2015",
      "confidence_level": 0.85,
      "logical_form": null,
      "scope_conditions": null,
      "historical_period": null,
      "geographic_scope": "Ecuador",
      "tags": ["wages", "labor market"]
    }
  ],
  "concepts": [
    {
      "name": "Double Movement",
      "definition": "Brief definition as used in this paper.",
      "origin": "Polanyi",
      "discipline": ["economics", "sociology"],
      "role": "applies",
      "context_note": "How this paper uses the concept."
    }
  ],
  "methods": [
    {
      "name": "Difference-in-Differences",
      "paradigm": "quantitative",
      "tradition": null,
      "category": "quasi-experimental",
      "context_note": "Used to estimate the effect of minimum wage on employment."
    }
  ],
  "variables": [
    {
      "name": "log hourly wage",
      "category": "outcome",
      "definition": "Natural log of hourly wage in constant 2010 USD.",
      "unit": "log USD",
      "role": "outcome"
    }
  ]
}
```'''  # safe: triple-backticks inside triple-single-quoted string

    _rules = (
        "Rules:\n"
        "- claim_type must be one of: empirical, theoretical, conceptual, historical, normative, methodological\n"
        "- direction must be one of: positive, negative, null, mixed, unclear — or null if not applicable\n"
        "- paradigm must be one of: quantitative, qualitative, theoretical, mixed, historical, philosophical\n"
        "- role (concept) must be one of: introduces, applies, critiques, extends, operationalizes\n"
        "- role (variable) must be one of: outcome, treatment, control, instrument, moderator, mediator\n"
        "- citation_intent values must be from: motivation, identification, data, robustness, mechanism,\n"
        "  comparison, theoretical_foundation, conceptual_definition, normative_benchmark,\n"
        "  historical_context, stylized_fact, disciplinary_bridge, methodological_critique\n"
        "- If a field is not applicable or unknown, use null — never omit the key.\n"
        "- concepts, methods, variables may be empty arrays [] if not applicable.\n"
    )

    lines += [
        "## REQUIRED OUTPUT",
        "Return a single JSON object with exactly this structure.",
        f"Extract up to {max_claims} claims.",
        "",
        _schema_example,
        "",
        _rules,
    ]

    return "\n".join(lines)