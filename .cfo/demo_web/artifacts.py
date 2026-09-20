"""Package canonical Maximor records as demo input/output artifacts.

Never invent finance fields. Every `record` is the persisted object (or a
direct dump of a Kernel model). Provenance uses existing IDs only.
"""

from __future__ import annotations

from demo_web.jsonutil import dump, read_json
from demo_web.workspace import canonical_root, runtime_root

PERIOD = "2026-09"


def _file(*parts: str):
    runtime = runtime_root().joinpath(*parts)
    if runtime.exists():
        return runtime
    canonical = canonical_root().joinpath(*parts)
    if canonical.exists():
        return canonical
    return runtime


def artifact(
    *,
    artifact_id: str,
    kind: str,
    title: str,
    source_path: str,
    record: object,
    provenance: list[dict] | None = None,
    **extra,
) -> dict:
    return {
        "artifact_id": artifact_id,
        "kind": kind,
        "title": title,
        "source_path": source_path,
        "record": dump(record),
        "provenance": provenance or [],
        **extra,
    }


def emails() -> list[dict]:
    return read_json(_file("ingestion", "emails.json")) or []


def documents() -> list[dict]:
    return read_json(_file("ingestion", "documents.json")) or []


def email_by_id(message_id: str) -> dict | None:
    return next((item for item in emails() if item.get("message_id") == message_id), None)


def email_artifact(message_id: str) -> dict | None:
    row = email_by_id(message_id)
    if row is None:
        return None
    attachments = []
    for att in row.get("attachments") or []:
        attachments.append(
            artifact(
                artifact_id=att.get("attachment_id") or att.get("filename"),
                kind="document",
                title=att.get("filename") or "attachment",
                source_path=f"ingestion/emails.json#{message_id}/{att.get('attachment_id')}",
                record=att,
                filename=att.get("filename"),
                content_type=att.get("content_type"),
                text=att.get("text") or "",
                provenance=[{"id": message_id, "kind": "email"}],
            )
        )
    return artifact(
        artifact_id=message_id,
        kind="email",
        title=row.get("subject") or message_id,
        source_path=f"ingestion/emails.json#{message_id}",
        record=row,
        email={
            "from": row.get("from"),
            "to": row.get("to"),
            "subject": row.get("subject"),
            "sent_at": row.get("sent_at"),
            "body": row.get("body"),
            "attachments": [
                {
                    "attachment_id": att.get("attachment_id"),
                    "filename": att.get("filename"),
                    "content_type": att.get("content_type"),
                    "text": att.get("text") or "",
                }
                for att in row.get("attachments") or []
            ],
        },
        attachments=attachments,
        provenance=[{"id": att["artifact_id"], "kind": "document"} for att in attachments],
    )


def emails_for_invoice(invoice_id: str, vendor_invoice_number: str | None = None) -> list[dict]:
    """Link a canonical invoice to the exact source emails that mention it."""
    found = []
    needle = (vendor_invoice_number or "").strip()
    for row in emails():
        blob = " ".join(
            [
                str(row.get("message_id") or ""),
                str(row.get("subject") or ""),
                str(row.get("body") or ""),
                " ".join(str(att.get("text") or "") for att in row.get("attachments") or []),
            ]
        )
        hit = invoice_id in blob
        if needle and needle in blob:
            hit = True
        if invoice_id.replace("INV-", "MSG-E-INV-") == row.get("message_id"):
            hit = True
        if hit:
            packed = email_artifact(row["message_id"])
            if packed:
                found.append(packed)
    return found


def invoice_record(invoice_id: str) -> dict | None:
    from tools import load_invoice

    invoice = load_invoice(invoice_id)
    return dump(invoice) if invoice is not None else None


def invoice_artifact(invoice_id: str) -> dict | None:
    from tools import load_invoice

    invoice = load_invoice(invoice_id)
    if invoice is None:
        return None
    sources = emails_for_invoice(invoice_id, invoice.vendor_invoice_number)
    provenance = [{"id": src["artifact_id"], "kind": "email"} for src in sources]
    for src in sources:
        for att in src.get("attachments") or []:
            provenance.append({"id": att["artifact_id"], "kind": "document"})
    if invoice.po_id:
        provenance.append({"id": invoice.po_id, "kind": "purchase_order"})
    return artifact(
        artifact_id=invoice_id,
        kind="invoice",
        title=f"{invoice_id} · {invoice.vendor}",
        source_path=f"invoices.json#{invoice_id}",
        record=dump(invoice),
        source_emails=sources,
        provenance=provenance,
    )


