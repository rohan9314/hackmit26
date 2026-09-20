"""Invoke existing Kernel workflows. Persist structured traces for the UI."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable
from uuid import uuid4

from demo_web.jsonutil import dump
from demo_web.workspace import activity_path, canonical_root, live_llm_requested, results_dir, runtime_root, website_dir
from demo_web.bots import display_name_to_bot
from demo_web import artifacts
from demo_web.inbox_examples import INBOX_EXAMPLES, curated_ids, example_by_id, group_for, group_label

PERIOD = "2026-09"
AS_OF = "2026-09-30"


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _trace_id() -> str:
    return "web_" + uuid4().hex[:12]


def _append_activity(row: dict) -> None:
    path = activity_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a") as handle:
        handle.write(json.dumps(row, default=str) + "\n")


def _save_result(trace_id: str, payload: dict) -> Path:
    dest = results_dir() / f"{trace_id}.json"
    dest.write_text(json.dumps(payload, indent=2, default=str) + "\n")
    index_path = website_dir() / "traces_index.json"
    index = []
    if index_path.is_file():
        try:
            index = json.loads(index_path.read_text())
        except json.JSONDecodeError:
            index = []
    index.append({"trace_id": trace_id, "workflow": payload.get("workflow"), "ts": payload.get("ts")})
    index_path.write_text(json.dumps(index[-200:], indent=2) + "\n")
    return dest


def _handoff(display_names: list[str]) -> list[dict]:
    mapping = display_name_to_bot()
    rows = []
    for name in display_names:
        meta = mapping.get(name) or {}
        rows.append({"display_name": name, **meta})
    return rows


def run_logged(workflow: str, fn: Callable[[], dict], *, bots: list[str], record_ids: list[str] | None = None) -> dict:
    trace_id = _trace_id()
    started = _now()
    _append_activity(
        {
            "ts": started,
            "trace_id": trace_id,
            "workflow": workflow,
            "status": "running",
            "bots": bots,
            "record_ids": record_ids or [],
        }
    )
    try:
        result = fn()
        payload = {
            "ok": True,
            "trace_id": trace_id,
            "workflow": workflow,
            "ts": started,
            "completed_at": _now(),
            "status": "completed",
            "bots": bots,
            "record_ids": record_ids or result.get("record_ids") or [],
            "live_llm": live_llm_requested(),
            "result": dump(result),
        }
        path = _save_result(trace_id, payload)
        payload["result_path"] = str(path)
        _append_activity(
            {
                "ts": payload["completed_at"],
                "trace_id": trace_id,
                "workflow": workflow,
                "status": "completed",
                "bots": bots,
                "record_ids": payload["record_ids"],
                "summary": result.get("summary"),
            }
        )
        return payload
    except Exception as exc:
        payload = {
            "ok": False,
            "trace_id": trace_id,
            "workflow": workflow,
            "ts": started,
            "completed_at": _now(),
            "status": "failed",
            "bots": bots,
            "record_ids": record_ids or [],
            "error": {"type": type(exc).__name__, "message": str(exc)},
            "result": None,
        }
        _save_result(trace_id, payload)
        _append_activity(
            {
                "ts": payload["completed_at"],
                "trace_id": trace_id,
                "workflow": workflow,
                "status": "failed",
                "bots": bots,
                "error": str(exc),
            }
        )
        return payload


def load_trace(trace_id: str) -> dict | None:
    path = results_dir() / f"{trace_id}.json"
    if not path.is_file():
        return None
    return json.loads(path.read_text())


def list_traces() -> list[dict]:
    index_path = website_dir() / "traces_index.json"
    if not index_path.is_file():
        return []
    try:
        return json.loads(index_path.read_text())
    except json.JSONDecodeError:
        return []


def _load_emails() -> list[dict]:
    from demo_web.jsonutil import read_json

    return (
        read_json(runtime_root() / "ingestion" / "emails.json")
        or read_json(canonical_root() / "ingestion" / "emails.json")
        or []
    )


def _identify_story(classification: str, booked: bool, reason: str) -> dict:
    kind = classification.replace("_", " ")
    article = "an" if kind[:1].lower() in "aeiou" else "a"
    if booked:
        changed = "Maximor classified this as a vendor invoice and added it to accounts payable for further matching."
    elif classification == "invoice":
        changed = "Maximor classified this as a vendor invoice. A matching bill is already on the payable ledger, so no second amount owed was created."
    elif classification == "quote":
        changed = "This was a quote, not an invoice. Maximor did not create a payable and did not change the ledger."
    elif classification == "receipt":
        changed = "This was a receipt for a purchase that was already paid. Maximor did not create a payable."
    elif classification == "statement":
        changed = "This was an account statement listing earlier invoices, not a new bill. Nothing was added to accounts payable."
    elif classification == "purchase_order":
        changed = "This was a purchase order — Maximor's own authorization to buy — not a vendor bill. Nothing was booked."
    elif classification == "not_invoice":
        changed = "Maximor could not treat this as a complete vendor invoice, so it did not change the payable ledger."
    elif "duplicate" in reason.lower():
        changed = "This looks like a second copy of a bill already on file. Maximor did not create another amount owed."
    else:
        changed = f"Maximor identified this as {article} {kind} and did not create a vendor bill."
    return {"what_changed": changed, "decision": "booked" if booked else "not_booked"}


def ingest_sample(sample_id: str | None = None, *, all_sources: bool = False) -> dict:
    from invoice_ingestion.interpret import interpret_email
    from invoice_ingestion.workflow import ingest_candidates, ingest_invoices

    if all_sources:
        report = ingest_invoices(PERIOD, use_llm=False, forward_to_ap=True, run_ap=False, reset_overlay=False)
        return {
            "summary": f"Recognized {len(report.canonical_invoices)} vendor invoices from incoming documents",
            "report": dump(report),
            "stages": _ingest_stages(report),
            "record_ids": [item.invoice_id for item in report.canonical_invoices],
            "handoffs": _handoff(["Email Invoice Agent", "AP Preparer"]),
        }

    emails = _load_emails()
    email = next((item for item in emails if item.get("message_id") == sample_id), None)
    if email is None:
        email = next((item for item in emails if item.get("message_id") == "MSG-E-INV-001"), emails[0] if emails else None)
    if email is None:
        raise ValueError("No ingestion email samples in the Maximor pack")
    classification, reason, candidates = interpret_email(email)
    report = ingest_candidates(candidates, PERIOD, forward_to_ap=True, run_ap=False, reset_overlay=False)
    picked = dump(candidates[0]) if candidates else None
    booked = bool(report.canonical_invoices)
    story = _identify_story(classification, booked, reason)
    meta = example_by_id(str(email.get("message_id") or "")) or {}
    extracted = {
        "vendor": (picked or {}).get("vendor") or "—",
        "invoice_number": (picked or {}).get("vendor_invoice_number") or (picked or {}).get("invoice_number") or "—",
        "amount": (picked or {}).get("amount"),
        "po_number": (picked or {}).get("po_id") or (picked or {}).get("po_number") or "—",
    }
    kind = classification.replace("_", " ")
    if classification == "not_invoice":
        summary = "The document was identified as not a vendor invoice"
    else:
        summary = f"The document was identified as {'an' if classification[:1] in 'aeiou' else 'a'} {kind}"
    payload = {
        "summary": summary,
        "sample_id": email.get("message_id"),
        "classification": classification,
        "classification_reason": reason,
        "extracted": extracted,
        "candidates": dump(candidates),
        "report": dump(report),
        "what_changed": story["what_changed"],
        "title": meta.get("title") or email.get("subject"),
        "stages": [
            {
                "id": "received",
                "label": "Document Intake read the email and attachment.",
                "status": "completed",
                "bot": "email",
                "detail": meta.get("title") or email.get("subject"),
            },
            {
                "id": "classified",
                "label": "Document Intake identified what kind of document arrived.",
                "status": "completed",
                "bot": "email",
                "detail": reason,
            },
            {
                "id": "fields",
                "label": "Accounts Payable checked whether the document creates an amount the company owes.",
                "status": "completed",
                "bot": "ap",
                "detail": "A vendor bill is created only when this is actually an invoice.",
            },
            {
                "id": "canonical",
                "label": "Policy Review checked whether the document should enter the payable ledger.",
                "status": "completed" if booked else "skipped",
                "bot": "ctl-pay",
                "detail": ", ".join(item.invoice_id for item in report.canonical_invoices) or "not treated as a vendor invoice",
            },
            {
                "id": "duplicate",
                "label": "Accounts Payable checked for a second copy of the same bill.",
                "status": "completed",
                "bot": "ap",
                "detail": f"{report.duplicates_removed} duplicate copies set aside",
            },
        ],
        "record_ids": [item.invoice_id for item in report.canonical_invoices],
        "handoffs": _handoff(["Email Invoice Agent", "AP Preparer"]),
        "source": email,
    }
    source_id = email.get("message_id")
    return artifacts.wrap_io(
        payload,
        inputs=artifacts.ingest_sample_inputs(source_id),
        outputs={**artifacts.output_from_ingest(payload), "what_changed": story["what_changed"]},
        explanation=reason,
    )


def _ingest_stages(report) -> list[dict]:
    return [
        {"id": "sources", "label": "Incoming documents collected", "status": "completed", "detail": str(len(report.source_runs))},
        {"id": "candidates", "label": "Possible bills reviewed", "status": "completed", "detail": str(len(report.candidates))},
        {"id": "canonical", "label": "Vendor invoices created", "status": "completed", "detail": str(len(report.canonical_invoices))},
        {"id": "duplicates", "label": "Duplicate copies set aside", "status": "completed", "detail": str(report.duplicates_removed)},
    ]


def run_inbox(case_id: str | None = None) -> dict:
    from invoice_ingestion.interpret import interpret_email

    emails = _load_emails()
    by_id = {str(row.get("message_id")): row for row in emails if row.get("message_id")}
    selected = [case_id] if case_id and case_id in by_id else curated_ids()
    rows = []
    for sample_id in selected:
        email = by_id.get(sample_id)
        if email is None:
            continue
        classification, reason, candidates = interpret_email(email)
        meta = example_by_id(sample_id) or {}
        group = group_for(sample_id, classification)
        rows.append(
            {
                "sample_id": sample_id,
                "title": meta.get("title") or email.get("subject"),
                "subject": email.get("subject"),
                "from": email.get("from"),
                "classification": classification,
                "reason": reason,
                "group": group,
                "group_label": group_label(group),
                "would_book": classification == "invoice" and group == "bills_to_process",
                "extracted": dump(candidates[0]) if candidates else None,
            }
        )
    groups: dict[str, list[dict]] = {}
    for row in rows:
        groups.setdefault(row["group"], []).append(row)
    ordered = [
        {"id": key, "label": group_label(key), "items": groups.get(key, [])}
        for key in ("bills_to_process", "do_not_book", "needs_investigation")
        if groups.get(key)
    ]
    payload = {
        "summary": f"Sorted {len(rows)} incoming documents into bills, items not to book, and items that need investigation.",
        "classification": "inbox_sort",
        "items": rows,
        "groups": ordered,
        "examples": INBOX_EXAMPLES,
        "what_changed": "No ledgers were rewritten. This pass only identified which documents are vendor bills and which are not.",
        "stages": [
            {
                "id": "received",
                "label": "Document Intake collected the sample finance inbox.",
                "status": "completed",
                "bot": "email",
                "detail": f"{len(rows)} documents",
            },
            {
                "id": "classified",
                "label": "Document Intake identified each document as an invoice, quote, receipt, statement, purchase order, or something else.",
                "status": "completed",
                "bot": "email",
            },
            {
                "id": "dispatch",
                "label": "Accounts Payable kept vendor bills and left quotes, receipts, statements, and purchase orders off the books.",
                "status": "completed",
                "bot": "ap",
            },
        ],
        "record_ids": [row["sample_id"] for row in rows if row.get("would_book")],
        "handoffs": _handoff(["Email Invoice Agent", "AP Preparer"]),
        "source": {"samples": selected},
    }
    return artifacts.wrap_io(
        payload,
        inputs={"samples": selected, "emails": [by_id.get(item) for item in selected if by_id.get(item)]},
        outputs={"groups": ordered, "items": rows, "what_changed": payload["what_changed"]},
        explanation=payload["summary"],
    )


def run_ap(invoice_id: str) -> dict:
    from close.orchestrator import decide_ap
    from tools import collect_case_evidence, load_invoice
    from demo_web.views import invoice_state
    from cfo.explain import explain_ap, explain_exception
    from cfo.consistency import event_consistency
    from cfo.lineage_story import describe_event

    live = live_llm_requested()
    before = invoice_state(invoice_id)
    result = decide_ap(invoice_id, live=live, featured={invoice_id} if live else set())
    evidence = collect_case_evidence(invoice_id)
    after = invoice_state(invoice_id)
    invoice = load_invoice(invoice_id)
    explanation = explain_ap(
        invoice_id,
        getattr(invoice, "vendor", "") or invoice_id,
        result.decision,
        list(evidence.exception_types),
        amount=getattr(invoice, "amount", None),
    )
    lineage = describe_event(invoice_id)
    consistency = event_consistency(invoice_id)
    naive = None
    if "duplicate" in evidence.exception_types:
        naive = (
            "A naive system would treat this as a new vendor bill, add it to the payment queue, "
            "reduce projected cash, and book another payable. Maximor stopped that chain."
        )
    bots = ["ap", "ctl-pay"]
    handoffs = ["AP Preparer"]
    if evidence.exception_types:
        handoffs.append("Exception Investigator")
    handoffs.extend(["AP Reviewer", "AP Approver", "AP Audit"])
    payload = {
        "summary": explanation["narrative"],
        "decision": dump(result),
        "evidence": dump(evidence),
        "record_ids": [invoice_id],
        "explanation": explanation,
        "naive": naive,
        "lineage": lineage,
        "consistency": consistency,
        "stages": [
            {"id": "facts", "label": "Gather invoice, purchase order, and delivery record", "status": "completed", "detail": ", ".join(explain_exception(item) for item in evidence.exception_types) or "the records agree"},
            {"id": "prepare", "label": "Check whether the bill is safe to pay", "status": "completed", "bot": "ap"},
            {
                "id": "investigate",
                "label": "Investigate why the bill does not line up",
                "status": "completed" if evidence.exception_types else "skipped",
                "bot": "ap",
            },
            {"id": "concur", "label": "Independently recheck the payables decision", "status": "completed", "bot": "ctl-pay", "detail": result.decision},
        ],
        "handoffs": _handoff(handoffs),
        "downstream": {
            "payment_pool": result.decision == "APPROVE",
            "forecast": result.decision == "APPROVE",
            "close": True,
            "audit": True,
        },
    }
    inputs = artifacts.three_way_inputs(invoice_id)
    if invoice_id in {"INV-006", "INV-007"}:
        inputs = artifacts.duplicate_pair()
    return artifacts.wrap_io(
        payload,
        inputs=inputs,
        outputs=artifacts.output_from_ap(invoice_id, payload, after),
        before=before,
        after=after,
        explanation=explanation["narrative"],
    )


def run_schedule() -> dict:
    from close.orchestrator import _run_schedule

    trace = _run_schedule(live=live_llm_requested())
    pay_ids = [item.invoice_id for item in trace.plan.pay_this_week]
    defer_ids = [item.invoice_id for item in trace.plan.defer]
    payload = {
        "summary": f"Include {len(pay_ids)} approved bills in this week's payment run and hold {len(defer_ids)} for later",
        "trace": dump(trace),
        "record_ids": pay_ids + defer_ids,
        "handoffs": _handoff(["Payment Scheduler", "Payment Audit"]),
        "stages": [
            {"id": "pool", "label": "Collect bills that already passed payable checks", "status": "completed", "bot": "pay"},
            {"id": "policy", "label": "Weigh due dates, cash on hand, and payment policy", "status": "completed", "bot": "pay"},
            {"id": "audit", "label": "Independently recheck the payment plan", "status": "completed", "bot": "ctl-pay"},
        ],
    }
    return artifacts.wrap_io(
        payload,
        inputs={"approved_candidates": ["INV-002", "INV-012"], "invoices": [artifacts.invoice_artifact("INV-002"), artifacts.invoice_artifact("INV-012")]},
        outputs={"pay_this_week": pay_ids, "defer": defer_ids, "plan": dump(trace.plan)},
        before={"pay_this_week": [], "defer": []},
        after={"pay_this_week": pay_ids, "defer": defer_ids},
    )


def run_ar_aging() -> dict:
    from ar.workflow import run_aging

    report = run_aging(AS_OF, persist=True)
    payload = {
        "summary": f"Customers currently owe {report.totals.total_ar}",
        "report": dump(report),
        "handoffs": _handoff(["Collections Agent"]),
        "record_ids": [item.invoice_id for item in report.lines[:12]],
    }
    return artifacts.wrap_io(
        payload,
        inputs={"as_of": AS_OF, "invoices": dump(report.lines[:12])},
        outputs={"totals": dump(report.totals), "lines": dump(report.lines)},
    )


def run_ar_collections() -> dict:
    from ar.workflow import run_collections

    result = run_collections(AS_OF, live=False)
    return {
        "summary": "Overdue customer invoices were grouped by how late they are and flagged for follow-up",
        "result": dump(result),
        "handoffs": _handoff(["Collections Agent"]),
        "record_ids": [],
    }


def run_ar_apply(payment_id: str = "PAY-004") -> dict:
    from ar.workflow import run_cash_apply

    trace = run_cash_apply(payment_id, live=False)
    selected = list(getattr(trace.final, "invoice_ids", None) or getattr(trace.final, "related_invoice_ids", None) or [])
    payload = {
        "summary": (
            f"Maximor applied the {payment_id} customer payment to {' and '.join(selected)}"
            if selected
            else f"Maximor could not match the {payment_id} customer payment to a single invoice with enough evidence"
        ),
        "trace": dump(trace),
        "record_ids": [payment_id, *selected],
        "handoffs": _handoff(["Cash Application Agent", "Cash Application Reviewer"]),
        "stages": [
            {"id": "candidates", "label": "List possible invoice matches", "status": "completed", "bot": "apply"},
            {"id": "decide", "label": "Decide whether the payment can be applied safely", "status": "completed", "detail": trace.final.decision, "bot": "apply"},
            {
                "id": "verify",
                "label": "Independently recheck an uncertain match",
                "status": "completed" if trace.final.decision == "HUMAN_REVIEW" else "skipped",
                "bot": "ctl-cash",
            },
        ],
        "downstream": {"forecast": True, "ar_subledger": True, "close": True},
    }
    return artifacts.wrap_io(
        payload,
        inputs=artifacts.ar_payment_bundle(payment_id),
        outputs={"decision": trace.final.decision, "invoice_ids": selected, "final": dump(trace.final)},
        explanation=getattr(trace.final, "reason", None) or getattr(trace.final, "rationale", None),
    )


def run_bank_recon(*, reset: bool = True) -> dict:
    from cash_recon.workflow import run_cash_reconciliation

    report = run_cash_reconciliation(PERIOD, seed_demo=True, use_agent=live_llm_requested(), reset=reset, seed_providers=True)
    unexplained = [
        item for item in report.matches if item.match_type in {"UNEXPLAINED_DIFFERENCE", "UNMATCHED_BANK", "UNMATCHED_LEDGER"} or item.status == "HUMAN_REVIEW"
    ]
    payload = {
        "summary": f"Bank and ledger compared: {len(report.matches)} matches found, {len(unexplained)} still need investigation",
        "report": dump(report.model_copy(update={"traces": [], "agents": []})),
        "record_ids": [tid for match in report.matches for tid in match.bank_transaction_ids],
        "handoffs": _handoff(
            ["Cash Reconciliation Preparer", "Cash Exception Investigator", "Cash Reconciliation Reviewer"]
        ),
        "stages": [
            {"id": "candidates", "label": "List possible bank-to-ledger matches", "status": "completed", "bot": "cash"},
            {"id": "prepare", "label": "Choose how each bank line should be explained", "status": "completed", "bot": "cash"},
            {"id": "investigate", "label": "Investigate differences that do not line up", "status": "completed", "bot": "cash"},
            {"id": "review", "label": "Independently recheck the reconciliation", "status": "completed", "bot": "ctl-cash"},
        ],
    }
    return artifacts.wrap_io(
        payload,
        inputs={
            "unexplained": artifacts.featured_bank_case("TXN-2026-09-015"),
            "fee_netted": artifacts.featured_bank_case("TXN-2026-09-011"),
            "grouped": artifacts.featured_bank_case("TXN-2026-09-008"),
        },
        outputs={"period_status": report.period_status, "matches": dump(report.matches), "unexplained": dump(unexplained)},
    )


def run_stripe_recon() -> dict:
    from demo_web.views import stripe_view
    from cash_recon.workflow import run_cash_reconciliation

    math_view = stripe_view()
    report = run_cash_reconciliation(PERIOD, seed_demo=True, use_agent=False, reset=False, seed_providers=True)
    stripe_matches = [item for item in report.matches if item.provider == "stripe" or item.match_type == "PROVIDER_PAYOUT"]
    payload = {
        "summary": f"Explained {len(math_view['payouts'])} Stripe payouts and tied {len(stripe_matches)} of them to bank deposits",
        "payouts": math_view["payouts"],
        "mode": math_view["mode"],
        "matches": dump(stripe_matches),
        "period_status": report.period_status,
        "record_ids": [item["payout"]["payout_id"] for item in math_view["payouts"]],
        "handoffs": _handoff(["Cash Reconciliation Preparer"]),
        "stages": [
            {"id": "unpack", "label": "Unpack the payout into charges, refunds, fees, and disputes", "status": "completed", "bot": "stripe"},
            {"id": "math", "label": "Check that charges minus refunds, disputes, and fees equal the payout", "status": "completed", "bot": "stripe"},
            {"id": "bank", "label": "Tie the explained payout to the bank deposit", "status": "completed", "bot": "cash"},
            {"id": "gl", "label": "Compare the result with the accounting records", "status": "completed", "bot": "cash"},
        ],
    }
    return artifacts.wrap_io(
        payload,
        inputs=artifacts.stripe_payout_bundle("po_1MaximorFees"),
        outputs={"payouts": math_view["payouts"], "matches": dump(stripe_matches), "period_status": report.period_status},
    )


def run_close() -> dict:
    from close.month_end import run_month_end

    before = artifacts.close_task_snapshot()
    state = run_month_end(PERIOD, scenario="demo", live=False, reset=True, allow_close=False)
    after = artifacts.close_task_snapshot()
    payload = {
        "summary": f"Month-end close is still {str(state.period.status).replace('_', ' ').lower()}",
        "state": dump(state),
        "record_ids": [PERIOD, state.close_id],
        "handoffs": _handoff(["Close Manager", "Accrual Agent", "Prepaid Preparer", "Fixed Asset Preparer", "Month-End Close Reviewer"]),
        "stages": [
            {"id": "ap", "label": "Accounts payable", "status": "completed", "bot": "ap"},
            {"id": "ar", "label": "Accounts receivable", "status": "completed", "bot": "apply"},
            {"id": "cash", "label": "Cash reconciliation", "status": "completed", "bot": "cash"},
            {"id": "accrual", "label": "Estimate missing bills", "status": "completed", "bot": "close"},
            {"id": "prepaid", "label": "Spread prepaid costs", "status": "completed", "bot": "close"},
            {"id": "assets", "label": "Record equipment as assets", "status": "completed", "bot": "close"},
            {"id": "bs", "label": "Check balance-sheet accounts", "status": "completed", "bot": "close"},
            {"id": "lock", "label": "Decide whether the month is ready to lock", "status": "completed", "bot": "ctl-books", "detail": state.period.status},
        ],
    }
    return artifacts.wrap_io(
        payload,
        inputs={"tasks_before": before, "harbor": artifacts.harbor_input()},
        outputs={"period_status": state.period.status, "state": dump(state), "tasks_after": after},
        before={"tasks": before},
        after={"tasks": after, "status": state.period.status},
    )


def run_accrual(vendor: str = "Harbor Electric") -> dict:
    from accrual.workflow import run_accrual_workflow

    report = run_accrual_workflow(PERIOD, reset=True, vendors=[vendor], use_agent=False)
    traces = dump(getattr(report, "traces", None) or [])
    first = traces[0] if traces else {}
    payload = {
        "summary": f"{vendor}: estimated {report.total_accrued_expense} because the current bill has not arrived yet",
        "report": dump(report),
        "record_ids": [vendor, first.get("accrual_id") or "ACC-HE-2026-09", first.get("journal_entry", {}).get("entry_id") if isinstance(first.get("journal_entry"), dict) else None],
        "handoffs": _handoff(["Accrual Agent"]),
        "stages": [
            {"id": "evidence", "label": "Collect contracts, prior bills, and other supporting records", "status": "completed", "bot": "close"},
            {"id": "candidates", "label": "Compare possible ways to estimate the missing bill", "status": "completed", "bot": "close"},
            {"id": "memory", "label": "Retrieve how this was handled last month", "status": "completed", "bot": "close"},
            {"id": "decide", "label": "Choose the estimate", "status": "completed", "bot": "close"},
            {"id": "journal", "label": "Record the formal accounting entry", "status": "completed", "bot": "close"},
        ],
    }
    return artifacts.wrap_io(
        payload,
        inputs=artifacts.harbor_input() if vendor == "Harbor Electric" else {"vendor": vendor},
        outputs={
            "selected_method": first.get("final_method"),
            "amount": first.get("final_amount") if first.get("final_amount") is not None else report.total_accrued_expense,
            "decision": first.get("final_decision"),
            "journal_entry": first.get("journal_entry"),
            "accrual_id": first.get("accrual_id"),
            "written_memory_id": first.get("written_memory_id"),
            "memory_lookup": first.get("memory_lookup"),
            "trace": first,
        },
        explanation=first.get("rationale"),
    )


def run_memory(story: str = "harbor") -> dict:
    from memory.scenarios import run_harbor_cross_period, run_harbor_self_correction, run_stripe_cross_period

    if story == "stripe":
        payload = run_stripe_cross_period(memory_enabled=True)
        summary = "September retrieved August's Stripe payout decision, then re-checked current evidence"
        record_ids = ["po_mem_aug_001", "po_mem_sep_001"]
        agents = ["Cash Reconciliation Preparer"]
    elif story in {"harbor-correct", "self-correction", "correction"}:
        payload = run_harbor_self_correction(memory_enabled=True)
        summary = (payload.get("explanation") or {}).get("narrative") or "Harbor Electric actual bill corrected the earlier estimate"
        record_ids = ["Harbor Electric", "INV-HE-2026-10"]
        agents = ["Accrual Agent"]
    else:
        payload = run_harbor_cross_period(memory_enabled=True)
        summary = "September retrieved August's Harbor Electric method, then re-checked current evidence"
        record_ids = ["Harbor Electric"]
        agents = ["Accrual Agent"]
    body = dump(payload)
    result = {
        "summary": summary,
        "story": story,
        "payload": body,
        "record_ids": record_ids,
        "handoffs": _handoff(agents),
        "explanation": body.get("explanation") if isinstance(body, dict) else None,
    }
    august = body.get("august_trace") or body.get("august")
    september = body.get("september_trace") or body.get("september")
    lookup = body.get("september_lookup") or (september or {}).get("memory_lookup") if isinstance(september, dict) else None
    return artifacts.wrap_io(
        result,
        inputs={
            "harbor": artifacts.harbor_input() if story != "stripe" else None,
            "august_trace": august,
            "memory_enabled": True,
        },
        outputs={
            "september_trace": september,
            "september_lookup": lookup,
            "correction": body.get("october_reconciliation") or body.get("explanation"),
            "written_memory_id": (september or {}).get("written_memory_id") if isinstance(september, dict) else None,
            "final_method": (september or {}).get("final_method") if isinstance(september, dict) else None,
            "final_amount": (september or {}).get("final_amount") if isinstance(september, dict) else None,
            "journal_entry": (september or {}).get("journal_entry") if isinstance(september, dict) else None,
        },
        explanation=summary,
    )


def run_gauntlet(include_existing: bool = False, modes: bool = False) -> dict:
    from demo_web.gauntlet import run_gauntlet_workflow

    return artifacts.wrap_io(
        run_gauntlet_workflow(include_existing=include_existing, modes=modes),
        inputs={"hidden_answers": "grader-only private_answers/", "public_fixtures": "evals/maximor_finance_gauntlet/fixtures/"},
        outputs={"scorecard": "website/maximor_finance_gauntlet.json"},
    )


def run_memory_eval() -> dict:
    from memory.eval import run_memory_evaluation

    payload = run_memory_evaluation()
    dest = website_dir() / "memory_eval.json"
    dest.write_text(json.dumps(dump(payload), indent=2) + "\n")
    result = {"summary": "Compared September with last month's saved decision against estimating from scratch", "payload": dump(payload), "path": str(dest)}
    return artifacts.wrap_io(
        result,
        inputs={"same_original_input": artifacts.harbor_input(), "comparison": "memory_enabled True vs False"},
        outputs=dump(payload),
    )


def run_forecast() -> dict:
    from reporting.forecast import build_forecast
    from reporting.workflow import run_reporting_workflow

    before_weeks = (artifacts.forecast_inputs() or {}).get("weeks") or []
    opening = before_weeks[0].get("beginning_cash") if before_weeks else None
    snapshot = build_forecast("2026-09-19", weeks=13, beginning_cash=opening)
    reporting = None
    try:
        reporting = run_reporting_workflow(period=PERIOD, as_of="2026-09-19", live=False)
    except TypeError:
        reporting = run_reporting_workflow()
    after_weeks = dump(snapshot.weeks)
    original_ending = before_weeks[-1].get("ending_cash") if before_weeks else None
    refreshed_ending = snapshot.weeks[-1].ending_cash if snapshot.weeks else None
    if original_ending is not None and refreshed_ending is not None:
        summary = (
            f"The forecast already on the books ends at ${float(original_ending):,.0f}. "
            f"Refreshing from current collections and open bills currently projects ${float(refreshed_ending):,.0f}."
        )
    else:
        summary = f"The 13-week forecast currently ends at ${float(refreshed_ending or 0):,.0f}"
    payload = {
        "summary": summary,
        "snapshot": dump(snapshot),
        "reporting": dump(reporting),
        "handoffs": _handoff(["Cash Forecast Agent", "Variance Analysis Agent", "Forecast Variance Agent"]),
        "record_ids": ["INV-AR-014", "INV-012"],
    }
    return artifacts.wrap_io(
        payload,
        inputs=artifacts.forecast_inputs(),
        outputs={
            "weeks": after_weeks,
            "reporting": dump(reporting),
            "ending_cash": refreshed_ending,
            "original_ending_cash": original_ending,
        },
        before={"weeks": before_weeks},
        after={"weeks": after_weeks},
    )


def run_audit() -> dict:
    from audit.report import format_audit_report
    from audit.workflow import run_audit
    from evaluation.isolation import evaluation_phase

    run = run_audit(PERIOD, seed=26, use_agent=False, persist=True)
    metrics = None
    with evaluation_phase():
        from audit.eval import evaluate_run
        from audit.store import load_ground_truth

        try:
            metrics = evaluate_run(run, load_ground_truth())
        except Exception:
            metrics = None
    findings = dump(getattr(run, "findings", None) or [])
    payload = {
        "summary": f"Independent audit wrote {len(findings)} control findings",
        "run": dump(run),
        "metrics": dump(metrics),
        "report": format_audit_report(run),
        "handoffs": _handoff(["Auditor Agent", "Audit Report Agent"]),
        "record_ids": ["VEND-001-DUP", "INV-006", "PAY-AP-009", "APR-INV-SELF", "JE-POST-CLOSE-001"],
        "stages": [
            {"id": "sample", "label": "Population sampled", "status": "completed", "bot": "audit"},
            {"id": "controls", "label": "Controls re-performed", "status": "completed", "bot": "audit"},
            {"id": "findings", "label": "Findings written", "status": "completed", "bot": "audit"},
        ],
    }
    return artifacts.wrap_io(
        payload,
        inputs=artifacts.audit_population_inputs(),
        outputs={"findings": findings, "metrics": dump(metrics), "run": dump(run)},
    )


def run_cfo_cycle() -> dict:
    from cfo.scenario import run_cfo_scenario
    from cfo.report import format_cfo_demo
    from demo_web.views import company_state

    before = company_state()
    payload = run_cfo_scenario(persist=True)
    after = company_state()
    dumped = dump(payload)
    result = {
        "summary": f"The connected finance cycle finished with month-end still {str(payload['closed_close'].period.status).replace('_', ' ').lower()}",
        "payload": dumped,
        "narrative": format_cfo_demo(payload),
        "handoffs": _handoff(["Close Manager", "AP Preparer", "Cash Reconciliation Preparer", "Accrual Agent", "Auditor Agent"]),
        "record_ids": ["INV-001", "TXN-2026-09-015", "INV-AR-013"],
        "stages": [
            {"id": "memory", "label": "August memory seeded", "status": "completed", "bot": "close"},
            {"id": "ap", "label": "Featured AP decisions", "status": "completed", "bot": "ap"},
            {"id": "ar", "label": "AR demo apply", "status": "completed", "bot": "apply"},
            {"id": "cash", "label": "Cash reconciliation", "status": "completed", "bot": "cash"},
            {"id": "close", "label": "Month-end (blocked then resolved)", "status": "completed", "bot": "close"},
            {"id": "reporting", "label": "Reporting / forecast", "status": "completed", "bot": "story"},
            {"id": "audit", "label": "Independent audit", "status": "completed", "bot": "audit"},
        ],
    }
    return artifacts.wrap_io(
        result,
        inputs={"starting_company_state": before},
        outputs={"ending_company_state": after, "changes": artifacts.diff_records(before, after), "payload": dumped},
        before=before,
        after=after,
    )


def run_evaluate() -> dict:
    from evals.agent_cases import run_agent_cases

    payload = run_agent_cases()
    dest = website_dir() / "evaluations.json"
    dest.write_text(json.dumps(dump(payload), indent=2) + "\n")
    dumped = dump(payload)
    result = {
        "summary": f"{dumped.get('passed', 0)} of {dumped.get('total', 0)} finance scenarios matched their expected outcomes",
        "payload": dumped,
        "path": str(dest),
        "stages": [
            {"id": "load", "label": "Loaded finance scenarios with hidden expected answers", "status": "completed", "bot": "audit"},
            {"id": "run", "label": "Ran each case through the same workflows used in the live demo", "status": "completed", "bot": "close"},
            {"id": "score", "label": "Compared Maximor's result with the expected fixture", "status": "completed", "bot": "audit"},
        ],
    }
    return artifacts.wrap_io(
        result,
        inputs={"catalog": "agent_cases.json source_record_ids"},
        outputs=dumped,
    )
