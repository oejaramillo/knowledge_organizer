"""Claim-related SQL queries (parameterized)."""

# Columns that may be written via create/update.
CLAIM_FIELDS = [
    "claim_type", "claim", "page_number", "quote", "tags", "direction",
    "effect_size", "population", "period", "confidence_level", "logical_form",
    "scope_conditions", "historical_period", "geographic_scope",
]


def create_claim(cur, paper_id, fields: dict):
    cols = ["paper_id"]
    vals = [paper_id]
    for key in CLAIM_FIELDS:
        if key in fields:
            cols.append(key)
            vals.append(fields[key])
    placeholders = ", ".join(["%s"] * len(vals))
    cur.execute(
        f"INSERT INTO claims ({', '.join(cols)}) VALUES ({placeholders}) RETURNING *",
        vals,
    )
    return cur.fetchone()


def get_claim(cur, claim_id):
    cur.execute("SELECT * FROM claims WHERE claim_id = %s", (claim_id,))
    return cur.fetchone()


def update_claim(cur, claim_id, fields: dict):
    sets, params = [], []
    for key in CLAIM_FIELDS:
        if key in fields:
            sets.append(f"{key} = %s")
            params.append(fields[key])
    if not sets:
        return get_claim(cur, claim_id)
    params.append(claim_id)
    cur.execute(
        f"UPDATE claims SET {', '.join(sets)} WHERE claim_id = %s RETURNING *",
        params,
    )
    return cur.fetchone()
