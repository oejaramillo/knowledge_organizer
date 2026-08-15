# ============================================================================
# AI ENRICHMENT PIPELINE - RESPONSE PARSER
# ============================================================================
# This module parses and validates raw JSON responses from AI providers,
# converting them into clean, database-ready Python dictionaries.
#
# KEY RESPONSIBILITIES:
# 1. Parse JSON responses (handling markdown fences)
# 2. Validate response structure and required fields
# 3. Clean and normalize data types for database insertion
# 4. Validate field values against allowed constants
# 5. Provide safe type conversion with fallbacks
#
# ERROR HANDLING:
# - Gracefully handle malformed JSON responses
# - Validate all enum/choice fields against allowed values
# - Provide safe defaults for missing or invalid data
# - Convert types safely with appropriate fallbacks
# ============================================================================

import json


class ParseError(Exception):
    """
    Custom exception for AI response parsing failures.
    
    Raised when AI responses cannot be parsed due to:
    - Invalid JSON format
    - Missing required fields
    - Malformed response structure
    """
    pass


def parse_response(raw: str) -> dict:
    """
    Parse AI provider's raw response string into structured Python dict.
     - Fully AI - 
    Handles common issues with AI-generated JSON responses:
    - Markdown code fence wrapping (```json ... ```)
    - Extra whitespace and formatting issues
    - Missing required top-level keys
    
    Args:
        raw (str): Raw response string from AI provider
    
    Returns:
        dict: Parsed and validated response with required structure
    
    Raises:
        ParseError: If JSON is invalid or missing required keys
    
    Expected Response Structure:
        {
            "paper_meta": {...},
            "claims": [...],
            "concepts": [...], 
            "methods": [...],
            "variables": [...]
        }
    """
    text = raw.strip()

    # ── HANDLE MARKDOWN CODE FENCES ──────────────────────────────────────────
    # AI models sometimes wrap JSON in markdown code blocks
    # Remove these fences to get clean JSON
    if text.startswith("```"):
        lines = text.splitlines()
        # Filter out lines that are just markdown fences
        inner = [
            line for line in lines
            if not line.strip().startswith("```")
        ]
        text = "\n".join(inner).strip()

    # ── JSON PARSING ──────────────────────────────────────────────────────────
    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        # Provide helpful error with truncated raw response for debugging
        raise ParseError(f"AI returned invalid JSON: {exc}\n\nRaw:\n{raw[:500]}")

    # ── VALIDATE REQUIRED STRUCTURE ──────────────────────────────────────────
    # Ensure all required top-level keys are present
    required = {"paper_meta", "claims", "concepts", "methods", "variables"}
    missing = required - set(data.keys())
    if missing:
        raise ParseError(f"AI response missing keys: {missing}")

    return data


# ── SAFE TYPE CONVERSION UTILITIES ─────────────────────────────────────────

def safe_str(value) -> str | None:
    """
    Safely convert value to string, handling None and empty strings.
    
    Args:
        value: Any value to convert
        
    Returns:
        str | None: Clean string or None if empty/null
    """
    if value is None:
        return None
    s = str(value).strip()
    return s if s else None


def safe_float(value) -> float | None:
    """
    Safely convert value to float, returning None for invalid values.
    
    Args:
        value: Any value to convert
        
    Returns:
        float | None: Float value or None if conversion fails
    """
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def safe_int(value) -> int | None:
    """
    Safely convert value to integer, returning None for invalid values.
    
    Args:
        value: Any value to convert
        
    Returns:
        int | None: Integer value or None if conversion fails
    """
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def safe_list(value) -> list:
    """
    Safely convert value to list of strings, filtering out None values.
    
    Args:
        value: Any value to convert (expected to be list)
        
    Returns:
        list: Clean list of strings, empty list if input invalid
    """
    if isinstance(value, list):
        return [str(v) for v in value if v is not None]
    return []


# ── VALIDATION CONSTANTS ───────────────────────────────────────────────────
# These constants define allowed values for various fields to ensure
# database consistency and enable proper filtering/analysis based in my experience and field

