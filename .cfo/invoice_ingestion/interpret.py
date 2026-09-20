from __future__ import annotations

import re
from datetime import datetime

from invoice_ingestion.extract import page_refs_from_text
from invoice_ingestion.extract import document_hash as hash_text
from invoice_ingestion.models import InvoiceCandidate, InvoiceEvidence, InvoiceLineItem
from invoice_ingestion.store import (
    attachment_text,
    is_known_vendor,
    known_vendor_names,
    load_record_text,
)

MONEY_RE = re.compile(r"\$?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})|[0-9]+\.[0-9]{2})")
ISO_DATE_RE = re.compile(r"\b(\d{4}-\d{2}-\d{2})\b")
US_DATE_RE = re.compile(r"\b(\d{1,2})/(\d{1,2})/(\d{4})\b")
INVOICE_NUMBER_LABEL_RE = re.compile(
    r"(?:invoice\s*(?:number|#)|inv(?:oice)?\s*#)\s*[:#]?\s*([A-Z0-9][A-Z0-9\-_/]+)",
    re.I,
)
PO_RE = re.compile(r"(?:po|purchase\s*order)\s*(?:number|#)?\s*[:#]?\s*(PO-?\d+)", re.I)
VENDOR_ID_RE = re.compile(r"vendor\s*id\s*[:#]?\s*([A-Z0-9][A-Z0-9\-_/]+)", re.I)


def parse_money(value) -> float | None:
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        number = float(value)
        if number != number or number in {float("inf"), float("-inf")}:
            return None
        return round(number, 2)
    text = str(value).strip().replace("$", "").replace(",", "")
    try:
        return round(float(text), 2)
    except ValueError:
        return None


def labeled_money(text: str, *labels: str) -> float | None:
    for label in labels:
        pattern = re.compile(rf"{label}\s*[:.]?\s*{MONEY_RE.pattern}", re.I)
        match = pattern.search(text)
        if match:
            return parse_money(match.group(1))
    return None


def labeled_text(text: str, *labels: str) -> str | None:
    for label in labels:
        pattern = re.compile(rf"{label}\s*[:#]?\s*(.+)$", re.I | re.M)
        match = pattern.search(text)
        if match:
            value = match.group(1).strip()
            if value:
                return value.splitlines()[0].strip()
    return None


def labeled_date(text: str, *labels: str) -> str | None:
    raw = labeled_text(text, *labels)
    if not raw:
        return first_date(text)
    parsed = normalize_date(raw.split()[0] if raw else raw)
    return parsed


def first_date(text: str) -> str | None:
    iso = ISO_DATE_RE.search(text)
    if iso:
        return iso.group(1)
    match = US_DATE_RE.search(text)
    if match:
        month, day, year = match.groups()
        return f"{year}-{int(month):02d}-{int(day):02d}"
    return None


def normalize_date(value: str | None) -> str | None:
    if not value:
        return None
    text = value.strip()
    if ISO_DATE_RE.fullmatch(text):
        try:
            datetime.strptime(text, "%Y-%m-%d")
            return text
        except ValueError:
            return text
    match = US_DATE_RE.fullmatch(text)
    if match:
        month, day, year = match.groups()
        try:
            dt = datetime(int(year), int(month), int(day))
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            return text
    return text


def infer_vendor(text: str, hint: str | None = None) -> str | None:
    if hint:
        return hint
    lower = text.lower()
    best = None
    best_len = 0
    for name in known_vendor_names():
        if name.lower() in lower and len(name) > best_len:
            best = name
            best_len = len(name)
    if best:
        return best
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith("---"):
            continue
        if stripped.lower() in {"invoice", "scanned vendor invoice", "azure invoice"}:
            continue
        if "invoice" in stripped.lower() and len(stripped) < 24:
            continue
        return stripped
    return None


def looks_like_invoice_text(text: str) -> bool:
    has_number = bool(INVOICE_NUMBER_LABEL_RE.search(text))
    has_total = labeled_money(text, "amount due", "total due", "total", "balance due") is not None
    mentions_invoice = bool(re.search(r"\binvoice\b", text, re.I))
    return mentions_invoice and has_number and has_total


