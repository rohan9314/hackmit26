"""Read persisted Maximor state. GET handlers must not call models."""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

from demo_web.bots import architecture_payload, grain_agents
from demo_web.jsonutil import cents_to_dollars, dump, money, read_json
from demo_web.workspace import canonical_root, runtime_root, run_dir, stripe_status, website_dir
from demo_web import artifacts
from demo_web.inbox_examples import INBOX_EXAMPLES, curated_ids, example_by_id

PERIOD = "2026-09"
AS_OF = "2026-09-30"


def data_file(*parts: str) -> Path:
    runtime = runtime_root().joinpath(*parts)
    if runtime.exists():
        return runtime
    canonical = canonical_root().joinpath(*parts)
    if canonical.exists():
        return canonical
    return runtime


def load_company() -> dict:
    snapshot = read_json(data_file("demo_snapshot.json")) or {}
    company = read_json(data_file("company.json")) or snapshot.get("company") or {}
    calendar = snapshot.get("calendar") or {
        "period": PERIOD,
        "comparison_period": "2026-08",
        "as_of_date": AS_OF,
        "forecast_as_of": "2026-09-19",
        "close_target_date": "2026-10-03",
    }
    return {
        "company": company,
        "calendar": calendar,
        "highlights": snapshot.get("highlights") or [],
        "counts": snapshot.get("counts") or {},
        "storylines": read_json(data_file("canonical", "storylines.json")) or [],
    }


def _payments_by_invoice() -> dict[str, list[dict]]:
    rows = read_json(data_file("canonical", "vendor_payments.json")) or []
    mapping: dict[str, list[dict]] = defaultdict(list)
    for row in rows:
        for invoice_id in row.get("invoice_ids") or []:
            mapping[invoice_id].append(row)
    return mapping


def _journals_by_source() -> dict[str, list[dict]]:
    rows = read_json(data_file("close", "journal_entries.json")) or []
    mapping: dict[str, list[dict]] = defaultdict(list)
    for row in rows:
        source = row.get("source_document_id") or ""
        if source:
            mapping[source].append(row)
        for related in row.get("related_ids") or []:
            mapping[related].append(row)
    return mapping


def _lineage_index() -> dict[str, dict]:
    rows = read_json(data_file("lineage.json")) or []
    index = {}
    for row in rows:
        index[row.get("record_id")] = row
        for node in row.get("nodes") or []:
            index.setdefault(node.get("id"), row)
    return index


def invoice_rows() -> list[dict]:
    from tools import all_invoices, collect_case_evidence, load_goods_receipt, load_purchase_order

    pool_ids = {item.get("invoice_id") for item in (read_json(data_file("approved_pool.json")) or [])}
    payments = _payments_by_invoice()
    journals = _journals_by_source()
    lineage = _lineage_index()
    rows = []
    for invoice in all_invoices():
        evidence = collect_case_evidence(invoice.invoice_id)
        po = load_purchase_order(invoice.po_id) if invoice.po_id else None
        gr = load_goods_receipt(invoice.po_id) if invoice.po_id else None
        paid = payments.get(invoice.invoice_id) or []
        payment_state = "paid" if paid else ("approved_pool" if invoice.invoice_id in pool_ids else "open")
        rows.append(
            {
                "invoice_id": invoice.invoice_id,
                "vendor": invoice.vendor,
                "amount": money(invoice.amount),
                "invoice_date": invoice.invoice_date,
                "due_date": invoice.due_date,
                "po_id": invoice.po_id,
                "vendor_invoice_number": invoice.vendor_invoice_number,
                "description": invoice.description,
                "payment_terms": invoice.payment_terms,
                "match_status": "matched" if not evidence.exception_types else "exception",
                "duplicate_status": "duplicate" if evidence.duplicate_detected else "unique",
                "exceptions": list(evidence.exception_types),
                "po_exists": evidence.po_exists,
                "po_approved": evidence.po_approved,
                "receipt_status": evidence.receipt_status,
                "amount_matches": evidence.amount_matches,
                "vendor_exact_match": evidence.vendor_exact_match,
                "payment_state": payment_state,
                "accounting_status": "posted" if journals.get(invoice.invoice_id) else "unposted",
                "linked_payments": [item.get("payment_id") for item in paid],
                "linked_journals": list(dict.fromkeys(item.get("entry_id") for item in journals.get(invoice.invoice_id) or [] if item.get("entry_id"))),
                "lineage_id": (lineage.get(invoice.invoice_id) or {}).get("lineage_id"),
                "po": dump(po) if po is not None else None,
                "goods_receipt": dump(gr) if gr is not None else None,
            }
        )
    return rows


