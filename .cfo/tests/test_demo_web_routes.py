"""Frontend/backend demo API contract after the 15-agent migration."""

from __future__ import annotations

import re
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from demo.reset import reset_demo_runtime
from demo_web.app import create_app
from demo_web.workspace import shutdown_workspace

REPO = Path(__file__).resolve().parent.parent
GIT_ROOT = REPO.parent
CANONICAL = REPO / "data" / "demo"
FRONTEND_SRC = GIT_ROOT / "web" / "src"

PRIMARY_GET = [
    "/health",
    "/api/health",
    "/api/demo/status",
    "/api/demo/overview",
    "/api/demo/company-state",
    "/api/inbox",
    "/api/invoices",
    "/api/ar",
    "/api/cash",
    "/api/stripe",
    "/api/close",
    "/api/forecast",
    "/api/audit",
    "/api/memory",
    "/api/agents",
    "/api/evaluations",
    "/api/gauntlet",
    "/api/scenarios",
    "/api/architecture",
    "/api/stories/trap",
    "/api/stories/harbor",
    "/api/stories/stripe",
    "/api/stories/correction",
    "/api/lineage/INV-006",
]

PRIMARY_POST = [
    ("/api/workflows/invoice-ingestion", {"sample_id": "MSG-E-MESSY"}),
    ("/api/workflows/inbox", {}),
    ("/api/workflows/ap/INV-001", None),
    ("/api/workflows/schedule", None),
    ("/api/workflows/ar-aging", None),
    ("/api/workflows/ar-collections", None),
    ("/api/workflows/ar-cash-apply", {"payment_id": "PAY-004"}),
    ("/api/workflows/bank-reconciliation", None),
    ("/api/workflows/stripe-reconciliation", None),
    ("/api/workflows/close", None),
    ("/api/workflows/accrual", {"vendor": "Harbor Electric"}),
    ("/api/workflows/forecast", None),
    ("/api/workflows/audit", None),
    ("/api/workflows/memory", {"story": "harbor"}),
    ("/api/workflows/scenario/duplicate-invoice", None),
]

STALE_PATHS = [
    "/api/workflows/identify-document",
    "/api/workflows/document-identification",
    "/api/workflows/sort-inbox",
    "/api/workflows/three-way-match",
    "/api/workflows/ap-preparer",
    "/api/workflows/finance-inbox",
    "/demo/inbox",
    "/api/agents/email/identify",
    "/api/v1/workflows/ap",
]

WORKFLOW_KEYS = {"ok", "workflow", "status"}


@pytest.fixture
def client(tmp_path):
    runtime = tmp_path / "demo_runtime"
    reset_demo_runtime(runtime, source=CANONICAL)
    app = create_app(CANONICAL, runtime)
    with TestClient(app) as test_client:
        yield test_client
    shutdown_workspace()


def _frontend_consumer_text() -> str:
    chunks = []
    for folder in ("pages", "layout", "components"):
        for path in (FRONTEND_SRC / folder).rglob("*.tsx"):
            chunks.append(path.read_text())
    chunks.append((FRONTEND_SRC / "hooks.ts").read_text())
    return "\n".join(chunks)


def _api_paths_from_client() -> set[str]:
    text = (FRONTEND_SRC / "api.ts").read_text()
    return set(re.findall(r'"(/(?:api|health)[^"]*)"', text.split("STALE_API_PATHS")[0]))


def _registered(client: TestClient) -> set[tuple[str, str]]:
    rows = set()
    for route in client.app.routes:
        methods = getattr(route, "methods", None) or set()
        path = getattr(route, "path", "")
        for method in methods:
            if method in {"HEAD", "OPTIONS"}:
                continue
            rows.add((method, path))
    return rows


def test_health_endpoints_succeed(client):
    for path in ("/health", "/api/health"):
        response = client.get(path)
        assert response.status_code == 200, path
        payload = response.json()
        assert payload["ok"] is True
        assert payload["bots"] == 15
        assert payload["product"]


def test_primary_get_demo_routes_exist(client):
    for path in PRIMARY_GET:
        response = client.get(path)
        assert response.status_code == 200, f"{path} -> {response.status_code} {response.text[:200]}"
        assert isinstance(response.json(), dict)


