import { EVAL_CASE_COPY } from "../copy";
import { GROUP_LABELS, INBOX_DOCUMENTS, type InboxDocument } from "./inboxDocuments";

function wrap(workflow: string, result: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  return {
    ok: true,
    workflow,
    status: "completed",
    live_llm: false,
    saved_demo: true,
    result,
    ...extra,
  };
}

function moneyFrom(doc: InboxDocument): number | undefined {
  const raw = doc.attachment?.fields.find((row) => /amount/i.test(row[0]))?.[1];
  if (!raw) return undefined;
  const n = Number(String(raw).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

function booksPayable(doc: InboxDocument): boolean {
  return doc.kind === "invoice" || doc.sample_id === "MSG-E-MESSY";
}

function identifySaved(doc: InboxDocument) {
  const booked = booksPayable(doc);
  const amount = moneyFrom(doc);
  const what_changed = booked
    ? "Maximor classified this as a vendor invoice and added it to accounts payable for further matching."
    : doc.kind === "quote"
      ? "This was a quote, not an invoice. Maximor did not create a payable and did not change the ledger."
      : doc.kind === "receipt"
        ? "This was a receipt for a purchase that was already paid. Maximor did not create a payable."
        : doc.kind === "statement"
          ? "This was an account statement listing earlier invoices, not a new bill. Nothing was added to accounts payable."
          : doc.kind === "purchase_order"
            ? "This was a purchase order — Maximor's own authorization to buy — not a vendor bill. Nothing was booked."
            : doc.kind === "duplicate"
              ? "This looks like a second copy of a bill already on file. Maximor held it instead of creating another amount owed."
              : "Maximor could not treat this as a complete vendor invoice, so it did not change the payable ledger.";
  const classification = doc.kind === "duplicate" ? "duplicate" : doc.sample_id === "MSG-E-MESSY" ? "invoice" : doc.kind === "malformed" ? "malformed" : doc.kind;
  const found = booked
    ? "Document Intake identified this as a vendor invoice and extracted the fields needed to book a bill."
    : `Document Intake identified this as ${doc.looks_like.toLowerCase()}, not a vendor bill to pay.`;
  return wrap("ingest", {
    sample_id: doc.sample_id,
    classification,
    classification_reason: doc.test,
    title: doc.title,
    what_changed,
    extracted: {
      vendor: doc.attachment?.fields.find((row) => row[0] === "Vendor")?.[1] || "—",
      invoice_number: doc.attachment?.fields.find((row) => /number/i.test(row[0]))?.[1] || "—",
      amount,
      po_number: doc.attachment?.fields.find((row) => /purchase order/i.test(row[0]))?.[1] || "—",
    },
    record_ids: booked ? ["INV-001"] : [],
    stages: [
      { id: "received", label: "Document Intake read the email and attachment.", status: "completed", bot: "email", detail: doc.title },
      { id: "classified", label: found, status: "completed", bot: "email", detail: doc.test },
      { id: "fields", label: "Accounts Payable checked whether the company actually owes money.", status: "completed", bot: "ap" },
      {
        id: "canonical",
        label: booked ? "A vendor bill was created and handed to Accounts Payable." : "No vendor bill was created.",
        status: booked ? "completed" : "skipped",
        bot: "ctl-pay",
        detail: booked ? "The extracted invoice was registered as money owed." : "Treating this as a bill would invent an amount the company does not owe.",
      },
    ],
    io: {
      outputs: { classification, is_invoice: booked, what_changed },
      explanation: doc.test,
    },
    summary: found,
  });
}

function sortSaved() {
  const groups = (["bills_to_process", "do_not_book", "needs_investigation"] as const).map((id) => ({
    id,
    label: GROUP_LABELS[id],
    items: INBOX_DOCUMENTS.filter((item) => item.group === id).map((item) => ({
      sample_id: item.sample_id,
      title: item.title,
      classification: item.kind,
      group: item.group,
      reason: item.test,
    })),
  }));
  return wrap("inbox", {
    classification: "inbox_sort",
    groups,
    items: groups.flatMap((item) => item.items),
    what_changed: "No ledgers were rewritten. This pass only identified which documents are vendor bills and which are not.",
    stages: [
      { id: "received", label: "Document Intake collected the sample finance inbox.", status: "completed", bot: "email" },
      { id: "classified", label: "Document Intake identified each document as an invoice, quote, receipt, statement, purchase order, or something else.", status: "completed", bot: "email" },
      { id: "dispatch", label: "Accounts Payable kept vendor bills and left quotes, receipts, statements, and purchase orders off the books.", status: "completed", bot: "ap" },
    ],
    summary: "Sorted incoming documents into bills, items not to book, and items that need investigation.",
    io: { outputs: { groups, what_changed: "No ledgers were rewritten." } },
  });
}

const INVOICES = [
  { invoice_id: "INV-003", vendor: "Datadog", amount: 15000, match_status: "matched", duplicate_status: "unique", payment_state: "open", po_id: "PO-103", description: "Pro monitoring for 50 hosts" },
  { invoice_id: "INV-001", vendor: "Acme Supplies", amount: 12450, match_status: "matched", duplicate_status: "unique", payment_state: "approved_pool", po_id: "PO-101", description: "August warehouse restock" },
  { invoice_id: "INV-002", vendor: "Amazon Web Services", amount: 8320, match_status: "matched", duplicate_status: "unique", payment_state: "open", po_id: "PO-102", description: "September cloud hosting" },
  { invoice_id: "INV-006", vendor: "Shadow Vendor LLC", amount: 8750, match_status: "exception", duplicate_status: "duplicate", payment_state: "open", po_id: "PO-118", description: "Possible second copy of a consulting bill" },
  { invoice_id: "INV-004", vendor: "Slack Technologies", amount: 5000, match_status: "exception", duplicate_status: "unique", payment_state: "open", po_id: "PO-105", description: "Business+ billed above the purchase order" },
];

export const SAVED = {
  "/api/health": { ok: false, saved_demo: true },
  "/api/demo/status": {
    company: "Maximor Demo Corp",
    company_id: "CO-MAXIMOR",
    period: "2026-09",
    system_status: "operational",
    autonomy: { execution: "kernel-deterministic", live_llm: false, human_in_completion_path: false },
    stripe: { mode: "simulated" },
  },
  "/api/demo/overview": {
    header: "Autonomous Office of the CFO",
    metrics: {
      cash: 510000,
      ap_outstanding: 931745,
      ar_outstanding: 1232900,
      projected_13w_ending_cash: 297890,
      unreconciled_items: 12.4,
      close_status: "BLOCKED",
      open_audit_findings: "Not run yet",
    },
    briefing: [
      { title: "Northstar bank deposit is $12.40 above the invoice", detail: "Cash reconciliation — and September close — stay open until that difference is explained.", href: "/cash", record_ids: ["TXN-2026-09-015"] },
      { title: "Lumen Labs sent $5,000 with no invoice number", detail: "The payment message only says “September billing.”", href: "/ar", record_ids: ["PAY-004"] },
      { title: "Harbor Electric's September bill has not arrived", detail: "Electricity was used in September, so the month still needs an estimate.", href: "/close", record_ids: ["ACC-HE-2026-09"] },
    ],
    operations: [
      { id: "inbox", label: "Inbox", href: "/inbox", status: "READY" },
      { id: "ap", label: "Payables", href: "/ap", status: "IN_PROGRESS" },
      { id: "ar", label: "Receivables", href: "/ar", status: "IN_PROGRESS" },
      { id: "cash", label: "Cash", href: "/cash", status: "BLOCKED" },
      { id: "close", label: "Close", href: "/close", status: "BLOCKED" },
    ],
  },
  "/api/demo/company-state": {
    period: "2026-09",
    cash: 510000,
    ap_outstanding: 931745,
    ar_outstanding: 1232900,
    unreconciled_item: "TXN-2026-09-015",
    close_status: "BLOCKED",
    exception_count: 3,
    projected_ending_cash: 297890,
    journal_count: 24,
    decision_memory_count: 4,
  },
  "/api/inbox": {
    samples: INBOX_DOCUMENTS.map((item) => ({
      sample_id: item.sample_id,
      subject: item.title,
      kind: item.kind,
      looks_like: item.looks_like,
      test: item.test,
      from: item.from,
      featured: true,
    })),
    emails: INBOX_DOCUMENTS.map((item) => ({
      message_id: item.sample_id,
      from: item.from,
      to: item.to,
      subject: item.title,
      sent_at: item.sent_at,
      body: item.body,
    })),
    sample_artifacts: {},
    default_sample_id: "MSG-E-INV-001",
  },
  "/api/invoices": { invoices: INVOICES },
  "/api/ar": {
    outstanding: 92000,
    buckets: { CURRENT: 22400, "1-30": 0, "31-60": 0, "61-90": 0, "90+": 45000 },
    invoices: [
      { invoice_id: "INV-AR-010", customer_name: "Lumen Labs", description: "Seat block A", outstanding_amount: 5000, due_date: "2026-10-01" },
      { invoice_id: "INV-AR-011", customer_name: "Lumen Labs", description: "Seat block B", outstanding_amount: 5000, due_date: "2026-10-03" },
      { invoice_id: "INV-AR-013", customer_name: "Northstar LLC", description: "Northstar platform", outstanding_amount: 12400, due_date: "2026-09-30" },
      { invoice_id: "INV-AR-005", customer_name: "Quiet Harbor", description: "Platform arrears — more than 90 days overdue", outstanding_amount: 45000, due_date: "2026-05-01" },
    ],
    payments: [
      { payment_id: "PAY-004", payer_name: "Lumen Labs", amount: 5000, remittance_text: "September billing", application_status: "UNMATCHED", payment_date: "2026-09-26", bank_reference: "ACH-LUMEN-5K" },
      { payment_id: "PAY-001", payer_name: "Northwind Labs", amount: 12000, remittance_text: "Payment for INV-AR-007 September platform", application_status: "UNMATCHED" },
    ],
    featured_payment: {
      payment: { kind: "remittance", title: "Lumen Labs payment", record: { payment_id: "PAY-004", payer_name: "Lumen Labs", amount: 5000, payment_date: "2026-09-26", bank_reference: "ACH-LUMEN-5K", remittance_text: "September billing" } },
    },
  },
  "/api/cash": {
    featured_cases: {
      unexplained: {
        bank: { kind: "bank_transaction", artifact_id: "TXN-2026-09-015", title: "Northstar bank deposit", record: { transaction_id: "TXN-2026-09-015", date: "2026-09-15", amount: 12412.4, description: "CUSTOMER PAYMENT NORTHSTAR LLC", counterparty: "NORTHSTAR LLC" } },
        ledger: [{ kind: "ledger_entry", title: "Northstar ledger cash", record: { entry_id: "GL-AR-013", date: "2026-09-15", amount: 12400, description: "Northstar platform payment", counterparty: "Northstar LLC" } }],
        fees: [],
      },
      fee_netted: {
        bank: { kind: "bank_transaction", artifact_id: "TXN-2026-09-011", title: "Helios wire, net of bank fee", record: { transaction_id: "TXN-2026-09-011", date: "2026-09-11", amount: -10025, description: "WIRE TRANSFER INTL REF 729103", counterparty: "HELIOS HARDWARE" } },
        ledger: [{ kind: "ledger_entry", title: "Helios vendor payment", record: { amount: -10000, description: "Helios Hardware payment", counterparty: "Helios Hardware" } }],
        fees: [{ kind: "ledger_entry", title: "Bank wire fee", record: { amount: -25, description: "International wire fee" } }],
      },
      grouped: {
        bank: { kind: "bank_transaction", artifact_id: "TXN-2026-09-008", title: "One Northline payment covering several bills", record: { transaction_id: "TXN-2026-09-008", date: "2026-09-08", amount: -18500, description: "ACH OUT NORTHLINE FAB", counterparty: "NORTHLINE FAB" } },
        ledger: [
          { kind: "ledger_entry", title: "Northline bill 1", record: { amount: -6200, description: "Northline invoice INV-014" } },
          { kind: "ledger_entry", title: "Northline bill 2", record: { amount: -6100, description: "Northline invoice INV-015" } },
          { kind: "ledger_entry", title: "Northline bill 3", record: { amount: -6200, description: "Northline invoice INV-016" } },
        ],
        fees: [],
      },
    },
    report: {
      period_status: "FAILED_TIE",
      matches: [
        { match_key: "northstar", match_type: "UNEXPLAINED_DIFFERENCE", status: "UNEXPLAINED_DIFFERENCE", bank_amount: 12412.4, ledger_amount: 12400, bank_transaction_ids: ["TXN-2026-09-015"], ledger_entry_ids: ["GL-AR-013"] },
        { match_key: "helios", match_type: "FEE_NETTED", status: "MATCHED", bank_amount: -10025, ledger_amount: -10000, bank_transaction_ids: ["TXN-2026-09-011"], ledger_entry_ids: ["GL-AP-017"] },
        { match_key: "northline", match_type: "GROUPED_MATCH", status: "MATCHED", bank_amount: -18500, ledger_amount: -18500, bank_transaction_ids: ["TXN-2026-09-008"], ledger_entry_ids: ["GL-AP-014", "GL-AP-015", "GL-AP-016"] },
      ],
    },
  },
  "/api/stripe": {
    mode: { mode: "simulated" },
    payouts: [
      {
        tied: true,
        payout: { payout_id: "po_1MaximorFees", bank_deposit_id: "TXN-STRIPE-FEES", bank_deposit_amount: 12610 },
        breakdown: { gross_payments: 13000, refunds: 0, chargebacks: 0, fees: 390, expected_payout: 12610, net: 12610, exceptions: [] },
      },
    ],
    bundles: {
      po_1MaximorFees: {
        payout: { kind: "stripe_payout", title: "Stripe payout to the bank", record: { payout_id: "po_1MaximorFees", type: "payout", amount: 1261000, bank_deposit_amount: 12610 } },
        bank_deposit: { kind: "bank_transaction", title: "Matching bank deposit", record: { transaction_id: "TXN-STRIPE-FEES", date: "2026-09-19", amount: 12610, description: "STRIPE PAYOUT", counterparty: "STRIPE" } },
        balance_transactions: [
          { kind: "stripe_balance_txn", title: "Customer charge ORD-2101", record: { id: "ORD-2101", type: "charge", amount: 800000 } },
          { kind: "stripe_balance_txn", title: "Customer charge ORD-2102", record: { id: "ORD-2102", type: "charge", amount: 500000 } },
          { kind: "stripe_balance_txn", title: "Stripe processing fees", record: { id: "fee_bundle", type: "fee", amount: -39000 } },
        ],
      },
    },
  },
  "/api/close": {
    status: "BLOCKED",
    tasks: [
      { task_id: "TASK-AP", status: "COMPLETE" },
      { task_id: "TASK-AR", status: "COMPLETE" },
      { task_id: "TASK-CASH", status: "BLOCKED" },
      { task_id: "TASK-ACCRUAL", status: "COMPLETE" },
      { task_id: "TASK-PREPAID", status: "COMPLETE" },
      { task_id: "TASK-FA", status: "COMPLETE" },
      { task_id: "TASK-BS", status: "NEEDS_REVIEW" },
      { task_id: "TASK-FINAL", status: "BLOCKED" },
    ],
    journals: [
      { entry_id: "JE-ACC-HE-202609", memo: "Harbor Electric September accrual", vendor: "Harbor Electric", debit_account: "6100-Utilities", credit_account: "2100-Accrued expenses", amount_minor: 465000 },
      { entry_id: "JE-AP-INV-001", memo: "Acme supplies invoice", vendor: "Acme Supplies", debit_account: "6000-Operating", credit_account: "2000-AP", amount_minor: 1245000 },
    ],
    harbor: {
      accrual_id: "ACC-HE-2026-09",
      journal_id: "JE-ACC-HE-202609",
      input: {
        invoice_exists_for_september: false,
        history_table: {
          kind: "table",
          title: "Recent Harbor Electric bills",
          columns: ["period", "expense"],
          rows: [
            { period: "2026-06", expense: 4750 },
            { period: "2026-07", expense: 4760 },
            { period: "2026-08", expense: 4780 },
          ],
        },
        contract: { kind: "document", title: "Harbor Electric utility contract", filename: "CTR-HE-001.pdf", text: "Harbor Electric supplies electricity to Maximor Demo Corp on a monthly billed basis." },
        prior_memory: [{ kind: "decision_memory", title: "August Harbor Electric estimate", record: { decision: "SEASONAL_PRIOR_YEAR", period: "2026-08", amount: 7800, rationale: "August used last year's seasonal electricity pattern because the current bill had not arrived." } }],
        seeded_journal: { kind: "journal_entry", title: "Harbor Electric September accrual", record: { entry_id: "JE-ACC-HE-202609", debit_account: "6100-Utilities", credit_account: "2100-Accrued expenses", amount_minor: 465000, memo: "Harbor Electric September accrual" } },
      },
    },
  },
  "/api/forecast": {
    weeks: [
      { week_start: "2026-09-14", week_end: "2026-09-20", beginning_cash: 510000, ar_collections: 0, ap_payments: 372000, ending_cash: 151110 },
      { week_start: "2026-09-21", week_end: "2026-09-27", beginning_cash: 151110, ar_collections: 0, ap_payments: 20770, ending_cash: 69790 },
      { week_start: "2026-09-28", week_end: "2026-10-04", beginning_cash: 69790, ar_collections: 69400, ap_payments: 0, ending_cash: 54190 },
      { week_start: "2026-10-05", week_end: "2026-10-11", beginning_cash: 54190, ar_collections: 42000, ap_payments: 18000, ending_cash: 78190 },
      { week_start: "2026-12-07", week_end: "2026-12-13", beginning_cash: 367890, ar_collections: 0, ap_payments: 0, payroll: 70000, ending_cash: 297890 },
    ],
    opening_cash: 510000,
    projected_ending_cash: 297890,
    inputs: {
      gross_margin: { august: 0.64, september: 0.61, drivers: [] },
      new_events: [{ kind: "document", title: "Late Quiet Harbor collection", text: "INV-AR-014 may collect later than originally forecast." }],
      original_forecast: { kind: "table", title: "Original 13-week cash forecast", columns: ["week_end", "ending_cash"], rows: [{ week_end: "2026-09-20", ending_cash: 151110 }, { week_end: "2026-12-13", ending_cash: 297890 }] },
    },
  },
  "/api/audit": {
    note: "After you run independent audit, this column lists each control issue with the evidence behind it.",
    inputs: {
      featured: {
        self_approval: { kind: "document", title: "Invoice requested and approved by the same person", record: { requester_id: "USR-SELF", approver_id: "USR-SELF" } },
        duplicate_invoice_a: { kind: "invoice", title: "First copy of the vendor bill", record: { invoice_id: "INV-006", vendor: "Shadow Vendor LLC", amount: 8750 } },
        duplicate_invoice_b: { kind: "invoice", title: "Second copy of the same bill", record: { invoice_id: "INV-007", vendor: "Shadow Vendor LLC", amount: 8750 } },
        duplicate_vendor_a: { kind: "document", title: "Vendor record A", text: "Acme Supplies" },
        duplicate_vendor_b: { kind: "document", title: "Vendor record B", text: "Acme Supply Co." },
        post_close_journal: { kind: "journal_entry", title: "Journal posted after close", record: { entry_id: "JE-POST-CLOSE", memo: "Posted after the month was treated as locked", amount_minor: 250000 } },
        round_payment: { kind: "document", title: "Round-number payment", text: "A $10,000 payment with thin supporting records." },
      },
      self_approval_ids: { requester_id: "USR-SELF", approver_id: "USR-SELF" },
    },
  },
  "/api/memory": {
    harbor: {
      prior_memory: [{ kind: "decision_memory", title: "August Harbor Electric estimate", record: { decision: "SEASONAL_PRIOR_YEAR", period: "2026-08", amount: 7800, rationale: "August used last year's seasonal electricity pattern because the current bill had not arrived." } }],
      history_table: { kind: "table", title: "Recent Harbor Electric bills", columns: ["period", "expense"], rows: [{ period: "2026-08", expense: 4780 }] },
    },
    decisions: [{ decision_id: "MEM-HE-2026-08", decision: "SEASONAL_PRIOR_YEAR", period: "2026-08", situation_summary: "August Harbor Electric bill had not arrived. Maximor estimated $7,800 using last year's seasonal pattern.", rationale: "August used last year's seasonal electricity pattern because the current bill had not arrived." }],
    events: [
      { event_id: "EVT-HE-AUG", title: "August Harbor Electric estimate saved", period: "2026-08", kind: "accrual", agent: "close", record_ids: ["MEM-HE-2026-08"] },
      { event_id: "EVT-STRIPE", title: "Stripe payout explanation saved", period: "2026-09", kind: "reconciliation", agent: "cash", record_ids: ["po_1MaximorFees"] },
    ],
  },
  "/api/agents": {
    bots: [],
    activity: [
      { workflow: "invoice-ingestion", status: "completed", bots: ["email", "ap"], summary: "Document Intake identified the Acme warehouse invoice and handed a vendor bill to Accounts Payable." },
      { workflow: "ar-cash-apply", status: "completed", bots: ["apply", "ctl-cash"], summary: "Cash Application left the $5,000 Lumen Labs payment unmatched because the message did not name an invoice." },
      { workflow: "bank-reconciliation", status: "completed", bots: ["cash", "ctl-cash"], summary: "Cash Reconciliation left the extra $12.40 Northstar difference unexplained rather than inventing a fee." },
    ],
  },
  "/api/evaluations": {
    scored: false,
    catalog: Object.entries(EVAL_CASE_COPY).map(([case_id, copy]) => ({ case_id, title: copy.title, prompt: copy.test, family: case_id.includes("EMAIL") || case_id.includes("AP") ? "documents" : case_id.includes("CASH") ? "cash" : "questions" })),
    summary: {},
  },
  "/api/gauntlet": {
    scored: false,
    note: "Run the Finance Gauntlet to score Maximor against hidden expected outcomes. Until then, the scenarios below are what the agents are tested on.",
    cases: Object.entries(EVAL_CASE_COPY).slice(0, 12).map(([case_id, copy]) => ({ case_id, title: copy.title, prompt: copy.test, family: "documents" })),
    families: {
      documents: { plain: "Messy invoices, quotes, and look-alike documents" },
      cash: { plain: "Bank activity matched to the books with real evidence" },
    },
  },
  "/api/scenarios": { scenarios: [] },
  "/api/architecture": { grain: 15, bots: [], routines: [] },
};

export const SAVED_WORKFLOWS: Record<string, (body?: any) => any> = {
  "/api/workflows/invoice-ingestion": (body) => {
    const doc = INBOX_DOCUMENTS.find((item) => item.sample_id === body?.sample_id) || INBOX_DOCUMENTS[0];
    return identifySaved(doc);
  },
  "/api/workflows/inbox": () => sortSaved(),
  "/api/workflows/ap": () =>
    wrap("ap", {
      decision: { decision: "HOLD" },
      evidence: { exception_types: ["quantity_mismatch"] },
      summary: "The bill does not match the quantity received, so payment is held.",
      stages: [
        { id: "match", label: "Accounts Payable compared the bill with the purchase order and delivery record.", status: "completed", bot: "ap" },
        { id: "concur", label: "Payables Control rechecked the hold.", status: "completed", bot: "ctl-pay" },
      ],
      explanation: { narrative: "Forty monitors were billed; fifty were ordered and forty arrived. Payment is paused." },
      io: { outputs: {}, before: {}, after: {} },
    }),
  "/api/workflows/schedule": () => wrap("schedule", { summary: "A draft payment run was built from bills that already passed payable checks.", stages: [{ id: "pool", label: "Payments collected approved bills.", status: "completed", bot: "pay" }] }),
  "/api/workflows/ar-aging": () => wrap("ar-aging", { summary: "Unpaid customer invoices were grouped by how late they are.", stages: [{ id: "ar", label: "Collections aged unpaid customer invoices.", status: "completed", bot: "collect" }] }),
  "/api/workflows/ar-collections": () => wrap("ar-collections", { summary: "Overdue customers were queued for follow-up.", stages: [{ id: "ar", label: "Collections decided who needs follow-up.", status: "completed", bot: "collect" }] }),
  "/api/workflows/ar-cash-apply": () =>
    wrap("ar-apply", {
      summary: "The $5,000 Lumen Labs payment could not be applied automatically.",
      io: { outputs: { decision: "NEEDS_MORE_EVIDENCE", invoice_ids: [] }, inputs: { payment: { amount: 5000, remittance_text: "September billing" } } },
      stages: [{ id: "apply", label: "Cash Application tried to match the payment to open invoices.", status: "completed", bot: "apply" }],
    }),
  "/api/workflows/bank-reconciliation": () =>
    wrap("cash", {
      summary: "Bank activity was compared with the ledger. A $12.40 Northstar difference remains unexplained.",
      report: {
        period_status: "BLOCKED",
        matches: [
          {
            match_type: "UNEXPLAINED_DIFFERENCE",
            status: "HUMAN_REVIEW",
            bank_amount: 12412.4,
            ledger_amount: 12400,
            bank_transaction_ids: ["TXN-2026-09-015"],
            ledger_entry_ids: ["LE-NORTHSTAR"],
          },
        ],
      },
      stages: [{ id: "cash", label: "Cash Reconciliation compared the bank to the ledger.", status: "completed", bot: "cash" }],
    }),
  "/api/workflows/stripe-reconciliation": () => wrap("stripe", { summary: "The Stripe payout was unpacked into charges, fees, and the bank deposit.", payouts: SAVED["/api/stripe"].payouts, stages: [{ id: "unpack", label: "Stripe Agent unpacked the payout.", status: "completed", bot: "stripe" }] }),
  "/api/workflows/close": () => wrap("close", { summary: "Month-end close ran. Cash reconciliation still blocks locking September.", io: { after: { status: "BLOCKED" } }, stages: [{ id: "close", label: "Close ran the month-end checklist.", status: "completed", bot: "close" }] }),
  "/api/workflows/accrual": () =>
    wrap("accrual", {
      summary: "September Harbor Electric expense was estimated at $4,650.",
      io: { outputs: { amount: 4650, selected_method: "seasonal_prior_year", journal_entry: { entry_id: "JE-HE-SEP", debit_account: "Utilities expense", credit_account: "Accrued liabilities", amount_minor: 465000, memo: "Harbor Electric September estimate" } } },
      stages: [{ id: "accrual", label: "Close estimated the missing Harbor Electric bill.", status: "completed", bot: "close" }],
    }),
  "/api/workflows/forecast": () => wrap("forecast", { summary: "The 13-week cash forecast was refreshed from collections, vendor payments, and payroll.", snapshot: { weeks: SAVED["/api/forecast"].weeks }, stages: [{ id: "reporting", label: "Forecast refreshed weekly cash.", status: "completed", bot: "story" }] }),
  "/api/workflows/audit": () =>
    wrap("audit", {
      summary: "Independent control tests found self-approval and duplicate-bill issues.",
      io: {
        outputs: {
          findings: [
            { title: "Same person approved their own invoice", severity: "high", summary: "This invoice was requested, prepared, reviewed, and approved by the same user." },
            { title: "Duplicate vendor bill", severity: "high", summary: "These two invoices appear to request payment for the same vendor bill." },
          ],
        },
      },
      stages: [{ id: "audit", label: "Audit sampled invoices, payments, and approvals.", status: "completed", bot: "audit" }],
    }),
  "/api/workflows/memory": () =>
    wrap("memory", {
      summary: "September retrieved the August Harbor Electric decision and re-checked current evidence.",
      io: { outputs: { final_method: "seasonal_prior_year", final_amount: 4650 } },
      payload: { memory_enabled: true, retrieved: ["MEM-HE-AUG"] },
      stages: [{ id: "memory", label: "Close retrieved the August Harbor Electric decision.", status: "completed", bot: "close" }],
    }),
  "/api/workflows/memory-eval": () => wrap("memory-eval", { payload: { with_memory: { amount: 4650 }, without_memory: { amount: 4650 } }, stages: [{ id: "memory", label: "Memory on versus off was compared.", status: "completed", bot: "close" }] }),
  "/api/workflows/cfo-cycle": () => wrap("cfo-cycle", { summary: "The connected finance cycle ran across payables, cash, close, forecast, and audit.", stages: [{ id: "ap", label: "The office ran the connected cycle.", status: "completed", bot: "ap" }], io: { before: SAVED["/api/demo/company-state"], after: SAVED["/api/demo/company-state"] } }),
  "/api/workflows/evaluate": () => wrap("evaluate", { summary: "Evaluation cases were scored against the live office.", stages: [{ id: "audit", label: "Evaluation cases were scored.", status: "completed", bot: "audit" }] }),
  "/api/workflows/gauntlet": () => wrap("gauntlet", { payload: { scorecard: { total_scenarios: 20, passed: 18 } }, stages: [{ id: "audit", label: "The Finance Gauntlet was scored.", status: "completed", bot: "audit" }] }),
};

export function savedGet(path: string): any | undefined {
  if (SAVED[path as keyof typeof SAVED]) return SAVED[path as keyof typeof SAVED];
  if (path.startsWith("/api/invoices/")) {
    const id = path.split("/").pop();
    const row = INVOICES.find((item) => item.invoice_id === id) || INVOICES[1];
    return {
      ...row,
      invoice: row,
      three_way: {
        artifacts: {
          invoice: { kind: "invoice", title: `${row.vendor} invoice`, record: row },
          purchase_order: {
            kind: "purchase_order",
            title: `Purchase order ${row.po_id}`,
            record: { po_id: row.po_id, vendor: row.vendor, authorized_amount: row.amount, status: "approved", approver: "Maya Chen", description: row.description },
          },
          goods_receipt: {
            kind: "goods_receipt",
            title: "Delivery record",
            record: {
              receipt_id: row.invoice_id === "INV-003" ? "GR-103" : `GR-${row.po_id}`,
              po_id: row.po_id,
              received: true,
              quantity_ordered: 50,
              quantity_received: row.invoice_id === "INV-003" ? 40 : 50,
              amount_received: row.amount,
            },
          },
        },
      },
      source_document: { kind: "invoice", title: `${row.vendor} invoice`, record: row },
      source_emails: [],
      exceptions: row.match_status === "exception" ? ["quantity_mismatch"] : [],
    };
  }
  if (path.startsWith("/api/inbox/")) {
    const id = path.split("/").pop() || "";
    const doc = INBOX_DOCUMENTS.find((item) => item.sample_id === id);
    return doc ? { sample_id: id, artifact: { kind: "email", title: doc.title, email: doc } } : undefined;
  }
  if (path.startsWith("/api/stories/") || path.startsWith("/api/lineage/") || path.startsWith("/api/consistency/")) {
    return { title: "Saved demonstration", steps: [], received: true };
  }
  return undefined;
}

export function savedPost(path: string, body?: unknown): any | undefined {
  const exact = SAVED_WORKFLOWS[path];
  if (exact) return exact(body);
  const ap = path.match(/^\/api\/workflows\/ap\/(.+)$/);
  if (ap) return SAVED_WORKFLOWS["/api/workflows/ap"]({ invoice_id: ap[1] });
  const scenario = path.match(/^\/api\/workflows\/scenario\/(.+)$/);
  if (scenario) return wrap("scenario", { summary: "Saved demonstration of this finance scenario.", stages: [{ id: "ap", label: "The office ran the scenario.", status: "completed", bot: "ap" }] });
  if (path === "/api/demo/reset") return { ok: true, canonical_preserved: true, saved_demo: true };
  return undefined;
}