def invoice_state(invoice_id: str) -> dict | None:
    row = next((item for item in invoice_rows() if item.get("invoice_id") == invoice_id), None)
    return artifacts.invoice_state_from_row(row)


def invoice_detail(invoice_id: str) -> dict | None:
    from tools import collect_case_evidence, load_invoice, load_policies, match_prior_cases

    invoice = load_invoice(invoice_id)
    if invoice is None:
        return None
    rows = {item["invoice_id"]: item for item in invoice_rows()}
    base = rows.get(invoice_id) or {}
    evidence = collect_case_evidence(invoice_id)
    policies = load_policies()
    prior = match_prior_cases(invoice_id)
    bank = read_json(data_file("cash_recon", "bank_statement.json")) or []
    linked_bank = [
        item
        for item in bank
        if invoice_id in ((item.get("raw_metadata") or {}).get("invoice_ids") or [])
        or invoice_id in str(item.get("description") or "")
    ]
    forecast_weeks = read_json(data_file("reporting", "forecast_weeks.json")) or []
    forecast_hit = [
        week
        for week in forecast_weeks
        if any(invoice_id in str(line_id) for line_id in week.get("line_ids") or [])
    ]
    return {
        **base,
        "invoice": dump(invoice),
        "evidence": dump(evidence),
        "policies": [item.policy_id for item in policies],
        "precedents": dump(prior),
        "source_document": artifacts.invoice_artifact(invoice_id),
        "source_emails": artifacts.emails_for_invoice(invoice_id, invoice.vendor_invoice_number),
        "duplicate_peer": artifacts.duplicate_pair() if invoice_id in {"INV-006", "INV-007"} else None,
        "linked_bank": linked_bank,
        "forecast_weeks": forecast_hit,
        "lineage": _lineage_index().get(invoice_id),
        "three_way": {
            "invoice": {
                "id": invoice_id,
                "amount": money(invoice.amount),
                "vendor": invoice.vendor,
                "po_id": invoice.po_id,
                "quantity": None,
            },
            "purchase_order": base.get("po"),
            "goods_receipt": base.get("goods_receipt"),
            "mismatches": list(evidence.exception_types),
            "artifacts": artifacts.three_way_inputs(invoice_id),
        },
        "state": invoice_state(invoice_id),
        "provenance": (artifacts.invoice_artifact(invoice_id) or {}).get("provenance") or [],
    }


def _ap_outstanding() -> float:
    paid_ids = set(_payments_by_invoice())
    total = 0.0
    for row in invoice_rows():
        if row["invoice_id"] in paid_ids:
            continue
        if row["payment_state"] == "paid":
            continue
        total += row["amount"]
    return money(total)


