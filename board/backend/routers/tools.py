"""Maintenance endpoints that drive the sync and enrichment CLIs.

Both handlers shell out to the repository scripts; the shared ``_run`` helper
keeps argument building, timeouts and error reporting identical for the two.
"""

import os
import re
import subprocess
import sys
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/tools", tags=["Tools"])

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../"))
ZOTERO_SYNC_DIR = os.path.join(ROOT, "zotero_sync")

SYNC_TIMEOUT_SECONDS = 300
ENRICH_TIMEOUT_SECONDS = 600

PROVIDERS = ("deepseek", "openai")
ZOTERO_KEY_RE = re.compile(r"^[A-Za-z0-9]{1,32}$")


class SyncOptions(BaseModel):
    force: bool = False


class EnrichOptions(BaseModel):
    full_text: bool = False
    force: bool = False
    dry_run: bool = False
    key: Optional[str] = None
    provider: Optional[str] = None


def _run(args: list[str], *, cwd: str, timeout: int, env: dict | None = None) -> dict:
    """Run a helper script and normalise the result for the dashboard."""
    try:
        result = subprocess.run(
            args,
            cwd=cwd,
            env=env,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
    except subprocess.TimeoutExpired:
        return {"ok": False, "output": "", "error": f"Timed out after {timeout}s"}
    except Exception as exc:  # noqa: BLE001 - surfaced to the dashboard
        return {"ok": False, "output": "", "error": str(exc)}

    return {"ok": result.returncode == 0, "output": result.stdout, "error": result.stderr}


@router.post("/zotero-sync")
def run_zotero_sync(opts: SyncOptions = SyncOptions()):
    args = [sys.executable, "sync.py"]
    if opts.force:
        args.append("--force")

    return _run(args, cwd=ZOTERO_SYNC_DIR, timeout=SYNC_TIMEOUT_SECONDS)


@router.post("/ai-enrichment")
def run_ai_enrichment(opts: EnrichOptions):
    if opts.provider and opts.provider not in PROVIDERS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown provider. Choose one of: {', '.join(PROVIDERS)}",
        )

    key = (opts.key or "").strip()
    if key and not ZOTERO_KEY_RE.match(key):
        raise HTTPException(status_code=400, detail="Invalid Zotero item key")

    args = [sys.executable, "-m", "ai_enrichments.enrich"]
    if opts.full_text:
        args.append("--full-text")
    if opts.force:
        args.append("--force")
    if opts.dry_run:
        args.append("--dry-run")
    if key:
        args += ["--key", key]
    if opts.provider:
        args += ["--provider", opts.provider]

    env = os.environ.copy()
    env["PYTHONPATH"] = ROOT  # ← ensures ai_enrichments is a discoverable package

    return _run(args, cwd=ROOT, timeout=ENRICH_TIMEOUT_SECONDS, env=env)
