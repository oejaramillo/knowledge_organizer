"""Small helpers shared by the ``sync_*`` modules.

Every sync step used to repeat the same "which mode are we in?" block. Keeping
it in one place means the wording of the sync log stays consistent across steps.
"""


def sync_label(since=None, since_date=None) -> str:
    """Human-readable description of the current sync mode."""
    if since is not None:
        return f"(incremental since v{since})"
    if since_date is not None:
        return f"(incremental since {since_date})"
    return "(full sync)"


def announce(step: str, since=None, since_date=None) -> str:
    """Print the standard step banner and return the mode label."""
    label = sync_label(since, since_date)
    print(f"Syncing {step}... {label}")
    return label


__all__ = ["sync_label", "announce"]