def ar_view(as_of: str = AS_OF) -> dict:
    from ar.aging import age_invoices
    from ar.models import CustomerInvoice

    invoices = [CustomerInvoice.model_validate(item) for item in (read_json(data_file("ar_invoices.json")) or [])]
    payments = read_json(data_file("ar_payments.json")) or []
    customers = read_json(data_file("ar_customers.json")) or []
    lines = age_invoices(invoices, as_of)
    buckets = {"CURRENT": 0.0, "1-30": 0.0, "31-60": 0.0, "61-90": 0.0, "90+": 0.0}
    for line in lines:
        buckets[line.aging_bucket] = money(buckets[line.aging_bucket] + line.outstanding_amount)
    outstanding = money(sum(item.outstanding_amount for item in invoices))
    return {
        "as_of": as_of,
        "outstanding": outstanding,
        "buckets": buckets,
        "invoices": dump(invoices),
        "aging_lines": dump(lines),
        "payments": payments,
        "customers": customers,
        "ambiguous_payment_id": "PAY-004",
        "featured_payment": artifacts.ar_payment_bundle("PAY-004"),
    }


def cash_view() -> dict:
    bank = read_json(data_file("cash_recon", "bank_statement.json")) or []
    ledger = read_json(data_file("cash_recon", "ledger.json")) or []
    fees = read_json(data_file("cash_recon", "fee_evidence.json")) or []
    balances = read_json(data_file("cash_recon", "balances.json")) or {}
    report = None
    try:
        from cash_recon.store import get_report

        stored = get_report(PERIOD)
        report = dump(stored.model_copy(update={"traces": [], "agents": []})) if stored is not None else None
    except Exception:
        report = None
    return {
        "period": PERIOD,
        "balances": balances,
        "bank": bank,
        "ledger": ledger,
        "fees": fees,
        "report": report,
        "featured": {
            "grouped": "TXN-2026-09-008",
            "fee_netted": "TXN-2026-09-011",
            "unexplained": "TXN-2026-09-015",
            "stripe": "TXN-2026-09-019A",
            "duplicate_refund": "TXN-2026-09-012B",
        },
        "featured_cases": {
            "grouped": artifacts.featured_bank_case("TXN-2026-09-008"),
            "fee_netted": artifacts.featured_bank_case("TXN-2026-09-011"),
            "unexplained": artifacts.featured_bank_case("TXN-2026-09-015"),
        },
    }


def stripe_view() -> dict:
    from integrations.cash import reconcile_payout
    from integrations.models import ProviderPayout

    payouts = read_json(data_file("integrations", "stripe", "payouts.json")) or []
    balance_txns = read_json(data_file("integrations", "stripe", "balance_transactions.json")) or []
    deposits = read_json(data_file("integrations", "stripe", "bank_deposits.json")) or []
    events = read_json(data_file("integrations", "stripe", "events.json")) or []
    waterfalls = []
    for raw in payouts:
        payout = ProviderPayout.model_validate(raw)
        breakdown = reconcile_payout(payout)
        deposit = next(
            (item for item in deposits if item.get("payout_id") == payout.payout_id or item.get("id") == payout.bank_deposit_id),
            None,
        )
        waterfalls.append(
            {
                "payout": dump(payout),
                "breakdown": dump(breakdown),
                "bank_deposit": deposit,
                "tied": bool(breakdown.matched) and not breakdown.exceptions,
            }
        )
    return {
        "mode": stripe_status(),
        "payouts": waterfalls,
        "balance_transactions": balance_txns,
        "events": events,
        "deposits": deposits,
        "raw": {
            "payouts": payouts,
            "balance_transactions": balance_txns,
            "events": events,
            "deposits": deposits,
        },
        "bundles": {
            item["payout"]["payout_id"]: artifacts.stripe_payout_bundle(item["payout"]["payout_id"])
            for item in waterfalls
            if item.get("payout") and item["payout"].get("payout_id")
        },
    }