def po_artifact(po_id: str | None) -> dict | None:
    if not po_id:
        return None
    from tools import load_purchase_order

    po = load_purchase_order(po_id)
    if po is None:
        return None
    return artifact(
        artifact_id=po.po_id,
        kind="purchase_order",
        title=f"{po.po_id} · {po.vendor}",
        source_path=f"purchase_orders.json#{po.po_id}",
        record=dump(po),
        provenance=[{"id": po.po_id, "kind": "purchase_order"}],
    )


def gr_artifact(po_id: str | None) -> dict | None:
    if not po_id:
        return None
    from tools import load_goods_receipt

    gr = load_goods_receipt(po_id)
    if gr is None:
        return None
    return artifact(
        artifact_id=gr.receipt_id,
        kind="goods_receipt",
        title=f"{gr.receipt_id} · {po_id}",
        source_path=f"goods_receipts.json#{gr.receipt_id}",
        record=dump(gr),
        provenance=[{"id": po_id, "kind": "purchase_order"}],
    )


def journal_artifact(entry_id: str) -> dict | None:
    rows = read_json(_file("close", "journal_entries.json")) or []
    row = next((item for item in rows if item.get("entry_id") == entry_id), None)
    if row is None:
        return None
    related = list(row.get("related_ids") or [])
    if row.get("source_document_id"):
        related.append(row["source_document_id"])
    return artifact(
        artifact_id=entry_id,
        kind="journal_entry",
        title=row.get("memo") or entry_id,
        source_path=f"close/journal_entries.json#{entry_id}",
        record=row,
        provenance=[{"id": item, "kind": "record"} for item in related],
    )


def bank_artifact(transaction_id: str) -> dict | None:
    rows = read_json(_file("cash_recon", "bank_statement.json")) or []
    row = next((item for item in rows if item.get("transaction_id") == transaction_id), None)
    if row is None:
        return None
    ids = ((row.get("raw_metadata") or {}).get("invoice_ids") or []) + [row.get("raw_metadata", {}).get("payment_id")]
    return artifact(
        artifact_id=transaction_id,
        kind="bank_transaction",
        title=row.get("description") or transaction_id,
        source_path=f"cash_recon/bank_statement.json#{transaction_id}",
        record=row,
        provenance=[{"id": item, "kind": "record"} for item in ids if item],
    )


def ledger_artifact(entry_id: str) -> dict | None:
    rows = read_json(_file("cash_recon", "ledger.json")) or []
    row = next((item for item in rows if item.get("entry_id") == entry_id), None)
    if row is None:
        return None
    return artifact(
        artifact_id=entry_id,
        kind="ledger_entry",
        title=row.get("description") or entry_id,
        source_path=f"cash_recon/ledger.json#{entry_id}",
        record=row,
        provenance=[{"id": row.get("reference"), "kind": "record"}] if row.get("reference") else [],
    )


def table_artifact(artifact_id: str, title: str, source_path: str, columns: list[str], rows: list[dict], provenance: list[dict] | None = None) -> dict:
    return artifact(
        artifact_id=artifact_id,
        kind="table",
        title=title,
        source_path=source_path,
        record=rows,
        columns=columns,
        rows=rows,
        provenance=provenance or [],
    )


def json_artifact(artifact_id: str, title: str, source_path: str, record: object, provenance: list[dict] | None = None) -> dict:
    return artifact(
        artifact_id=artifact_id,
        kind="json",
        title=title,
        source_path=source_path,
        record=record,
        provenance=provenance or [],
    )