def classify_text(text: str, *, subject: str = "", filename: str = "") -> tuple[str, str]:
    blob = f"{subject}\n{filename}\n{text}".lower()
    invoice_like = looks_like_invoice_text(text)
    if any(token in blob for token in ("unsubscribe", "newsletter", "limited time", "marketing")):
        return "marketing", "Looks like a marketing email, not a vendor invoice"
    if any(token in blob for token in ("credit memo", "credit note", "credit memorandum")):
        return "not_invoice", "Credit memo/credit note, not a payable vendor invoice"
    if any(
        token in blob
        for token in (
            "voided invoice",
            "this invoice is void",
            "void — do not pay",
            "void - do not pay",
            "void: do not pay",
            "do not pay this invoice",
            "cancelled invoice",
            "canceled invoice",
        )
    ):
        return "not_invoice", "Voided invoice, not a payable"
    if any(
        token in blob
        for token in ("stripe payout", "stripe settlement", "stripe transfer to bank")
    ) and not invoice_like:
        return "not_invoice", "Stripe payout is a cash settlement, not a vendor invoice or revenue"
    if any(
        token in blob
        for token in (
            "quotation",
            "quote number",
            "quoted amount",
            "estimate valid",
            "valid through",
            "this is a quote",
            "this is an estimate",
        )
    ) or (re.search(r"\bestimate\b", blob) and not invoice_like):
        return "quote", "Document is a quote/estimate, not an invoice"
    if any(
        token in blob
        for token in (
            "uber trip receipt",
            "uber receipt",
            "lyft",
            "rider receipt",
            "this is a receipt",
        )
    ):
        return "receipt", "Employee/paid receipt, not a vendor invoice"
    if (
        re.search(r"\breceipt\b", blob)
        and ("paid" in blob or "thank you" in blob or "payment received" in blob)
        and not invoice_like
        and "goods receipt" not in blob
        and "goods received" not in blob
    ):
        return "receipt", "Paid receipt, not a vendor invoice"
    if any(token in blob for token in ("payment received", "thank you for your payment", "payment confirmation")):
        return "payment_confirmation", "Payment confirmation, not a request for payment"
    if any(token in blob for token in ("account statement", "statement of account")):
        return "statement", "Account statement rather than an invoice"
    po_markers = (
        "purchase order",
        "purchase request",
        "requisition",
        "this purchase order is not an invoice",
        "this is a po",
    )
    po_missing_context = any(
        token in blob
        for token in (
            "purchase order number is missing",
            "purchase order is missing",
            "missing purchase order",
            "no purchase order",
            "po number is missing",
        )
    )
    if (
        any(token in blob for token in po_markers)
        and not invoice_like
        and not po_missing_context
        and "invoice number" not in blob
        and "amount due" not in blob
    ):
        return "purchase_order", "Purchase order/requisition, not a vendor invoice"
    if any(token in blob for token in ("advance shipping notice", "shipping notice", "packing list")) and not invoice_like:
        return "not_invoice", "Shipping notice/packing list, not a vendor invoice"
    if (
        any(
            token in blob
            for token in (
                "card charge",
                "this is a bank transaction",
                "posted to your account",
                "bank transaction, not a vendor invoice",
            )
        )
        and not invoice_like
    ):
        return "not_invoice", "Bank/card charge, not a vendor invoice"
    if any(token in blob for token in ("reimburse", "expense reimbursement")):
        return "reimbursement", "Employee reimbursement documentation, not a vendor invoice"
    if "this is not an invoice" in blob and not invoice_like:
        return "not_invoice", "Document explicitly is not an invoice"
    if looks_like_invoice_text(text):
        return "invoice", "Document contains vendor, invoice number, invoice date, and amount due"
    if "invoice" in blob and not looks_like_invoice_text(text):
        return "not_invoice", "Mentions invoice language but is missing required invoice fields"
    return "not_invoice", "No invoice fields found"