def close_view() -> dict:
    tasks = read_json(data_file("close", "tasks.json")) or []
    journals = read_json(data_file("close", "journal_entries.json")) or []
    prepaids = read_json(data_file("close", "prepaids.json")) or []
    assets = read_json(data_file("close", "fixed_assets.json")) or []
    blockers = [item for item in tasks if item.get("status") in {"BLOCKED", "NEEDS_REVIEW"}]
    period_status = "BLOCKED" if blockers else "IN_PROGRESS"
    if tasks and all(item.get("status") == "COMPLETE" for item in tasks):
        period_status = "CLOSED"
    return {
        "period": PERIOD,
        "status": period_status,
        "tasks": tasks,
        "journals": journals,
        "prepaids": prepaids,
        "assets": assets,
        "blockers": blockers,
        "harbor": {
            "vendor": "Harbor Electric",
            "accrual_id": "ACC-HE-2026-09",
            "journal_id": "JE-ACC-HE-202609",
            "input": artifacts.harbor_input(),
        },
        "before_close": artifacts.close_task_snapshot(),
    }


def forecast_view() -> dict:
    weeks = read_json(data_file("reporting", "forecast_weeks.json")) or []
    lines = read_json(data_file("reporting", "forecast_lines.json")) or []
    actuals = read_json(data_file("reporting", "actuals.json")) or []
    cash = read_json(data_file("cash_position.json")) or {}
    ending = weeks[-1]["ending_cash"] if weeks else None
    return {
        "as_of": "2026-09-19",
        "weeks": weeks,
        "lines": lines,
        "actuals": actuals,
        "opening_cash": cash.get("bank_balance"),
        "projected_ending_cash": ending,
        "miss": {
            "late_collection": "INV-AR-014",
            "unexpected_or_early": ["INV-012"],
            "gross_margin": {"august": 0.64, "september": 0.61},
        },
        "inputs": artifacts.forecast_inputs(),
    }


def _inbox_kind(row: dict) -> str:
    meta = example_by_id(str(row.get("message_id") or ""))
    if meta:
        return str(meta["kind"])
    subject = str(row.get("subject") or "")
    text = " ".join(
        [
            subject,
            str(row.get("body") or ""),
            " ".join(str(att.get("text") or "") for att in row.get("attachments") or []),
        ]
    ).lower()
    if "quote" in text or "quotation" in text:
        return "quote"
    if "statement" in text:
        return "statement"
    if "receipt" in text:
        return "receipt"
    if "purchase order" in text or str(row.get("message_id") or "").startswith("MSG-E-PO"):
        return "purchase_order"
    if "dup" in str(row.get("message_id") or "").lower() or "resending" in text:
        return "duplicate"
    if "no amount" in text or "missing" in str(row.get("message_id") or "").lower():
        return "malformed"
    return "invoice"


def _sample_row(row: dict) -> dict:
    sample_id = str(row.get("message_id") or "")
    meta = example_by_id(sample_id) or {}
    return {
        "sample_id": sample_id,
        "source": "email",
        "kind": meta.get("kind") or _inbox_kind(row),
        "from": row.get("from"),
        "subject": meta.get("title") or row.get("subject"),
        "raw_subject": row.get("subject"),
        "sent_at": row.get("sent_at"),
        "preview": (row.get("body") or "")[:240],
        "test": meta.get("test") or "",
        "looks_like": meta.get("looks_like") or meta.get("kind") or _inbox_kind(row),
        "featured": bool(meta),
    }


def inbox_catalog() -> dict:
    emails = read_json(data_file("ingestion", "emails.json")) or []
    documents = read_json(data_file("ingestion", "documents.json")) or []
    employee = read_json(data_file("ingestion", "employee_submissions.json")) or []
    portals = read_json(data_file("ingestion", "vendor_portals.json")) or []
    bank_card = read_json(data_file("ingestion", "bank_transactions.json")) or []
    by_id = {str(row.get("message_id")): row for row in emails if row.get("message_id")}
    featured = []
    for sample_id in curated_ids():
        row = by_id.get(sample_id)
        if row:
            featured.append(_sample_row(row))
    others = [_sample_row(row) for row in emails if str(row.get("message_id")) not in set(curated_ids())]
    samples = featured or [_sample_row(row) for row in emails]
    packed = {}
    for row in emails:
        sample_id = row.get("message_id")
        if not sample_id:
            continue
        artifact = artifacts.email_artifact(sample_id)
        if artifact:
            packed[sample_id] = artifact
    return {
        "samples": samples,
        "featured": featured,
        "other_samples": others,
        "examples": INBOX_EXAMPLES,
        "documents": documents,
        "employee_submissions": employee,
        "portals": portals,
        "bank_card": bank_card,
        "emails": emails,
        "sample_artifacts": packed,
        "default_sample_id": (featured[0]["sample_id"] if featured else (samples[0]["sample_id"] if samples else "MSG-E-INV-001")),
    }


