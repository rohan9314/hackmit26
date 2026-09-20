"""Demo website HTTP API. Thin wrapper over Kernel workflows and Maximor files."""

from __future__ import annotations

from pathlib import Path

from fastapi import Body, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from demo_web import artifacts, scenarios, views, workflows
from demo_web.bots import architecture_payload
from demo_web.workspace import bind_workspace, reset_workspace, status_payload, stripe_status

GIT_ROOT = Path(__file__).resolve().parent.parent.parent
WEB_DIST = GIT_ROOT / "web" / "dist"


def create_app(canonical: Path | None = None, runtime: Path | None = None) -> FastAPI:
    bind_workspace(canonical, runtime)
    app = FastAPI(title="Maximor Office of the CFO", docs_url="/api/docs", redoc_url=None)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://127.0.0.1:5173",
            "http://localhost:5173",
            "http://127.0.0.1:4173",
            "http://localhost:4173",
        ],
        allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
        allow_methods=["*"],
        allow_headers=["*"],
    )

    def health_payload() -> dict:
        return {
            "ok": True,
            "product": "Autonomous Office of the CFO",
            "company": "Maximor Demo Corp",
            "bots": 15,
            "stripe": stripe_status(),
            **status_payload(),
        }

    @app.get("/health")
    def health_root() -> dict:
        return health_payload()

    @app.get("/api/health")
    def health() -> dict:
        return health_payload()

    @app.get("/api/demo/company")
    def company() -> dict:
        return views.load_company()

    @app.get("/api/demo/overview")
    def overview() -> dict:
        return views.overview()

    @app.get("/api/demo/status")
    def status() -> dict:
        return status_payload()

    @app.post("/api/demo/reset")
    def reset() -> dict:
        dest = reset_workspace()
        return {"ok": True, "runtime": str(dest), "canonical_preserved": True}

    @app.get("/api/inbox")
    def inbox() -> dict:
        return views.inbox_catalog()

    @app.get("/api/inbox/{sample_id}")
    def inbox_sample(sample_id: str) -> dict:
        row = views.inbox_sample(sample_id)
        if row is None:
            raise HTTPException(status_code=404, detail=f"Unknown sample {sample_id}")
        return row

    @app.get("/api/demo/company-state")
    def company_state() -> dict:
        return views.company_state()

    @app.get("/api/scenarios/{scenario_id}")
    def scenario_preview(scenario_id: str) -> dict:
        ids = {item["id"] for item in scenarios.SCENARIOS}
        if scenario_id not in ids:
            raise HTTPException(status_code=404, detail=f"Unknown scenario {scenario_id}")
        preview = artifacts.scenario_preview(scenario_id)
        card = next(item for item in scenarios.SCENARIOS if item["id"] == scenario_id)
        return {**card, **preview, "planted_issue": None, "expected": None}

    @app.get("/api/invoices")
    def invoices() -> dict:
        return {"invoices": views.invoice_rows()}

    @app.get("/api/invoices/{invoice_id}")
    def invoice(invoice_id: str) -> dict:
        row = views.invoice_detail(invoice_id)
        if row is None:
            raise HTTPException(status_code=404, detail=f"Unknown invoice {invoice_id}")
        return row

    @app.get("/api/ar")
    def ar() -> dict:
        return views.ar_view()

    @app.get("/api/cash")
    def cash() -> dict:
        return views.cash_view()

    @app.get("/api/stripe")
    def stripe() -> dict:
        return views.stripe_view()

    @app.get("/api/close")
    def close() -> dict:
        return views.close_view()

    @app.get("/api/forecast")
    def forecast() -> dict:
        return views.forecast_view()

    @app.get("/api/audit")
    def audit() -> dict:
        return views.audit_view()

    @app.get("/api/memory")
    def memory() -> dict:
        return views.memory_view()

    @app.get("/api/agents")
    def agents() -> dict:
        return views.agents_view()

    @app.get("/api/evaluations")
    def evaluations() -> dict:
        return views.evaluations_view()

    @app.get("/api/gauntlet")
    def get_gauntlet() -> dict:
        from demo_web import gauntlet as gauntlet_views

        return gauntlet_views.gauntlet_view()

    @app.get("/api/stories/trap")
    def get_trap_story() -> dict:
        from demo_web import gauntlet as gauntlet_views

        return gauntlet_views.trap_story()

    @app.get("/api/stories/harbor")
    def get_harbor_story() -> dict:
        from demo_web import gauntlet as gauntlet_views

        return gauntlet_views.harbor_story()

    @app.get("/api/stories/stripe")
    def get_stripe_story() -> dict:
        from demo_web import gauntlet as gauntlet_views

        return gauntlet_views.stripe_story()

    @app.get("/api/stories/correction")
    def get_correction_story() -> dict:
        from demo_web import gauntlet as gauntlet_views

        return gauntlet_views.correction_story()

    @app.get("/api/scenarios")
    def scenario_list() -> dict:
        return {"scenarios": scenarios.catalog()}

    @app.get("/api/architecture")
    def architecture() -> dict:
        return architecture_payload()

    @app.get("/api/lineage/{record_id}")
    def lineage(record_id: str) -> dict:
        return views.lineage_view(record_id)

    @app.get("/api/consistency/{invoice_id}")
    def consistency(invoice_id: str) -> dict:
        return views.consistency_for(invoice_id)

    @app.get("/api/traces")
    def traces() -> dict:
        return {"traces": workflows.list_traces()}

    @app.get("/api/traces/{trace_id}")
    def trace(trace_id: str) -> dict:
        row = workflows.load_trace(trace_id)
        if row is None:
            raise HTTPException(status_code=404, detail=f"Unknown trace {trace_id}")
        return row

    @app.post("/api/workflows/invoice-ingestion")
    def ingest(payload: dict | None = Body(default=None)) -> dict:
        body = payload or {}
        return workflows.run_logged(
            "ingest",
            lambda: workflows.ingest_sample(body.get("sample_id"), all_sources=bool(body.get("all_sources"))),
            bots=["email", "ap"],
        )

    @app.post("/api/workflows/inbox")
    def inbox_run(payload: dict | None = Body(default=None)) -> dict:
        body = payload or {}
        return workflows.run_logged(
            "inbox",
            lambda: workflows.run_inbox(body.get("case_id")),
            bots=["email"],
        )

    @app.post("/api/workflows/ap")
    def ap_run(payload: dict | None = Body(default=None)) -> dict:
        invoice_id = (payload or {}).get("invoice_id") or "INV-001"
        return workflows.run_logged("ap", lambda: workflows.run_ap(invoice_id), bots=["ap", "ctl-pay"], record_ids=[invoice_id])

    @app.post("/api/workflows/ap/{invoice_id}")
    def ap_one(invoice_id: str) -> dict:
        return workflows.run_logged("ap", lambda: workflows.run_ap(invoice_id), bots=["ap", "ctl-pay"], record_ids=[invoice_id])

    @app.post("/api/workflows/schedule")
    def schedule() -> dict:
        return workflows.run_logged("schedule", workflows.run_schedule, bots=["pay", "ctl-pay"])

    @app.post("/api/workflows/ar-aging")
    def ar_aging() -> dict:
        return workflows.run_logged("ar-aging", workflows.run_ar_aging, bots=["collect"])

    @app.post("/api/workflows/ar-collections")
    def ar_collections() -> dict:
        return workflows.run_logged("ar-collections", workflows.run_ar_collections, bots=["collect"])

    @app.post("/api/workflows/ar-cash-apply")
    def ar_apply(payload: dict | None = Body(default=None)) -> dict:
        payment_id = (payload or {}).get("payment_id") or "PAY-004"
        return workflows.run_logged(
            "ar-apply",
            lambda: workflows.run_ar_apply(payment_id),
            bots=["apply", "ctl-cash"],
            record_ids=[payment_id],
        )

    @app.post("/api/workflows/bank-reconciliation")
    def bank() -> dict:
        return workflows.run_logged("cash", workflows.run_bank_recon, bots=["cash", "ctl-cash"])

    @app.post("/api/workflows/stripe-reconciliation")
    def stripe_run() -> dict:
        return workflows.run_logged("stripe", workflows.run_stripe_recon, bots=["stripe", "cash"])

    @app.post("/api/workflows/close")
    def close_run() -> dict:
        return workflows.run_logged("close", workflows.run_close, bots=["close", "ctl-books"])

    @app.post("/api/workflows/accrual")
    def accrual_run(payload: dict | None = Body(default=None)) -> dict:
        vendor = (payload or {}).get("vendor") or "Harbor Electric"
        return workflows.run_logged("accrual", lambda: workflows.run_accrual(vendor), bots=["close"], record_ids=[vendor])

    @app.post("/api/workflows/forecast")
    def forecast_run() -> dict:
        return workflows.run_logged("forecast", workflows.run_forecast, bots=["story"])

    @app.post("/api/workflows/audit")
    def audit_run() -> dict:
        return workflows.run_logged("audit", workflows.run_audit, bots=["audit"])

    @app.post("/api/workflows/memory")
    def memory_run(payload: dict | None = Body(default=None)) -> dict:
        story = (payload or {}).get("story") or "harbor"
        return workflows.run_logged("memory", lambda: workflows.run_memory(story), bots=["close", "cash"])

    @app.post("/api/workflows/memory-eval")
    def memory_eval() -> dict:
        return workflows.run_logged("memory-eval", workflows.run_memory_eval, bots=["close", "cash"])

    @app.post("/api/workflows/cfo-cycle")
    def cfo_cycle() -> dict:
        return workflows.run_logged(
            "cfo-cycle",
            workflows.run_cfo_cycle,
            bots=["ap", "apply", "cash", "close", "story", "audit"],
        )

    @app.post("/api/workflows/evaluate")
    def evaluate() -> dict:
        return workflows.run_logged("evaluate", workflows.run_evaluate, bots=["audit"])

    @app.post("/api/workflows/gauntlet")
    def gauntlet_run(payload: dict | None = Body(default=None)) -> dict:
        body = payload or {}
        return workflows.run_logged(
            "gauntlet",
            lambda: workflows.run_gauntlet(include_existing=bool(body.get("include_existing")), modes=bool(body.get("modes"))),
            bots=["audit", "email", "cash", "close"],
        )

    @app.post("/api/workflows/scenario/{scenario_id}")
    def scenario_run(scenario_id: str) -> dict:
        try:
            return scenarios.run_scenario(scenario_id)
        except KeyError:
            raise HTTPException(status_code=404, detail=f"Unknown scenario {scenario_id}") from None

    @app.api_route("/api/{full_path:path}", methods=["POST", "PUT", "PATCH", "DELETE"], include_in_schema=False)
    def unknown_api(full_path: str):
        raise HTTPException(status_code=404, detail="Not Found")

    if WEB_DIST.is_dir():
        app.mount("/assets", StaticFiles(directory=WEB_DIST / "assets"), name="assets")

        @app.get("/{full_path:path}")
        def spa(full_path: str):
            if full_path == "health" or full_path.startswith("api/") or full_path == "api":
                return JSONResponse({"detail": f"Unknown API route /{full_path}"}, status_code=404)
            index = WEB_DIST / "index.html"
            if index.is_file():
                return FileResponse(index)
            return JSONResponse({"error": "frontend not built"}, status_code=404)

    return app