def parse_invoice_text(
    text: str,
    *,
    source_type: str,
    source_id: str,
    source_uri: str | None = None,
    vendor_hint: str | None = None,
    document_path: str | None = None,
    extra_context: dict | None = None,
) -> InvoiceCandidate:
    vendor = infer_vendor(text, vendor_hint)
    number_match = INVOICE_NUMBER_LABEL_RE.search(text)
    invoice_number = number_match.group(1).rstrip(".,") if number_match else None
    invoice_date = labeled_date(text, "invoice date", "date")
    # labeled_date falls back to first_date; prefer explicit invoice date
    explicit_date = labeled_text(text, "invoice date")
    if explicit_date:
        invoice_date = normalize_date(explicit_date.split()[0])
    due_raw = labeled_text(text, "due date")
    due_date = normalize_date(due_raw.split()[0]) if due_raw else None
    po_match = PO_RE.search(text)
    vendor_id_match = VENDOR_ID_RE.search(text)
    amount = labeled_money(text, "amount due", "total due", "total", "balance due")
    subtotal = labeled_money(text, "subtotal")
    tax = labeled_money(text, "tax", "sales tax")
    currency_match = re.search(r"currency\s*[:#]?\s*([A-Z]{3})", text, re.I)
    currency = currency_match.group(1).upper() if currency_match else ("USD" if "usd" in text.lower() or "$" in text else None)

    evidence = [
        InvoiceEvidence(field="vendor", source=f"{source_type}.text", text=vendor, value=vendor),
        InvoiceEvidence(
            field="vendor_invoice_number",
            source=f"{source_type}.text",
            text=number_match.group(0) if number_match else None,
            value=invoice_number,
        ),
        InvoiceEvidence(field="invoice_date", source=f"{source_type}.text", text=explicit_date, value=invoice_date),
        InvoiceEvidence(field="amount", source=f"{source_type}.text", value=amount),
    ]
    classification, reason = classify_text(text)
    from invoice_ingestion.traps import analyze_document

    expected_banking = None
    if extra_context:
        expected_banking = extra_context.get("expected_banking")
    analysis = analyze_document(text, expected_banking=expected_banking)
    context = dict(extra_context or {})
    context["document_analysis"] = analysis.as_dict()
    if analysis.supersedes:
        context["supersedes"] = analysis.supersedes
    return InvoiceCandidate(
        source_type=source_type,
        source_id=source_id,
        source_uri=source_uri,
        vendor=vendor,
        vendor_id=vendor_id_match.group(1) if vendor_id_match else None,
        vendor_invoice_number=invoice_number,
        invoice_date=invoice_date,
        due_date=due_date,
        currency=currency,
        subtotal=subtotal,
        tax=tax,
        amount=amount,
        po_id=po_match.group(1).upper().replace("PO", "PO-").replace("PO--", "PO-") if po_match else None,
        document_path=document_path,
        document_hash=hash_text(text) if text.strip() else None,
        page_refs=page_refs_from_text(text) if text.strip() else [],
        extraction_confidence=0.86 if analysis.classification == "invoice" and analysis.payable else 0.4,
        evidence=evidence,
        source_context=context,
        classification=analysis.classification,
        classification_reason=analysis.reason,
    )


def _fix_po(po_id: str | None) -> str | None:
    if not po_id:
        return None
    match = re.search(r"PO-?(\d+)", po_id, re.I)
    if not match:
        return po_id
    return f"PO-{match.group(1)}"


def parse_invoice_text_clean(**kwargs) -> InvoiceCandidate:
    candidate = parse_invoice_text(**kwargs)
    return candidate.model_copy(update={"po_id": _fix_po(candidate.po_id)})


def from_structured_record(
    row: dict,
    *,
    source_type: str,
    source_id: str,
    source_uri: str | None = None,
    classification: str = "invoice",
    reason: str = "Structured source record mapped in Python",
    extra_context: dict | None = None,
) -> InvoiceCandidate:
    vendor = row.get("vendor_name") or row.get("vendor")
    amount = parse_money(row.get("total") if row.get("total") is not None else row.get("amount"))
    lines = []
    for item in row.get("line_items") or []:
        if isinstance(item, dict):
            lines.append(
                InvoiceLineItem(
                    description=str(item.get("description") or ""),
                    quantity=parse_money(item.get("quantity")),
                    unit_price=parse_money(item.get("unit_price")),
                    amount=parse_money(item.get("amount")),
                )
            )
    po_id = _fix_po(row.get("po_number") or row.get("po_id"))
    return InvoiceCandidate(
        source_type=source_type,
        source_id=source_id,
        source_uri=source_uri,
        vendor=vendor,
        vendor_id=row.get("vendor_id"),
        vendor_invoice_number=row.get("invoice_number") or row.get("vendor_invoice_number"),
        invoice_date=normalize_date(row.get("invoice_date")),
        due_date=normalize_date(row.get("due_date")),
        currency=row.get("currency") or "USD",
        subtotal=parse_money(row.get("subtotal")),
        tax=parse_money(row.get("tax")),
        amount=amount,
        po_id=po_id,
        line_items=lines,
        extraction_confidence=0.98,
        evidence=[
            InvoiceEvidence(field="vendor", source=f"{source_type}.record", value=vendor, text=vendor),
            InvoiceEvidence(
                field="vendor_invoice_number",
                source=f"{source_type}.record",
                value=row.get("invoice_number"),
                text=str(row.get("invoice_number") or ""),
            ),
            InvoiceEvidence(field="amount", source=f"{source_type}.record", value=amount),
            InvoiceEvidence(field="po_id", source=f"{source_type}.record", value=po_id, text=po_id),
        ],
        source_context=extra_context or {},
        classification=classification,
        classification_reason=reason,
    )


def interpret_email(email: dict) -> tuple[str, str, list[InvoiceCandidate]]:
    subject = str(email.get("subject") or "")
    body = str(email.get("body") or "")
    attachments = email.get("attachments") or []
    blob = f"{subject}\n{body}"
    candidates: list[InvoiceCandidate] = []
    for attachment in attachments:
        text = attachment_text(attachment)
        classified, reason = classify_text(text, subject=subject, filename=str(attachment.get("filename") or ""))
        parsed = parse_invoice_text_clean(
            text=text,
            source_type="email",
            source_id=str(email.get("message_id")),
            source_uri=email.get("thread_uri"),
            document_path=attachment.get("path") or attachment.get("filename"),
            extra_context={
                "from": email.get("from"),
                "subject": subject,
                "attachment_id": attachment.get("attachment_id"),
                "filename": attachment.get("filename"),
            },
        )
        parsed = parsed.model_copy(
            update={"classification": classified, "classification_reason": reason}
        )
        if classified == "invoice":
            candidates.append(parsed)
    if candidates:
        return "invoice", candidates[0].classification_reason, candidates
    classified, reason = classify_text(blob, subject=subject)
    return classified, reason, []


