"""Judge-facing inbox examples. IDs must exist in data/demo/ingestion/emails.json."""

from __future__ import annotations

INBOX_EXAMPLES: list[dict] = [
    {
        "sample_id": "MSG-E-INV-001",
        "title": "August warehouse supplies invoice",
        "kind": "invoice",
        "looks_like": "Vendor invoice",
        "test": "A real bill from Acme Supplies. Maximor should treat this as money the company owes and send it to accounts payable.",
        "group": "bills_to_process",
    },
    {
        "sample_id": "MSG-E-QUOTE",
        "title": "Quote for office renovation",
        "kind": "quote",
        "looks_like": "Looks like a bill, but is only a quote",
        "test": "Looks similar to a bill, but this is only a price quote. Maximor should recognize that the company does not owe money yet.",
        "group": "do_not_book",
    },
    {
        "sample_id": "MSG-E-RCPT",
        "title": "Receipt for employee software purchase",
        "kind": "receipt",
        "looks_like": "Paid receipt",
        "test": "This is proof of a purchase that was already paid. It should not create a new amount owed.",
        "group": "do_not_book",
    },
    {
        "sample_id": "MSG-E-STMT",
        "title": "Vendor account statement — September",
        "kind": "statement",
        "looks_like": "Account statement",
        "test": "A statement lists earlier invoices. It is a reminder, not a new bill to put on the books.",
        "group": "do_not_book",
    },
    {
        "sample_id": "MSG-E-PO-MONITORS",
        "title": "Purchase order for 40 monitors",
        "kind": "purchase_order",
        "looks_like": "Purchase order",
        "test": "This is Maximor authorizing a purchase. A purchase order is not a vendor invoice, so nothing should be booked as payable yet.",
        "group": "do_not_book",
    },
    {
        "sample_id": "MSG-E-DUP-001",
        "title": "Second copy of ACM-2026-4410",
        "kind": "duplicate",
        "looks_like": "Possible duplicate invoice",
        "test": "This looks like the same Acme Supplies bill sent again. Paying both copies would mean paying twice for one shipment.",
        "group": "needs_investigation",
    },
    {
        "sample_id": "MSG-E-MESSY",
        "title": "Invoice with incomplete or confusing fields",
        "kind": "malformed",
        "looks_like": "Messy scanned invoice",
        "test": "A poorly scanned bill with sloppy fields. Maximor should still try to read it, and only book it if the vendor, amount, and invoice number can be recovered.",
        "group": "needs_investigation",
    },
    {
        "sample_id": "MSG-E-MISSING",
        "title": "Invoice with missing purchase order number",
        "kind": "malformed",
        "looks_like": "Incomplete invoice",
        "test": "The attachment is missing the vendor, amount, and purchase order. Maximor should not invent those fields just to create a bill.",
        "group": "needs_investigation",
    },
]

GROUP_ORDER = [
    ("bills_to_process", "Bills to process"),
    ("do_not_book", "Do not book"),
    ("needs_investigation", "Needs more investigation"),
]

DO_NOT_BOOK = {"quote", "receipt", "statement", "purchase_order", "marketing", "not_invoice", "payment_confirmation"}
NEEDS_REVIEW_IDS = {"MSG-E-DUP-001", "MSG-E-MESSY", "MSG-E-MISSING"}


def example_by_id(sample_id: str) -> dict | None:
    return next((item for item in INBOX_EXAMPLES if item["sample_id"] == sample_id), None)


def curated_ids() -> list[str]:
    return [item["sample_id"] for item in INBOX_EXAMPLES]


def group_for(sample_id: str, classification: str | None) -> str:
    meta = example_by_id(sample_id) or {}
    kind = (classification or meta.get("kind") or "").lower().replace("-", "_")
    if sample_id in NEEDS_REVIEW_IDS or kind in {"duplicate", "malformed"}:
        return "needs_investigation"
    if kind in DO_NOT_BOOK:
        return "do_not_book"
    if kind == "invoice":
        return "bills_to_process"
    return str(meta.get("group") or "needs_investigation")


def group_label(group: str) -> str:
    return next((label for key, label in GROUP_ORDER if key == group), group.replace("_", " ").title())