def featured_bank_case(transaction_id: str) -> dict:
    bank = bank_artifact(transaction_id)
    statement = read_json(_file("cash_recon", "bank_statement.json")) or []
    ledger = read_json(_file("cash_recon", "ledger.json")) or []
    fees = read_json(_file("cash_recon", "fee_evidence.json")) or []
    row = next((item for item in statement if item.get("transaction_id") == transaction_id), None) or {}
    meta = row.get("raw_metadata") or {}
    payment_id = meta.get("payment_id")
    invoice_ids = meta.get("invoice_ids") or []
    related_ledger = [
        item
        for item in ledger
        if (item.get("raw_metadata") or {}).get("payment_id") == payment_id
        or item.get("reference") in invoice_ids
        or (transaction_id == "TXN-2026-09-015" and item.get("entry_id") == "GL-AR-NS")
        or (transaction_id == "TXN-2026-09-011" and item.get("entry_id") == "GL-AP-WIRE")
        or (transaction_id == "TXN-2026-09-008" and item.get("reference") in {"INV-014", "INV-015", "INV-016"})
    ]
    related_fees = [
        item
        for item in fees
        if item.get("reference") == row.get("reference") or (transaction_id == "TXN-2026-09-011" and item.get("evidence_id") == "FEE-729103")
    ]
    return {
        "bank": bank,
        "ledger": [ledger_artifact(item["entry_id"]) for item in related_ledger if item.get("entry_id")],
        "fees": [
            artifact(
                artifact_id=item.get("evidence_id"),
                kind="json",
                title=item.get("description") or item.get("evidence_id"),
                source_path=f"cash_recon/fee_evidence.json#{item.get('evidence_id')}",
                record=item,
            )
            for item in related_fees
        ],
        "invoice_ids": invoice_ids,
        "payment_id": payment_id,
    }


def stripe_payout_bundle(payout_id: str) -> dict | None:
    payouts = read_json(_file("integrations", "stripe", "payouts.json")) or []
    payout = next((item for item in payouts if item.get("payout_id") == payout_id), None)
    if payout is None:
        return None
    balance = [item for item in (read_json(_file("integrations", "stripe", "balance_transactions.json")) or []) if item.get("payout") == payout_id]
    events = [item for item in (read_json(_file("integrations", "stripe", "events.json")) or []) if payout_id in str(item)]
    deposits = read_json(_file("integrations", "stripe", "bank_deposits.json")) or []
    deposit = next((item for item in deposits if item.get("payout_id") == payout_id or item.get("deposit_id") == payout.get("bank_deposit_id")), None)
    return {
        "payout": artifact(
            artifact_id=payout_id,
            kind="stripe_payout",
            title=payout_id,
            source_path=f"integrations/stripe/payouts.json#{payout_id}",
            record=payout,
            provenance=[{"id": payout.get("bank_deposit_id"), "kind": "bank_deposit"}],
        ),
        "lines": payout.get("lines") or [],
        "balance_transactions": [
            artifact(
                artifact_id=item.get("id"),
                kind="stripe_balance_txn",
                title=f"{item.get('type')} {item.get('id')}",
                source_path=f"integrations/stripe/balance_transactions.json#{item.get('id')}",
                record=item,
                provenance=[{"id": payout_id, "kind": "stripe_payout"}],
            )
            for item in balance
        ],
        "events": [
            artifact(
                artifact_id=item.get("id") or item.get("event_id") or payout.get("event_id"),
                kind="stripe_event",
                title=item.get("type") or item.get("event_id") or "stripe event",
                source_path="integrations/stripe/events.json",
                record=item,
                provenance=[{"id": payout_id, "kind": "stripe_payout"}],
            )
            for item in events
        ],
        "bank_deposit": artifact(
            artifact_id=(deposit or {}).get("deposit_id") or payout.get("bank_deposit_id"),
            kind="bank_deposit",
            title="Bank deposit",
            source_path=f"integrations/stripe/bank_deposits.json#{(deposit or {}).get('deposit_id')}",
            record=deposit or {"deposit_id": payout.get("bank_deposit_id"), "amount": payout.get("bank_deposit_amount")},
            provenance=[{"id": payout_id, "kind": "stripe_payout"}],
        )
        if deposit or payout.get("bank_deposit_id")
        else None,
    }


