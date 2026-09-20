"""Regression suite for planted invoice errors on the current 15-agent kernel path.

Detection and action are scored together: a hold that is still payment-eligible fails.
"""

from __future__ import annotations

import json

import pytest

from evals.invoice_error_detection import run_eval
from invoice_ingestion.interpret import classify_text
from sample_data.paths import data_root
from scheduling.cash import policy_eligible_for_pool
from tools import paid_invoice_ids


DEMO = __import__("pathlib").Path(__file__).resolve().parents[1] / "data" / "demo"


def test_invoice_error_detection_suite():
    payload = run_eval(write=False, tag="pytest")
    failed = [item for item in payload["cases"] if not item.get("correct")]
    assert failed == [], json.dumps(failed, indent=2)


@pytest.mark.parametrize(
    ("text", "subject", "filename", "expected"),
    [
        (
            "PURCHASE ORDER PO-101\nAcme Supplies\nAuthorized 12450.00",
            "PO-101 issued to Acme Supplies",
            "PO-101.pdf",
            "purchase_order",
        ),
        (
            "RECEIPT. Paid. Thank you. Not an invoice.",
            "Uber receipt for campus visit",
            "uber-receipt.pdf",
            "receipt",
        ),
        (
            "Acme Supplies\nTotal 12450.00\nValid through: 2026-10-01\nThis is a quote, not a request for payment.",
            "Pricing",
            "desks.pdf",
            "quote",
        ),
        (
            "INVOICE\nInvoice number: ACM-ADV-1\nInvoice date: 2026-09-08\nVendor: Acme Supplies\nAmount due: 12450.00\nPO: PO-101\n",
            "Invoice ACM-ADV-1",
            "inv.pdf",
            "invoice",
        ),
        (
            "Credit Memo CM-100\nVendor: Acme Supplies\nCredit note for returned goods $200.00\nThis is not an invoice.",
            "Credit memo CM-100",
            "cm.pdf",
            "not_invoice",
        ),
        (
            "RECEIPT\nVendor: Figma\nReceipt number: FIG-SEP-19\nPayment date: 2026-09-12\nAmount paid: 144.00\nPaid in full. Thank you for your payment.\nThis is a receipt, not an invoice.\n\nFigma Organization plan — September",
            "Receipt for employee software purchase",
            "figma-receipt.pdf",
            "receipt",
        ),
        (
            "Please process the attached invoice.\nNo amount, vendor, or invoice number is printed.\nPurchase order number is missing.",
            "Invoice with missing purchase order number",
            "invoice-unknown.pdf",
            "not_invoice",
        ),
    ],
)
def test_classify_text_document_types(text, subject, filename, expected):
    actual, _why = classify_text(text, subject=subject, filename=filename)
    assert actual == expected


def test_already_paid_demo_invoices_are_not_scheduled():
    with data_root(DEMO):
        paid = paid_invoice_ids()
        assert "INV-001" in paid
        assert "INV-014" in paid
        assert policy_eligible_for_pool("INV-001") is False
        assert policy_eligible_for_pool("INV-014") is False
        assert policy_eligible_for_pool("INV-002") is True