def _harbor_vendor(row: dict) -> bool:
    blob = " ".join(
        str(row.get(key) or "")
        for key in ("summary", "situation_summary", "reason", "rationale", "vendor", "entity", "subject")
    )
    return "harbor electric" in blob.lower()


def _dedupe_harbor_decisions(decisions: list[dict]) -> list[dict]:
    """Keep one Harbor Electric decision per period so eval leftovers do not confuse the demo."""
    preferred = {}
    others: list[dict] = []
    for row in decisions or []:
        if not _harbor_vendor(row):
            others.append(row)
            continue
        period = str(row.get("period") or "")
        method = str(row.get("decision") or row.get("accounting_treatment") or "")
        current = preferred.get(period)
        if current is None or (method == "seasonal_prior_year" and current[1] != "seasonal_prior_year"):
            preferred[period] = (row, method)
    harbor_rows = [item[0] for item in preferred.values()]
    return harbor_rows + others


def memory_view() -> dict:
    events = read_json(data_file("memory_events.json")) or []
    prior = read_json(data_file("prior_cases.json")) or []
    ar_prec = read_json(data_file("ar_precedents.json")) or []
    decisions = []
    try:
        from memory.store import load_memories

        decisions = dump(load_memories())
    except Exception:
        decisions = []
    return {
        "events": events,
        "prior_cases": prior,
        "ar_precedents": ar_prec,
        "decisions": _dedupe_harbor_decisions(decisions if isinstance(decisions, list) else []),
        "mechanisms": [
            "prior_cases (AP alias CASE-001)",
            "ar_precedents (Atlas batch / Meridian correction)",
            "organizational DecisionMemory after cash/prepaid/Harbor runs",
            "close identity_links (provenance, not a graph DB)",
        ],
        "harbor": artifacts.harbor_input(),
    }


def audit_view() -> dict:
    latest = None
    latest_path = run_dir() / "audit"
    if latest_path.exists():
        reports = sorted(latest_path.glob("**/*.json"))
        if reports:
            latest = read_json(reports[-1])
    population = {
        "invoices": len(read_json(data_file("audit", "invoices.json")) or []),
        "payments": len(read_json(data_file("audit", "payments.json")) or []),
        "journals": len(read_json(data_file("audit", "journal_entries.json")) or []),
        "vendors": len(read_json(data_file("audit", "vendors.json")) or []),
        "approvals": len(read_json(data_file("audit", "approvals.json")) or []),
    }
    return {
        "population": population,
        "last_run": latest,
        "controls": [
            "duplicate vendor",
            "duplicate invoice",
            "round-number payment",
            "self-approval",
            "post-close journal",
            "paid-while-held",
        ],
        "note": "Findings appear after you run the independent audit. Planted answers are not shown before the run.",
        "inputs": artifacts.audit_population_inputs(),
    }