VALID_CLAIM_TYPES = {
    "empirical",        # Quantitative findings and statistical results
    "theoretical",      # Formal model propositions and theoretical predictions
    "conceptual",       # Definitions, frameworks, and conceptual arguments
    "historical",       # Historical interpretations and contextual claims
    "normative",        # Value judgments and policy recommendations
    "methodological",   # Arguments about research design and methodology
}

VALID_DIRECTIONS = {
    "positive",    # Positive effect or relationship
    "negative",    # Negative effect or relationship  
    "null",        # No significant effect
    "mixed",       # Mixed or conditional effects
    "unclear",     # Ambiguous or uncertain direction
}

VALID_PARADIGMS = {
    "quantitative",   # Statistical and econometric approaches
    "qualitative",    # Interpretive and ethnographic approaches
    "theoretical",    # Formal modeling and axiomatic approaches
    "mixed",          # Combined quantitative and qualitative methods
    "historical",     # Historical and archival approaches
    "philosophical",  # Conceptual and normative analysis
}

VALID_CONCEPT_ROLES = {
    "introduces",       # Paper coins or first defines the concept
    "applies",          # Paper uses existing concept in analysis
    "critiques",        # Paper challenges or questions the concept
    "extends",          # Paper builds upon or expands the concept
    "operationalizes",  # Paper converts concept into measurable variables
}

VALID_VARIABLE_ROLES = {
    "outcome",      # Dependent variable being explained
    "treatment",    # Main independent variable of interest
    "control",      # Control variables for robustness
    "instrument",   # Instrumental variables for identification
    "moderator",    # Variables that modify treatment effects
    "mediator",     # Variables that explain causal mechanisms
}


# ── FIELD CLEANING AND VALIDATION FUNCTIONS ───────────────────────────────

def clean_claim(raw: dict) -> dict:
    """
    Clean and validate a single claim record from AI response.
    
    Claims are the core extracted knowledge from papers - empirical findings,
    theoretical propositions, or conceptual arguments.
    
    Args:
        raw (dict): Raw claim data from AI response
        
    Returns:
        dict: Cleaned claim ready for database insertion
    """
    # Validate and default claim type
    claim_type = safe_str(raw.get("claim_type")) or "empirical"
    if claim_type not in VALID_CLAIM_TYPES:
        claim_type = "empirical"

    # Validate direction for empirical/theoretical claims
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
    """
    Clean and validate a single concept record from AI response.
    
    Concepts represent theoretical constructs, definitions, and frameworks
    used in academic discourse across disciplines.
    
    Args:
        raw (dict): Raw concept data from AI response
        
    Returns:
        dict: Cleaned concept ready for database insertion
    """
    # Validate and default concept role
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
    """
    Clean and validate a single method record from AI response.
    
    Methods represent research methodologies, analytical techniques,
    and empirical approaches used across research paradigms.
    
    Args:
        raw (dict): Raw method data from AI response
        
    Returns:
        dict: Cleaned method ready for database insertion
    """
    # Validate paradigm classification
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
    """
    Clean and validate a single variable record from AI response.
    
    Variables represent quantitative measures and operationalized
    concepts used in empirical research.
    
    Args:
        raw (dict): Raw variable data from AI response
        
    Returns:
        dict: Cleaned variable ready for database insertion
    """
    # Validate and default variable role
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
    """
    Clean and validate paper metadata from AI response.
    
    Paper metadata includes disciplinary classification, theoretical
    frameworks, and citation context that provides high-level
    categorization for the paper.
    
    Args:
        raw (dict): Raw paper metadata from AI response
        
    Returns:
        dict: Cleaned metadata ready for database update
    """
    return {
        "discipline":           safe_list(raw.get("discipline")),
        "theoretical_framework":safe_str(raw.get("theoretical_framework")),
        "citation_intent":      safe_list(raw.get("citation_intent")),
        "language":             safe_str(raw.get("language")) or "en",
    }