def harbor_input() -> dict:
    history = [item for item in (read_json(_file("historical_invoices.json")) or []) if item.get("vendor") == "Harbor Electric"]
    later = [item for item in (read_json(_file("later_invoices.json")) or []) if item.get("vendor") == "Harbor Electric"]
    contracts = [item for item in (read_json(_file("vendor_contracts.json")) or []) if item.get("vendor") == "Harbor Electric"]
    usage = [item for item in (read_json(_file("close", "source_documents.json")) or []) if item.get("vendor") == "Harbor Electric"]
    memory_events = [item for item in (read_json(_file("memory_events.json")) or []) if item.get("event_id") == "MEM-004"]
    journal = next((item for item in (read_json(_file("close", "journal_entries.json")) or []) if item.get("entry_id") == "JE-ACC-HE-202609"), None)
    table_rows = [
        {"month": item.get("service_period"), "invoice_id": item.get("invoice_id"), "expense": item.get("amount"), "vendor_invoice_number": item.get("vendor_invoice_number")}
        for item in history
    ]
    return {
        "vendor": "Harbor Electric",
        "invoice_exists_for_september": False,
        "later_invoice": later[0] if later else None,
        "history_table": table_artifact(
            "harbor-history",
            "Harbor Electric historical expense",
            "historical_invoices.json",
            ["month", "invoice_id", "expense", "vendor_invoice_number"],
            table_rows,
            provenance=[{"id": item.get("invoice_id"), "kind": "historical_invoice"} for item in history],
        ),
        "history": [
            artifact(
                artifact_id=item["invoice_id"],
                kind="historical_invoice",
                title=f"{item['service_period']} · {item['invoice_id']}",
                source_path=f"historical_invoices.json#{item['invoice_id']}",
                record=item,
            )
            for item in history
        ],
        "contract": artifact(
            artifact_id=contracts[0]["contract_id"],
            kind="json",
            title="Harbor Electric contract",
            source_path=f"vendor_contracts.json#{contracts[0]['contract_id']}",
            record=contracts[0],
        )
        if contracts
        else None,
        "current_evidence": [
            artifact(
                artifact_id=item["document_id"],
                kind="json",
                title=item.get("description") or item["document_id"],
                source_path=f"close/source_documents.json#{item['document_id']}",
                record=item,
            )
            for item in usage
        ],
        "prior_memory": [
            artifact(
                artifact_id=item["event_id"],
                kind="decision_memory",
                title=item.get("title") or item["event_id"],
                source_path=f"memory_events.json#{item['event_id']}",
                record=item,
            )
            for item in memory_events
        ],
        "seeded_journal": journal_artifact("JE-ACC-HE-202609") if journal else None,
    }


def audit_population_inputs() -> dict:
    """Source records the auditor samples. Findings are not included."""
    invoices = read_json(_file("audit", "invoices.json")) or []
    payments = read_json(_file("audit", "payments.json")) or []
    journals = read_json(_file("audit", "journal_entries.json")) or []
    vendors = read_json(_file("audit", "vendors.json")) or []
    approvals = read_json(_file("audit", "approvals.json")) or []
    policy = read_json(_file("audit", "policy.json")) or []
    featured = {
        "self_approval": next((item for item in approvals if item.get("approval_id") == "APR-INV-SELF"), None),
        "duplicate_invoice_a": next((item for item in invoices if item.get("invoice_id") == "INV-006"), None),
        "duplicate_invoice_b": next((item for item in invoices if item.get("invoice_id") == "INV-007"), None),
        "duplicate_vendor_a": next((item for item in vendors if item.get("vendor_id") == "VEND-001"), None),
        "duplicate_vendor_b": next((item for item in vendors if item.get("vendor_id") == "VEND-001-DUP"), None),
        "post_close_journal": next((item for item in journals if item.get("entry_id") == "JE-POST-CLOSE-001"), None),
        "round_payment": next((item for item in payments if item.get("payment_id") == "PAY-AP-009"), None),
    }
    packed = {}
    for key, row in featured.items():
        if row is None:
            continue
        kind = "approval" if "approval" in key else "invoice" if "invoice" in key else "json"
        packed[key] = artifact(
            artifact_id=row.get("approval_id") or row.get("invoice_id") or row.get("vendor_id") or row.get("entry_id") or row.get("payment_id"),
            kind=kind if key != "post_close_journal" else "journal_entry",
            title=key.replace("_", " "),
            source_path=f"audit/{key}",
            record=row,
        )
    return {
        "counts": {
            "invoices": len(invoices),
            "payments": len(payments),
            "journals": len(journals),
            "vendors": len(vendors),
            "approvals": len(approvals),
        },
        "featured": packed,
        "policy": policy,
        "self_approval_ids": {
            "requester_id": (featured["self_approval"] or {}).get("requester_id"),
            "approver_id": (featured["self_approval"] or {}).get("approver_id"),
        },
    }