def evaluations_view() -> dict:
    website_latest = read_json(website_dir() / "evaluations.json")
    latest = website_latest if isinstance(website_latest, dict) and website_latest.get("cases") else None
    if latest and not any(str(item.get("case_id") or "").startswith("AC-") for item in latest.get("cases") or []):
        latest = None
    cases = read_json(canonical_root() / "agent_cases.json") or []
    results_by_id = {}
    if isinstance(latest, dict):
        for item in latest.get("cases") or []:
            case_id = item.get("case_id")
            if case_id:
                results_by_id[case_id] = item
    scored = bool(results_by_id)
    catalog = []
    for case in cases:
        row = {
            "case_id": case.get("case_id"),
            "agent": case.get("agent"),
            "capability": case.get("capability"),
            "source_record_ids": case.get("source_record_ids") or [],
            "downstream_record_ids": case.get("downstream_record_ids") or [],
            "visualization_tags": case.get("visualization_tags") or [],
            "input": case.get("input") or {},
            "status": "not_run",
        }
        result = results_by_id.get(case.get("case_id"))
        if result:
            passed = bool(result.get("passed"))
            row.update(
                {
                    "passed": passed,
                    "actual": result.get("actual"),
                    "expected": result.get("expected") if result.get("expected") is not None else case.get("expected"),
                    "reason": result.get("reason") or "",
                    "status": "pass" if passed else "fail",
                }
            )
        catalog.append(row)
    summary = None
    if scored:
        total = int(latest.get("total") or len(results_by_id))
        passed = int(latest.get("passed") or sum(1 for item in catalog if item.get("passed")))
        failed = int(latest.get("failed") or (total - passed))
        planted = [item for item in catalog if "exception" in (item.get("visualization_tags") or [])]
        planted_passed = sum(1 for item in planted if item.get("passed"))
        categories = sorted({tag for item in catalog for tag in (item.get("visualization_tags") or []) if tag not in {"demo_highlight", "happy_path"}})
        summary = {
            "total": total,
            "passed": passed,
            "failed": failed,
            "success_rate": round(passed / total, 4) if total else 0.0,
            "categories": categories,
            "planted_error_cases": len(planted),
            "planted_errors_detected": planted_passed,
            "pass_rate_by_agent": latest.get("pass_rate_by_agent") or {},
            "unhandled": latest.get("unhandled") or [],
        }
    return {
        "latest": latest if scored else None,
        "catalog": catalog,
        "scored": scored,
        "summary": summary,
        "memory_eval": read_json(run_dir() / "memory_eval" / "latest.json"),
        "note": "Maximor is tested against finance scenarios with known correct outcomes. Expected answers appear after a scored run.",
    }


def REPO_EVAL_LATEST() -> Path:
    from pathlib import Path

    repo = Path(__file__).resolve().parent.parent
    return repo / "runs" / "demo_eval" / "latest.json"


def activity_rows(limit: int = 80) -> list[dict]:
    path = website_dir() / "activity.jsonl"
    if not path.is_file():
        return []
    rows = []
    for line in path.read_text().splitlines():
        if not line.strip():
            continue
        try:
            import json

            rows.append(json.loads(line))
        except Exception:
            continue
    return list(reversed(rows[-limit:]))


