from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
import subprocess, sys, os

router = APIRouter(prefix="/api/tools", tags=["Tools"])
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../"))

class SyncOptions(BaseModel):
    force: bool = False

@router.post("/zotero-sync")
def run_zotero_sync(opts: SyncOptions):
    args = [sys.executable, "sync.py"]
    if opts.force:
        args.append("--force")
    try:
        result = subprocess.run(
            args,
            cwd=os.path.join(ROOT, "zotero_sync"),
            capture_output=True, text=True, timeout=300,
        )
        return { "ok": result.returncode == 0, "output": result.stdout, "error": result.stderr }
    except Exception as e:
        return { "ok": False, "error": str(e) }

class EnrichOptions(BaseModel):
    full_text: bool = False
    force: bool = False
    dry_run: bool = False
    key: Optional[str] = None
    provider: Optional[str] = None

@router.post("/ai-enrichment")
def run_ai_enrichment(opts: EnrichOptions):
    args = [sys.executable, "-m", "ai_enrichments.enrich"]
    if opts.full_text: args.append("--full-text")
    if opts.force:     args.append("--force")
    if opts.dry_run:   args.append("--dry-run")
    if opts.key:       args += ["--key", opts.key]
    if opts.provider:  args += ["--provider", opts.provider]

    env = os.environ.copy()
    env["PYTHONPATH"] = ROOT  # ← ensures ai_enrichments is a discoverable package

    try:
        result = subprocess.run(
            args,
            cwd=ROOT,           # ← run from the root, not inside ai_enrichments
            env=env,            # ← inject PYTHONPATH
            capture_output=True, text=True, timeout=600,
        )
        return { "ok": result.returncode == 0, "output": result.stdout, "error": result.stderr }
    except Exception as e:
        return { "ok": False, "error": str(e) }