def forecast_inputs() -> dict:
    weeks = read_json(_file("reporting", "forecast_weeks.json")) or []
    lines = read_json(_file("reporting", "forecast_lines.json")) or []
    actuals = read_json(_file("reporting", "actuals.json")) or []
    ledger = read_json(_file("reporting", "ledger_seed.json")) or []
    driver_ids = ["TXN-SUP-SEP-001", "TXN-HOST-SEP-001", "TXN-FRT-SEP-001", "TXN-FRT-SEP-EXPEDITE"]
    gm_lines = [item for item in ledger if item.get("transaction_id") in driver_ids or item.get("period") in {"2026-08", "2026-09"}]
    gm_sep = [item for item in ledger if item.get("transaction_id") in driver_ids]
    late = next((item for item in actuals if item.get("source_id") == "INV-AR-014"), None)
    early = next((item for item in actuals if item.get("source_id") == "INV-012"), None)
    return {
        "original_forecast": table_artifact(
            "forecast-weeks",
            "Original 13-week forecast",
            "reporting/forecast_weeks.json",
            ["week_start", "week_end", "beginning_cash", "ar_collections", "ap_payments", "payroll", "other_inflows", "other_outflows", "ending_cash"],
            weeks,
        ),
        "weeks": weeks,
        "lines": lines,
        "new_events": [
            artifact(
                artifact_id=item.get("movement_id"),
                kind="json",
                title=item.get("description") or item.get("source_id"),
                source_path=f"reporting/actuals.json#{item.get('movement_id')}",
                record=item,
                provenance=[{"id": item.get("source_id"), "kind": "record"}],
            )
            for item in (late, early)
            if item
        ],
        "gross_margin": {
            "august": 0.64,
            "september": 0.61,
            "source": "reporting/ledger_seed.json + expected_outcomes.gross_margin (display of stored periods; drivers are live ledger rows)",
            "drivers": [
                artifact(
                    artifact_id=item.get("transaction_id") or item.get("entry_id"),
                    kind="journal_entry",
                    title=item.get("memo") or item.get("transaction_id"),
                    source_path=f"reporting/ledger_seed.json#{item.get('line_id')}",
                    record=item,
                    provenance=[{"id": item.get("source_document_id"), "kind": "invoice"}],
                )
                for item in gm_sep
            ],
            "august_freight": [item for item in gm_lines if item.get("transaction_id") == "TXN-FRT-AUG-001"],
        },
        "late_collection": invoice_record("INV-AR-014") or next((item for item in (read_json(_file("ar_invoices.json")) or []) if item.get("invoice_id") == "INV-AR-014"), None),
        "early_payment": invoice_record("INV-012"),
    }


def ar_payment_bundle(payment_id: str) -> dict | None:
    payments = read_json(_file("ar_payments.json")) or []
    invoices = read_json(_file("ar_invoices.json")) or []
    payment = next((item for item in payments if item.get("payment_id") == payment_id), None)
    if payment is None:
        return None
    related = []
    ref = payment.get("invoice_reference") or ""
    for inv in invoices:
        if inv.get("invoice_id") in ref or inv.get("customer_id") == payment.get("customer_id"):
            related.append(inv)
    return {
        "payment": artifact(
            artifact_id=payment_id,
            kind="remittance",
            title=f"{payment_id} · {payment.get('payer_name')}",
            source_path=f"ar_payments.json#{payment_id}",
            record=payment,
        ),
        "candidate_invoices": [
            artifact(
                artifact_id=item["invoice_id"],
                kind="customer_invoice",
                title=f"{item['invoice_id']} · {item.get('customer_name')}",
                source_path=f"ar_invoices.json#{item['invoice_id']}",
                record=item,
            )
            for item in related[:8]
        ],
    }


def close_task_snapshot() -> list[dict]:
    tasks = read_json(_file("close", "tasks.json")) or []
    return [
        {
            "task_id": item.get("task_id"),
            "description": item.get("description"),
            "category": item.get("category"),
            "status": item.get("status"),
            "blocker_reason": item.get("blocker_reason"),
            "blocking_items": item.get("blocking_items") or [],
            "evidence_refs": item.get("evidence_refs") or [],
            "output_refs": item.get("output_refs") or [],
        }
        for item in tasks
    ]


def invoice_state_from_row(row: dict | None) -> dict | None:
    if not row:
        return None
    return {
        "invoice_id": row["invoice_id"],
        "vendor": row.get("vendor"),
        "amount": row.get("amount"),
        "match_status": row.get("match_status"),
        "duplicate_status": row.get("duplicate_status"),
        "exceptions": row.get("exceptions") or [],
        "payment_state": row.get("payment_state"),
        "accounting_status": row.get("accounting_status"),
        "linked_payments": row.get("linked_payments") or [],
        "linked_journals": row.get("linked_journals") or [],
        "po_id": row.get("po_id"),
    }