def test_primary_post_demo_routes_run(client):
    for path, body in PRIMARY_POST:
        response = client.post(path, json=body or {})
        assert response.status_code == 200, f"{path} -> {response.status_code} {response.text[:300]}"
        payload = response.json()
        assert WORKFLOW_KEYS <= set(payload)
        assert payload["ok"] is True
        assert payload.get("result") is not None


def test_wrong_method_on_workflow_is_not_200(client):
    response = client.get("/api/workflows/forecast")
    assert response.status_code in {404, 405}


def test_stale_migration_routes_are_not_registered(client):
    registered = {path for _method, path in _registered(client)}
    for path in STALE_PATHS:
        if "{" in path:
            continue
        assert path not in registered
        response = client.post(path, json={})
        assert response.status_code in {404, 405}, path


def test_frontend_client_paths_are_registered(client):
    registered = {path for _method, path in _registered(client)}
    for path in sorted(_api_paths_from_client()):
        if path in STALE_PATHS:
            continue
        if path in registered:
            continue
        prefix_ok = any(
            item.startswith(path.rstrip("/") + "/") or path.startswith(item.split("{")[0])
            for item in registered
            if "{" in item or item.startswith(path)
        )
        assert prefix_ok, f"frontend path {path} is not registered"


def test_story_handlers_do_not_recurse(client):
    for path in ("/api/stories/harbor", "/api/stories/correction", "/api/stories/stripe", "/api/stories/trap"):
        response = client.get(path)
        assert response.status_code == 200, path
        assert response.json()["title"]


def test_pages_do_not_scatter_or_keep_stale_routes():
    pages = _frontend_consumer_text()
    for stale in STALE_PATHS:
        assert stale not in pages, stale
    assert "/api/workflows/" not in pages
    client = (FRONTEND_SRC / "demoClient.ts").read_text()
    assert "identifyDocument" in client
    assert "sortInbox" in client
    assert "runAccountsPayable" in client
    assert "runCashReconciliation" in client
    assert "runClose" in client
    assert "runForecast" in client
    assert "runAudit" in client
    assert "API_PATHS.invoiceIngestion" in client


def test_workflow_response_shape_matches_frontend(client):
    payload = client.post("/api/workflows/invoice-ingestion", json={"sample_id": "MSG-E-QUOTE"}).json()
    assert payload["ok"] is True
    result = payload["result"]
    assert "classification" in result
    assert "stages" in result
    assert result["classification"] != "invoice"

    ap = client.post("/api/workflows/ap/INV-001").json()
    assert ap["result"]["decision"]["decision"]
    assert "stages" in ap["result"]


def test_inbox_samples_classify_as_distinct_document_types(client):
    expected = {
        "MSG-E-INV-001": "invoice",
        "MSG-E-QUOTE": "quote",
        "MSG-E-RCPT": "receipt",
        "MSG-E-STMT": "statement",
        "MSG-E-PO-MONITORS": "purchase_order",
        "MSG-E-DUP-001": "invoice",
        "MSG-E-MESSY": "invoice",
        "MSG-E-MISSING": "not_invoice",
    }
    for sample_id, classification in expected.items():
        payload = client.post("/api/workflows/invoice-ingestion", json={"sample_id": sample_id}).json()
        assert payload["ok"] is True, sample_id
        actual = payload["result"]["classification"]
        assert actual == classification, f"{sample_id}: {actual} != {classification}"
        if classification != "invoice":
            assert not payload["result"].get("record_ids")
        assert "what_changed" in payload["result"]
        assert "{" not in str(payload["result"]["what_changed"])


def test_forecast_view_matches_company_state(client):
    stored = client.get("/api/forecast").json()
    company = client.get("/api/demo/company-state").json()
    assert stored["projected_ending_cash"] == company["projected_ending_cash"]
    assert stored["opening_cash"] == company["cash"]