def overview() -> dict:
    company = load_company()
    cash = read_json(data_file("cash_position.json")) or {}
    ar = ar_view()
    close = close_view()
    forecast = forecast_view()
    invoices = invoice_rows()
    ap_holds = [item for item in invoices if item["exceptions"]]
    unexplained = 12.40
    briefing = [
        {
            "kind": "close_blocker",
            "title": "September cannot close yet",
            "detail": "Northstar paid $12,412.40 into the bank, but the ledger only records $12,400. Maximor could not explain the extra $12.40, so cash reconciliation — and therefore month-end close — stays incomplete.",
            "record_ids": ["TXN-2026-09-015", "INV-AR-013", "TASK-CASH"],
            "href": "/cash",
        },
        {
            "kind": "ap_action",
            "title": f"{len(ap_holds)} vendor bills still have unresolved checks",
            "detail": "Accounts payable is reviewing vendor invoices that look duplicated, disagree with a purchase order, or are missing expected receiving paperwork.",
            "record_ids": [item["invoice_id"] for item in ap_holds[:6]],
            "href": "/ap",
        },
        {
            "kind": "ar_risk",
            "title": "Some customers have been unpaid for more than 90 days",
            "detail": f"Customers still owe ${ar['outstanding']:,.2f}. Most of that is not overdue yet, but the oldest invoices need collection follow-up.",
            "record_ids": ["INV-AR-005", "INV-AR-014"],
            "href": "/ar",
        },
        {
            "kind": "forecast",
            "title": "Thirteen-week cash outlook is on the books",
            "detail": f"Starting from current cash, Maximor currently expects the company to end the next 13 weeks with ${money(forecast.get('projected_ending_cash') or 0):,.2f}.",
            "record_ids": ["INV-AR-014", "INV-012"],
            "href": "/forecast",
        },
        {
            "kind": "memory",
            "title": "Last month's Harbor Electric decision is available",
            "detail": "Maximor stored how it estimated Harbor Electric in August, including the evidence and method, so September can reuse or override that precedent.",
            "record_ids": ["CASE-001", "INV-021", "ACC-HE-2026-09"],
            "href": "/memory",
        },
    ]
    ops = [
        {"id": "ap", "label": "Accounts Payable", "status": "Needs attention" if ap_holds else "Clear", "href": "/ap", "metric": f"{len(invoices)} invoices"},
        {"id": "ar", "label": "Accounts Receivable", "status": "In progress", "href": "/ar", "metric": f"${ar['outstanding']:,.0f} outstanding"},
        {"id": "cash", "label": "Cash reconciliation", "status": "Cannot finish yet", "href": "/cash", "metric": f"${unexplained:.2f} unexplained"},
        {"id": "close", "label": "Month-end close", "status": str(close["status"]).replace("_", " ").title(), "href": "/close", "metric": str(close["status"]).replace("_", " ").title()},
        {"id": "forecast", "label": "13-week forecast", "status": "Live", "href": "/forecast", "metric": f"${money(forecast.get('projected_ending_cash') or 0):,.0f} ending"},
        {"id": "audit", "label": "Audit & controls", "status": "Ready", "href": "/audit", "metric": "Independent sampling"},
    ]
    timeline = read_json(data_file("timeline.json")) or []
    return {
        "header": "Autonomous Office of the CFO",
        "company": company,
        "metrics": {
            "cash": money(cash.get("bank_balance") or 0),
            "ap_outstanding": _ap_outstanding(),
            "ar_outstanding": ar["outstanding"],
            "projected_13w_ending_cash": money(forecast.get("projected_ending_cash") or 0),
            "unreconciled_items": unexplained,
            "close_status": close["status"],
            "open_audit_findings": None,
            "active_bots": 15,
        },
        "briefing": briefing,
        "operations": ops,
        "recent_decisions": timeline[-12:],
        "timeline": timeline,
        "activity": activity_rows(20),
        "stripe": stripe_status(),
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }


def lineage_view(record_id: str) -> dict:
    from cfo.lineage_story import describe_event

    row = _lineage_index().get(record_id)
    invoices = {item["invoice_id"]: item for item in invoice_rows()}
    journals = _journals_by_source()
    payments = _payments_by_invoice()
    story = describe_event(record_id)
    return {
        "record_id": record_id,
        "title": story.get("title") or record_id,
        "received": story.get("received"),
        "decision": story.get("decision"),
        "why": story.get("why"),
        "changed": story.get("changed") or [],
        "correct": story.get("correct"),
        "steps": story.get("steps") or [],
        "lineage": row,
        "invoice": invoices.get(record_id),
        "journals": journals.get(record_id) or [],
        "payments": payments.get(record_id) or [],
        "consistency": consistency_for(record_id) if record_id.startswith("INV-") else story.get("consistency"),
        "explanation": story,
    }


