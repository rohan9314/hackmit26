from pathlib import Path


FRONTEND = Path(__file__).resolve().parents[2] / "web" / "src"


def test_frontend_does_not_hardcode_workflow_outcomes():
    forbidden = (
        'const result = "Invoice approved"',
        "Invoice approved",
        "HARDCODED_PASS",
    )
    text = ""
    for path in FRONTEND.rglob("*.tsx"):
        if "test" in path.parts or path.name.endswith(".test.tsx"):
            continue
        text += path.read_text()
    for token in forbidden:
        assert token not in text


def test_frontend_io_labels_exist():
    demo = (FRONTEND / "components" / "Demo.tsx").read_text()
    assert "What arrived" in demo
    assert "What changed" in demo
    assert "SourceArtifactViewer" in demo
    assert "BeforeAfterDiff" in demo
    pages = "\n".join(path.read_text() for path in (FRONTEND / "pages").glob("*.tsx"))
    for token in ("What arrived", "What changed", "Starting company state"):
        assert token in pages or token in demo
    app = (FRONTEND / "App.tsx").read_text()
    for route in (
        "/",
        "/inbox",
        "/ap",
        "/ar",
        "/cash",
        "/stripe",
        "/close",
        "/forecast",
        "/audit",
        "/memory",
        "/agents",
        "/evaluations",
        "/scenarios",
        "/architecture",
        "/simulations",
        "/videos",
        "/workflow",
        "/coverage",
    ):
        assert route in app


def test_presentation_layer_hides_internal_tokens():
    copy = (FRONTEND / "copy.ts").read_text()
    assert "Unresolved — more evidence required" in copy
    assert "Use the comparable season from last year" in copy
    pages = {path.name: path.read_text() for path in (FRONTEND / "pages").glob("*.tsx")}
    assert "Fifteen bots" not in pages["Agents.tsx"]
    assert "Grain" not in pages["Agents.tsx"]
    assert "JSON.stringify" not in pages["Memory.tsx"]
    assert "What's happening?" in (FRONTEND / "components" / "Explain.tsx").read_text()
    assert "Decision" in (FRONTEND / "components" / "Explain.tsx").read_text()
    assert "Who receives the result next" in (FRONTEND / "components" / "Explain.tsx").read_text()
    assert "Not overdue yet" in copy
    agents = (FRONTEND / "data" / "agents.ts").read_text()
    for slug in (
        "email",
        "stripe",
        "bank",
        "books",
        "ap",
        "pay",
        "apply",
        "collect",
        "cash",
        "close",
        "story",
        "ctl-pay",
        "ctl-cash",
        "ctl-books",
        "audit",
    ):
        assert f"{slug}:" in copy or f'"{slug}":' in copy or f'"{slug}"' in agents
    assert "table-scroll" in (FRONTEND / "styles.css").read_text()
    assert "onlyChanged" in (FRONTEND / "components" / "Demo.tsx").read_text()
    explain = (FRONTEND / "components" / "Explain.tsx").read_text()
    assert "FriendlyRaw" in (FRONTEND / "components" / "Demo.tsx").read_text() or "FriendlyRaw" in explain
    assert "Explanation" in explain
    assert "More fields" in explain


def test_pages_call_shared_demo_client_not_raw_paths():
    pages = "\n".join(path.read_text() for path in (FRONTEND / "pages").glob("*.tsx"))
    layout = (FRONTEND / "layout" / "Shell.tsx").read_text()
    assert "demoApi." in pages
    assert "/api/workflows/" not in pages
    assert "/api/workflows/" not in layout
    assert "identifyDocument" in (FRONTEND / "demoClient.ts").read_text()
    for stale in (
        "/api/workflows/identify-document",
        "/api/workflows/document-identification",
        "/demo/inbox",
        "/api/agents/email/identify",
    ):
        assert stale not in pages
        assert stale not in layout


def test_eval_and_ar_pages_lead_with_english():
    ar = (FRONTEND / "pages" / "AR.tsx").read_text()
    assert "Accounts receivable is money customers still owe" in ar
    assert "Lumen Labs" in ar
    cash = (FRONTEND / "pages" / "Cash.tsx").read_text()
    assert "Why is there an extra $12.40" in cash
    close = (FRONTEND / "pages" / "Close.tsx").read_text()
    assert "Harbor Electric is Maximor Demo Corp" in close
    evals = (FRONTEND / "pages" / "Evaluations.tsx").read_text()
    assert "known correct outcomes" in evals
    forecast = (FRONTEND / "pages" / "Forecast.tsx").read_text()
    assert "did not change any weekly ending-cash" in forecast