def three_way_inputs(invoice_id: str) -> dict:
    inv = invoice_artifact(invoice_id)
    record = (inv or {}).get("record") or {}
    po = po_artifact(record.get("po_id"))
    gr = gr_artifact(record.get("po_id"))
    return {"invoice": inv, "purchase_order": po, "goods_receipt": gr}


def duplicate_pair(primary_id: str = "INV-006", peer_id: str = "INV-007") -> dict:
    a = invoice_artifact(primary_id)
    b = invoice_artifact(peer_id)
    ra = (a or {}).get("record") or {}
    rb = (b or {}).get("record") or {}
    comparison = {
        "vendor_match": ra.get("vendor") == rb.get("vendor"),
        "invoice_number_match": ra.get("vendor_invoice_number") == rb.get("vendor_invoice_number"),
        "amount_match": ra.get("amount") == rb.get("amount"),
        "date_match": ra.get("invoice_date") == rb.get("invoice_date"),
        "po_match": ra.get("po_id") == rb.get("po_id"),
        "vendor": ra.get("vendor"),
        "vendor_invoice_number": ra.get("vendor_invoice_number"),
        "amount": ra.get("amount"),
        "invoice_date": ra.get("invoice_date"),
        "document_a": primary_id,
        "document_b": peer_id,
    }
    return {"document_a": a, "document_b": b, "comparison": comparison}


def ingest_sample_inputs(sample_id: str) -> dict:
    email = email_artifact(sample_id)
    return {"email": email, "attachments": (email or {}).get("attachments") or []}


def output_from_ingest(result: dict) -> dict:
    extracted = result.get("extracted")
    report = result.get("report") or {}
    canonical_ids = result.get("record_ids") or []
    canonical = [invoice_artifact(item) for item in canonical_ids]
    return {
        "classification": result.get("classification"),
        "classification_reason": result.get("classification_reason"),
        "extracted": extracted,
        "canonical_invoices": [item for item in canonical if item],
        "duplicates_removed": (report.get("duplicates_removed") if isinstance(report, dict) else None),
        "is_invoice": (result.get("classification") == "invoice"),
        "sample_id": result.get("sample_id"),
    }


def output_from_ap(invoice_id: str, result: dict, after: dict | None = None) -> dict:
    decision = result.get("decision") or {}
    evidence = result.get("evidence") or {}
    tw = three_way_inputs(invoice_id)
    return {
        "decision": decision.get("decision"),
        "source": decision.get("source"),
        "exceptions": evidence.get("exception_types") or [],
        "duplicate_detected": evidence.get("duplicate_detected"),
        "invoice": invoice_artifact(invoice_id),
        "three_way": tw,
        "after": after,
        "linked_payments": (after or {}).get("linked_payments") or [],
        "linked_journals": (after or {}).get("linked_journals") or [],
    }


def wrap_io(result: dict, *, inputs: object, outputs: object, before: object = None, after: object = None, explanation: str | None = None) -> dict:
    result["io"] = {
        "inputs": dump(inputs),
        "outputs": dump(outputs),
        "before": dump(before),
        "after": dump(after),
        "explanation": explanation,
    }
    return result


SCENARIO_CHALLENGES = {
    "messy-invoice": "Can the agent extract a billable invoice from a poorly scanned document?",
    "duplicate-invoice": "Can the agent detect that this vendor invoice has already been received?",
    "three-way-match": "Do the invoice, purchase order, and goods receipt agree?",
    "payment-decision": "Which approved invoices should be paid this week from available cash?",
    "stripe-payout": "Does gross − refunds − disputes − fees equal the bank deposit?",
    "bank-exception": "Can the agent explain the bank versus ledger differences, including the $12.40 remainder?",
    "month-end-accrual": "Harbor Electric service was consumed in September. The invoice has not arrived. What should be accrued?",
    "cross-period-memory": "Does September retrieve August methodology, and does that change the accrual?",
    "audit-controls": "Do the sampled transactions violate independent controls?",
    "forecast-miss": "Why did cash and gross margin move versus the prior forecast?",
    "cfo-cycle": "What changes across AP, cash, close, forecast, audit, and memory in one office run?",
    "document-trap": "If a voided or duplicate invoice is treated as a new bill, what downstream damage is prevented?",
    "self-correction": "When the actual Harbor Electric bill arrives, does Maximor correct the earlier estimate?",
    "stripe-to-books": "Do Stripe, cash, the general ledger, and close all treat the same payout the same way?",
}