def consistency_for(invoice_id: str) -> dict:
    """Same invoice identity and amount across AP, payment, bank, GL, forecast, close, audit."""
    from tools import load_invoice

    invoice = load_invoice(invoice_id)
    if invoice is None:
        return {"ok": False, "error": f"missing invoice {invoice_id}"}
    amount = money(invoice.amount)
    amount_cents = int(round(amount * 100))
    payments = _payments_by_invoice().get(invoice_id) or []
    journals = [item for item in (read_json(data_file("close", "journal_entries.json")) or []) if invoice_id in (item.get("related_ids") or []) or item.get("source_document_id") == invoice_id]
    bank = [
        item
        for item in (read_json(data_file("cash_recon", "bank_statement.json")) or [])
        if invoice_id in ((item.get("raw_metadata") or {}).get("invoice_ids") or [])
    ]
    forecast_lines = [
        item
        for item in (read_json(data_file("reporting", "forecast_lines.json")) or [])
        if invoice_id in str(item.get("source_id") or item.get("line_id") or "")
    ]
    close_tasks = [
        item
        for item in (read_json(data_file("close", "tasks.json")) or [])
        if invoice_id in (item.get("evidence_refs") or [])
    ]
    audit_invoices = [
        item
        for item in (read_json(data_file("audit", "invoices.json")) or [])
        if item.get("invoice_id") == invoice_id
    ]
    payment_amounts = [int(item.get("amount_minor") or 0) for item in payments]
    journal_amounts = [int(item.get("amount_minor") or 0) for item in journals]
    bank_amounts = [abs(int(item.get("amount_minor") or 0)) for item in bank]
    mismatches = []
    for label, values in (("payment", payment_amounts), ("journal", journal_amounts), ("bank", bank_amounts)):
        for value in values:
            if label == "payment" and len((payments[0].get("invoice_ids") or [])) > 1:
                continue
            if value and value != amount_cents:
                mismatches.append({"surface": label, "amount_minor": value, "expected": amount_cents})
    return {
        "ok": not mismatches,
        "invoice_id": invoice_id,
        "vendor": invoice.vendor,
        "amount": amount,
        "amount_minor": amount_cents,
        "ap": {"invoice_id": invoice_id, "amount": amount},
        "payments": payments,
        "journals": journals,
        "bank": bank,
        "forecast_lines": forecast_lines,
        "close_tasks": close_tasks,
        "audit": audit_invoices,
        "mismatches": mismatches,
    }


def agents_view() -> dict:
    return {
        "bots": grain_agents(),
        "activity": activity_rows(100),
        "architecture": architecture_payload(),
    }


def inbox_sample(sample_id: str) -> dict | None:
    packed = artifacts.email_artifact(sample_id)
    if packed is None:
        return None
    return {"sample_id": sample_id, "artifact": packed, **artifacts.ingest_sample_inputs(sample_id)}


def company_state() -> dict:
    cash = read_json(data_file("cash_position.json")) or {}
    close = close_view()
    ar = ar_view()
    forecast = forecast_view()
    invoices = invoice_rows()
    exceptions = [item for item in invoices if item.get("exceptions")]
    memories = []
    try:
        from memory.store import load_memories

        memories = dump(load_memories()) or []
    except Exception:
        memories = []
    journals = read_json(data_file("close", "journal_entries.json")) or []
    return {
        "cash": money(cash.get("bank_balance") or 0),
        "ap_outstanding": _ap_outstanding(),
        "ar_outstanding": ar["outstanding"],
        "close_status": close["status"],
        "close_tasks": artifacts.close_task_snapshot(),
        "unreconciled_item": "TXN-2026-09-015",
        "exception_invoices": [item["invoice_id"] for item in exceptions],
        "exception_count": len(exceptions),
        "projected_ending_cash": money(forecast.get("projected_ending_cash") or 0),
        "journal_count": len(journals),
        "decision_memory_count": len(memories),
        "period": PERIOD,
        "open_ap": [item["invoice_id"] for item in invoices if item.get("payment_state") != "paid"][:12],
        "open_ar": [item.get("invoice_id") for item in ar.get("invoices") or [] if (item.get("outstanding_amount") or 0) > 0][:12],
    }
