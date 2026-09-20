"""Bind the website to a writable Maximor runtime. Never mutate data/demo."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from demo.reset import DEFAULT_RUNTIME, reset_demo_runtime
from evaluation.context import isolate_run_stores
from sample_data.paths import apply_data_root, drain_data_root_stack

REPO = Path(__file__).resolve().parent.parent
CANONICAL = REPO / "data" / "demo"

_STATE: dict[str, Any] = {
    "bound": False,
    "canonical": CANONICAL,
    "runtime": DEFAULT_RUNTIME,
    "run_dir": DEFAULT_RUNTIME / "runs",
}

REQUIRED_RUNTIME_FILES = (
    ("company.json",),
    ("invoices.json",),
    ("ingestion", "emails.json"),
)


def runtime_pack_ready(path: Path) -> bool:
    root = Path(path)
    return all((root.joinpath(*parts)).is_file() for parts in REQUIRED_RUNTIME_FILES)


def canonical_root() -> Path:
    return Path(_STATE["canonical"])


def runtime_root() -> Path:
    return Path(_STATE["runtime"])


def run_dir() -> Path:
    return Path(_STATE["run_dir"])


def website_dir() -> Path:
    path = run_dir() / "website"
    path.mkdir(parents=True, exist_ok=True)
    return path


def activity_path() -> Path:
    return website_dir() / "activity.jsonl"


def results_dir() -> Path:
    path = website_dir() / "results"
    path.mkdir(parents=True, exist_ok=True)
    return path


def live_llm_requested() -> bool:
    flag = os.environ.get("DEMO_LIVE_LLM", "").strip().lower()
    return flag in {"1", "true", "yes"} and bool(os.environ.get("OPENAI_API_KEY"))


def llm_available() -> bool:
    return bool(os.environ.get("OPENAI_API_KEY"))


def stripe_status() -> dict:
    from integrations.providers.base import env, live_mode
    from integrations.providers.stripe import live_mode as stripe_live

    mode = env("STRIPE_MODE", "mock") or "mock"
    return {
        "mode": "live" if stripe_live() else "simulated",
        "stripe_mode_env": mode,
        "integrations_live": live_mode(),
        "credentials_configured": bool(env("STRIPE_SECRET_KEY")),
        "note": "Simulated Stripe fixtures are the demo default. Live mode requires STRIPE_MODE=live and keys.",
    }


def _isolate_extra_stores(directory: Path) -> None:
    from accrual.ledger import configure_paths as configure_accrual
    from bs_recon.store import configure_paths as configure_recon
    from close.context import configure_paths as configure_ctx
    from close.ledger import configure_paths as configure_gl
    from inbox.store import configure_runs_dir
    from invoice_ingestion.registry import configure_paths as configure_registry
    from tools import configure_runtime_dir

    isolate_run_stores(directory)
    import scheduling.pool as sched_pool
    from tools import DATA_DIR

    sched_pool.POOL_PATH = Path(DATA_DIR) / "approved_pool.json"
    configure_runtime_dir(directory / "overlay")
    configure_registry(directory / "ingestion_registry")
    configure_runs_dir(directory / "inbox")
    configure_gl(directory / "gl")
    configure_ctx(directory / "identity")
    configure_recon(directory / "bs_recon")
    configure_accrual(directory / "accruals")


def bind_workspace(canonical: Path | None = None, runtime: Path | None = None, *, reset: bool = False) -> Path:
    target_canonical = Path(canonical or _STATE["canonical"] or CANONICAL)
    target_runtime = Path(runtime or _STATE["runtime"] or DEFAULT_RUNTIME)
    if _STATE["bound"] and not reset and target_runtime == _STATE["runtime"]:
        return target_runtime
    if _STATE["bound"]:
        drain_data_root_stack()
    if reset or not runtime_pack_ready(target_runtime):
        reset_demo_runtime(target_runtime, source=target_canonical)
    apply_data_root(target_runtime)
    runs = target_runtime / "runs"
    runs.mkdir(parents=True, exist_ok=True)
    _isolate_extra_stores(runs)
    _STATE.update(
        {
            "bound": True,
            "canonical": target_canonical,
            "runtime": target_runtime,
            "run_dir": runs,
        }
    )
    (runs / "website").mkdir(parents=True, exist_ok=True)
    return target_runtime


def reset_workspace() -> Path:
    from ar.store import reset_state as reset_ar
    from cash_recon.store import reset_cash_state
    from inbox.store import reset_inbox_state
    from integrations.store import reset_integration_state
    from invoice_ingestion.adapter import reset_ingested_invoices
    from memory.store import reset_memory
    from tools import reset_runtime_invoices

    dest = reset_demo_runtime(runtime_root(), source=canonical_root())
    drain_data_root_stack()
    _STATE["bound"] = False
    bind_workspace(canonical_root(), dest, reset=False)
    reset_ar()
    reset_cash_state()
    reset_inbox_state()
    reset_ingested_invoices()
    reset_runtime_invoices()
    reset_integration_state()
    reset_memory()
    activity = activity_path()
    if activity.exists():
        activity.unlink()
    for path in results_dir().glob("*.json"):
        path.unlink()
    return dest


def shutdown_workspace() -> None:
    if _STATE["bound"]:
        drain_data_root_stack()
    _STATE["bound"] = False


def status_payload() -> dict:
    stripe = stripe_status()
    return {
        "company": "Maximor Demo Corp",
        "company_id": "CO-MAXIMOR",
        "period": "2026-09",
        "canonical": str(canonical_root()),
        "runtime": str(runtime_root()),
        "run_dir": str(run_dir()),
        "bound": bool(_STATE["bound"]),
        "autonomy": {
            "model": "office-completes-work",
            "human_in_completion_path": False,
            "verifiers": ["ctl-pay", "ctl-cash", "ctl-books"],
            "llm_available": llm_available(),
            "live_llm": live_llm_requested(),
            "execution": "live-llm" if live_llm_requested() else "kernel-deterministic",
        },
        "stripe": stripe,
        "system_status": "operational",
        "agent_architecture": "15-bot grain",
    }