def interpret_employee(row: dict) -> tuple[str, str, list[InvoiceCandidate]]:
    text = load_record_text(row)
    note = str(row.get("note") or "")
    classified, reason = classify_text(text, subject=note, filename=str(row.get("filename") or ""))
    parsed = parse_invoice_text_clean(
        text=text,
        source_type="employee_submission",
        source_id=str(row.get("submission_id")),
        source_uri=f"employee://{row.get('channel')}/{row.get('submission_id')}",
        document_path=row.get("path") or row.get("filename"),
        extra_context={
            "submitted_by": row.get("submitted_by"),
            "channel": row.get("channel"),
            "note": note,
        },
    )
    parsed = parsed.model_copy(update={"classification": classified, "classification_reason": reason})
    if classified == "invoice":
        return classified, reason, [parsed]
    return classified, reason, []


def interpret_document(row: dict) -> tuple[str, str, list[InvoiceCandidate]]:
    text = load_record_text(row)
    if not text.strip():
        return "unreadable", "Document text could not be extracted", []
    classified, reason = classify_text(text, filename=str(row.get("filename") or ""))
    parsed = parse_invoice_text_clean(
        text=text,
        source_type="document",
        source_id=str(row.get("document_id")),
        source_uri=f"document://{row.get('document_id')}",
        document_path=row.get("path") or row.get("filename"),
        extra_context={"origin": row.get("origin"), "filename": row.get("filename")},
    )
    parsed = parsed.model_copy(update={"classification": classified, "classification_reason": reason})
    if classified == "invoice":
        return classified, reason, [parsed]
    return classified, reason, []


def interpret_portal(row: dict) -> tuple[str, str, list[InvoiceCandidate]]:
    text = load_record_text(row)
    declared = str(row.get("document_type") or "").lower()
    classified, reason = classify_text(text, filename=str(row.get("filename") or ""))
    if declared == "statement" and classified != "invoice":
        classified, reason = "statement", "Portal document is an account statement, not an invoice"
    parsed = parse_invoice_text_clean(
        text=text,
        source_type="vendor_portal",
        source_id=str(row.get("document_id")),
        source_uri=row.get("source_uri"),
        vendor_hint=row.get("vendor"),
        document_path=row.get("path") or row.get("filename"),
        extra_context={"portal": row.get("portal"), "vendor_id": row.get("vendor_id")},
    )
    if parsed.vendor_id is None:
        parsed = parsed.model_copy(update={"vendor_id": row.get("vendor_id")})
    parsed = parsed.model_copy(update={"classification": classified, "classification_reason": reason})
    if classified == "invoice":
        return classified, reason, [parsed]
    return classified, reason, []


def interpret_erp(row: dict) -> tuple[str, str, list[InvoiceCandidate]]:
    candidate = from_structured_record(
        row,
        source_type="erp",
        source_id=str(row.get("record_id")),
        source_uri=f"erp://{row.get('system')}/{row.get('record_id')}",
        reason=f"ERP {row.get('system')} invoice record mapped in Python",
        extra_context={"system": row.get("system"), "description": row.get("description")},
    )
    return "invoice", candidate.classification_reason, [candidate]


def interpret_procurement(row: dict) -> tuple[str, str, list[InvoiceCandidate]]:
    doc_type = str(row.get("document_type") or "").lower()
    if doc_type not in {"invoice", "vendor_invoice", ""}:
        return (
            "purchase_order" if "request" in doc_type or "requisition" in doc_type else "not_invoice",
            f"Procurement document_type={doc_type} is not an invoice",
            [],
        )
    extra = {
        "system": row.get("system"),
        "purchase_request": row.get("purchase_request"),
        "receiving": row.get("receiving") or {},
    }
    candidate = from_structured_record(
        row,
        source_type="procurement",
        source_id=str(row.get("record_id")),
        source_uri=f"procurement://{row.get('system')}/{row.get('record_id')}",
        reason=f"{row.get('system')} invoice mapped in Python; AP matching left to the AP workflow",
        extra_context=extra,
    )
    return "invoice", candidate.classification_reason, [candidate]


def unknown_vendor_warning(vendor: str | None) -> str | None:
    if not vendor:
        return None
    if is_known_vendor(vendor):
        return None
    return f"unknown_vendor:{vendor}"
