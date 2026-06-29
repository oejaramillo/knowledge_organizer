"""
Parses the raw JSON string returned by the AI provider
into clean Python dicts ready for the database writer.
"""

import json


class ParseError(Exception):
    pass


def parse_response(raw: str) -> dict:
    """
    Parses the AI's JSON response.
    Handles the case where the model wraps JSON in markdown fences.
    """
    text = raw.strip()

    # Strip markdown code fences if present
    if text.startswith("```"):
        lines = text.splitlines()
        # Remove first and last fence lines
        inner = [
            line for line in lines
            if not line.strip().startswith("```")
        ]
        text = "\n".join(inner).strip()

    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        raise ParseError(f"AI returned invalid JSON: {exc}\n\nRaw:\n{raw[:500]}")

    # Validate top-level keys
    required = {"paper_meta", "claims", "concepts", "methods", "variables"}
    missing = required - set(data.keys())
    if missing:
        raise ParseError(f"AI response missing keys: {missing}")

    return data


def safe_str(value) -> str | None:
    if value is None:
        return None
    s = str(value).strip()
    return s if s else None


def safe_float(value) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def safe_int(value) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def safe_list(value) -> list:
    if isinstance(value, list):
        return [str(v) for v in value if v is not None]
    return []


VALID_CLAIM_TYPES = {
    "empirical", "theoretical", "conceptual",
    "historical", "normative", "methodological",
}

VALID_DIRECTIONS = {
    "positive", "negative", "null", "mixed", "unclear",
}

VALID_PARADIGMS = {
    "quantitative", "qualitative", "theoretical",
    "mixed", "historical", "philosophical",
}

VALID_CONCEPT_ROLES = {
    "introduces", "applies", "critiques", "extends", "operationalizes",
}

VALID_VARIABLE_ROLES = {
    "outcome", "treatment", "control",
    "instrument", "moderator", "mediator",
}


def clean_claim(raw: dict) -> dict:
    claim_type = safe_str(raw.get("claim_type")) or "empirical"
    if claim_type not in VALID_CLAIM_TYPES:
        claim_type = "empirical"

    direction = safe_str(raw.get("direction"))
    if direction not in VALID_DIRECTIONS:
        direction = None

    return {
        "claim_type":       claim_type,
        "claim":            safe_str(raw.get("claim")),
        "quote":            safe_str(raw.get("quote")),
        "page_number":      safe_int(raw.get("page_number")),
        "direction":        direction,
        "effect_size":      safe_str(raw.get("effect_size")),
        "population":       safe_str(raw.get("population")),
        "period":           safe_str(raw.get("period")),
        "confidence_level": safe_float(raw.get("confidence_level")),
        "logical_form":     safe_str(raw.get("logical_form")),
        "scope_conditions": safe_str(raw.get("scope_conditions")),
        "historical_period":safe_str(raw.get("historical_period")),
        "geographic_scope": safe_str(raw.get("geographic_scope")),
        "tags":             safe_list(raw.get("tags")),
    }


def clean_concept(raw: dict) -> dict:
    role = safe_str(raw.get("role")) or "applies"
    if role not in VALID_CONCEPT_ROLES:
        role = "applies"

    return {
        "name":         safe_str(raw.get("name")),
        "definition":   safe_str(raw.get("definition")),
        "origin":       safe_str(raw.get("origin")),
        "discipline":   safe_list(raw.get("discipline")),
        "role":         role,
        "context_note": safe_str(raw.get("context_note")),
    }


def clean_method(raw: dict) -> dict:
    paradigm = safe_str(raw.get("paradigm"))
    if paradigm not in VALID_PARADIGMS:
        paradigm = None

    return {
        "name":         safe_str(raw.get("name")),
        "paradigm":     paradigm,
        "tradition":    safe_str(raw.get("tradition")),
        "category":     safe_str(raw.get("category")),
        "context_note": safe_str(raw.get("context_note")),
    }


def clean_variable(raw: dict) -> dict:
    role = safe_str(raw.get("role"))
    if role not in VALID_VARIABLE_ROLES:
        role = "outcome"

    return {
        "name":       safe_str(raw.get("name")),
        "category":   safe_str(raw.get("category")),
        "definition": safe_str(raw.get("definition")),
        "unit":       safe_str(raw.get("unit")),
        "role":       role,
    }


def clean_paper_meta(raw: dict) -> dict:
    return {
        "discipline":           safe_list(raw.get("discipline")),
        "theoretical_framework":safe_str(raw.get("theoretical_framework")),
        "citation_intent":      safe_list(raw.get("citation_intent")),
        "language":             safe_str(raw.get("language")) or "en",
    }