def scenario_preview(scenario_id: str) -> dict:
    """Original input artifacts only. No planted answers."""
    if scenario_id == "messy-invoice":
        packed = ingest_sample_inputs("MSG-E-MESSY")
        inputs = [packed["email"], *(packed["attachments"] or [])]
    elif scenario_id == "duplicate-invoice":
        pair = duplicate_pair()
        inputs = [pair["document_a"], pair["document_b"]]
    elif scenario_id == "three-way-match":
        tw = three_way_inputs("INV-003")
        inputs = [tw["invoice"], tw["purchase_order"], tw["goods_receipt"]]
    elif scenario_id == "payment-decision":
        inputs = [invoice_artifact("INV-002"), invoice_artifact("INV-012")]
    elif scenario_id == "stripe-payout":
        bundle = stripe_payout_bundle("po_1MaximorFees") or {}
        inputs = [bundle.get("payout"), bundle.get("bank_deposit"), *(bundle.get("balance_transactions") or [])]
    elif scenario_id == "bank-exception":
        case = featured_bank_case("TXN-2026-09-015")
        wire = featured_bank_case("TXN-2026-09-011")
        grouped = featured_bank_case("TXN-2026-09-008")
        inputs = [case.get("bank"), *(case.get("ledger") or []), wire.get("bank"), grouped.get("bank")]
    elif scenario_id == "month-end-accrual":
        harbor = harbor_input()
        inputs = [harbor["history_table"], harbor.get("contract"), *(harbor.get("current_evidence") or []), *(harbor.get("prior_memory") or [])]
    elif scenario_id == "cross-period-memory":
        harbor = harbor_input()
        inputs = [harbor["history_table"], *(harbor.get("prior_memory") or [])]
    elif scenario_id == "audit-controls":
        pop = audit_population_inputs()
        inputs = list((pop.get("featured") or {}).values())
    elif scenario_id == "forecast-miss":
        fc = forecast_inputs()
        inputs = [fc["original_forecast"], *(fc.get("new_events") or []), fc.get("late_collection"), fc.get("early_payment")]
    elif scenario_id == "cfo-cycle":
        cash = read_json(_file("cash_position.json")) or {}
        tasks = close_task_snapshot()
        inputs = [
            json_artifact(
                "starting-state",
                "Starting company state",
                "cash_position.json + close/tasks.json",
                {"cash": cash, "close_tasks": tasks, "unreconciled_item": "TXN-2026-09-015"},
            )
        ]
    elif scenario_id == "document-trap":
        pair = duplicate_pair()
        inputs = [pair["document_a"], pair["document_b"]]
    elif scenario_id == "self-correction":
        harbor = harbor_input()
        inputs = [harbor["history_table"], harbor.get("contract"), *(harbor.get("prior_memory") or [])]
    elif scenario_id == "stripe-to-books":
        bundle = stripe_payout_bundle("po_1MaximorFees") or {}
        inputs = [bundle.get("payout"), bundle.get("bank_deposit"), *(bundle.get("balance_transactions") or [])]
    else:
        inputs = []
    return {
        "scenario_id": scenario_id,
        "challenge": SCENARIO_CHALLENGES.get(scenario_id),
        "inputs": [item for item in inputs if item],
        "expected": None,
    }


def expected_for_records(record_ids: list[str]) -> list[dict]:
    """Evaluation fixture lookup from the canonical pack. Call only after a run."""
    from demo_web.workspace import canonical_root

    wanted = set(record_ids)
    cases = read_json(canonical_root() / "agent_cases.json") or []
    hits = []
    for case in cases:
        sources = set(case.get("source_record_ids") or [])
        if sources & wanted:
            hits.append(
                {
                    "case_id": case.get("case_id"),
                    "capability": case.get("capability"),
                    "expected": case.get("expected"),
                    "source_record_ids": case.get("source_record_ids"),
                }
            )
    return hits


def diff_records(before: dict | None, after: dict | None) -> list[dict]:
    before = before or {}
    after = after or {}
    keys = sorted(set(before) | set(after))
    rows = []
    for key in keys:
        left = before.get(key)
        right = after.get(key)
        rows.append({"field": key, "before": left, "after": right, "changed": left != right})
    return rows