def test_planted_errors_are_detected_by_current_workflows(client):
    quote = client.post("/api/workflows/invoice-ingestion", json={"sample_id": "MSG-E-QUOTE"}).json()
    assert quote["result"]["classification"] == "quote"
    assert not quote["result"].get("record_ids")

    receipt = client.post("/api/workflows/invoice-ingestion", json={"sample_id": "MSG-E-RCPT"}).json()
    assert receipt["result"]["classification"] == "receipt"
    assert not receipt["result"].get("record_ids")

    duplicate = client.post("/api/workflows/ap/INV-006").json()
    assert duplicate["result"]["decision"]["decision"] == "HOLD"

    amount_mismatch = client.post("/api/workflows/ap/INV-004").json()
    assert amount_mismatch["result"]["decision"]["decision"] == "HOLD"

    missing_receipt = client.post("/api/workflows/ap/INV-005").json()
    assert missing_receipt["result"]["decision"]["decision"] == "HOLD"
    assert "goods_not_received" in missing_receipt["result"]["evidence"]["exception_types"]

    statement = client.post("/api/workflows/invoice-ingestion", json={"sample_id": "MSG-E-STMT"}).json()
    assert statement["result"]["classification"] == "statement"
    assert not statement["result"].get("record_ids")

    purchase_order = client.post("/api/workflows/invoice-ingestion", json={"sample_id": "MSG-E-PO-MONITORS"}).json()
    assert purchase_order["result"]["classification"] == "purchase_order"
    assert not purchase_order["result"].get("record_ids")

    duplicate_mail = client.post("/api/workflows/invoice-ingestion", json={"sample_id": "MSG-E-DUP-001"}).json()
    assert duplicate_mail["result"]["classification"] == "invoice"
    assert not duplicate_mail["result"].get("record_ids")

    unmatched = client.post("/api/workflows/ar-cash-apply", json={"payment_id": "PAY-004"}).json()
    assert unmatched["result"]["io"]["outputs"]["decision"] == "HUMAN_REVIEW"
    assert unmatched["result"]["io"]["outputs"]["invoice_ids"] == []
    assert "human review" not in unmatched["result"]["summary"].lower()

    cash = client.post("/api/workflows/bank-reconciliation").json()
    matches = cash["result"]["report"]["matches"]
    unexplained = [item for item in matches if "TXN-2026-09-015" in (item.get("bank_transaction_ids") or [])]
    assert unexplained
    assert unexplained[0]["match_type"] == "UNEXPLAINED_DIFFERENCE"

    stripe = client.post("/api/workflows/stripe-reconciliation").json()
    payouts = stripe["result"]["payouts"]
    assert payouts
    assert any(item.get("tied") for item in payouts)

    harbor = client.post("/api/workflows/accrual", json={"vendor": "Harbor Electric"}).json()
    assert "4650" in str(harbor["result"]["summary"])


def test_forecast_refresh_keeps_original_ending_on_the_books(client):
    stored = client.get("/api/forecast").json()
    refreshed = client.post("/api/workflows/forecast").json()["result"]
    assert refreshed["io"]["outputs"]["original_ending_cash"] == stored["projected_ending_cash"]
    assert "$" in refreshed["summary"]
    assert str(int(stored["projected_ending_cash"]))[:3] in refreshed["summary"].replace(",", "")


def test_memory_view_keeps_one_harbor_decision_per_period():
    from demo_web.views import _dedupe_harbor_decisions

    rows = [
        {"period": "2026-08", "decision": "recent_average", "summary": "Harbor Electric used recent_average (6,600)"},
        {"period": "2026-08", "decision": "seasonal_prior_year", "summary": "Harbor Electric used seasonal_prior_year (7,800)"},
        {"period": "2026-09", "decision": "seasonal_prior_year", "summary": "Harbor Electric used seasonal_prior_year (4,650)"},
        {"period": "2026-09", "decision": "usage_run_rate", "summary": "Aether Compute used usage_run_rate"},
    ]
    out = _dedupe_harbor_decisions(rows)
    harbor = [row for row in out if "Harbor Electric" in str(row.get("summary"))]
    assert len(harbor) == 2
    august = next(row for row in harbor if row["period"] == "2026-08")
    assert august["decision"] == "seasonal_prior_year"
    assert any("Aether Compute" in str(row.get("summary")) for row in out)
