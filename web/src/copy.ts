import { usd } from "./api";
import { AGENT_COPY, GRAIN_SLUGS } from "./data/agents";

export { AGENT_COPY, GRAIN_SLUGS };

/** Title-case leftover snake/kebab/enum tokens without pretending they are known. */
export function humanizeToken(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const spaced = raw.replace(/[._-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2");
  return spaced
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function lookup(table: Record<string, string>, value: unknown, fallback?: string): string {
  if (value === null || value === undefined || value === "") return fallback || "";
  const key = String(value).trim();
  if (table[key]) return table[key];
  const upper = key.toUpperCase();
  if (table[upper]) return table[upper];
  const lower = key.toLowerCase();
  if (table[lower]) return table[lower];
  return fallback || humanizeToken(key);
}

export const STATUS_COPY: Record<string, string> = {
  HUMAN_REVIEW: "Unresolved — more evidence required",
  NEEDS_REVIEW: "Maximor still needs more evidence before completing this task",
  BLOCKED: "Cannot finish yet",
  OPEN: "Still open",
  CLOSED: "Closed",
  COMPLETE: "Finished",
  COMPLETED: "Finished",
  IN_PROGRESS: "In progress",
  READY: "Ready to run",
  NOT_STARTED: "Not started yet",
  MATCHED: "Matched",
  UNMATCHED: "Not matched yet",
  APPLIED: "Applied to invoices",
  UNAPPLIED: "Not yet matched to an invoice",
  PARTIAL: "Partially applied",
  APPROVE: "Approved",
  APPROVED: "Approved",
  HOLD: "Held for more evidence",
  REJECT: "Rejected",
  REJECTED: "Rejected",
  PASS: "Passed",
  FAIL: "Failed",
  FAILED: "Failed",
  TIED: "Tied out",
  EXCEPTION: "Needs investigation",
  exceptions: "Needs attention",
  EXPLAINED_EXCEPTION: "Difference found and explained",
  OUTSTANDING_TIMING_ITEM: "Timing difference — expected to clear later",
  RECONCILED: "Bank and ledger agree",
  FAILED_TIE: "Bank and ledger still disagree",
  CONFIRMED: "Confirmed from available records",
  CURRENT: "Not overdue yet",
  PAST_DUE: "Overdue",
  PAID: "Paid",
  AUTO_APPLY: "Matched automatically",
  NEEDS_MORE_EVIDENCE: "More evidence required",
  RESOLVED: "Resolved",
  IN_REVIEW: "Still being evaluated",
  PENDING: "Pending",
  pending_review: "Waiting for more evidence before a decision",
  SKIPPED: "Skipped",
  RUNNING: "Running",
  queued: "Queued",
  clear: "Clear",
  live: "Live",
  simulated: "Simulated",
  operational: "Running",
  "not run": "Not run yet",
  not_run: "Not run yet",
  independent: "Independent sampling",
  true: "Yes",
  false: "No",
  invoice: "Invoice",
  quote: "Quote — not a bill",
  statement: "Account statement — not a bill",
  receipt: "Receipt — not a vendor bill",
  purchase_order: "Purchase order — not a bill",
  payment_confirmation: "Payment confirmation — not a bill",
  not_invoice: "Not an invoice",
  inbox_sort: "Inbox sorted",
  reimbursement: "Employee reimbursement",
  other: "Not treated as a vendor invoice",
  not_an_invoice: "Not an invoice",
  duplicate: "Looks like a duplicate bill",
  approved_pool: "Ready for this week's payments",
  malformed: "Missing required fields",
  three_way_match_failed: "The invoice, purchase order, and delivery record do not all agree",
  exception_duplicate_candidate: "This invoice may be a duplicate of another bill already in the system",
  HIGH: "High severity",
  MEDIUM: "Medium severity",
  LOW: "Low severity",
  CRITICAL: "Critical",
  INFO: "Informational",
  CONFIRMED_CONTROL_FAILURE: "Confirmed control failure",
  RISK_INDICATOR: "Risk indicator — extra testing needed",
  AGREE: "Records agree",
  DISAGREE: "Records disagree",
  "kernel-deterministic": "Using the company's recorded rules",
  "live-llm": "Using a live language model",
  "office-completes-work": "The office finishes the work itself",
  qty_mismatch: "The billed quantity does not match what was received",
  qty_variance: "The billed quantity does not match what was received",
  quantity_mismatch: "The billed quantity does not match what was received",
  goods_received: "Goods or services were received",
  needs_human_review: "Needs a person to review",
  pending_approval: "Waiting for approval",
  hold_for_review: "Held for review",
  stripe_fee: "Stripe processing fee",
  txn_fee: "Transaction fee",
};

export const DECISION_COPY: Record<string, string> = {
  AUTO_APPLY: "Maximor matched this payment to customer invoices automatically.",
  HUMAN_REVIEW: "Maximor could not identify a matching invoice with enough evidence.",
  UNAPPLIED: "This customer payment is still unmatched.",
  APPROVE: "Approved — the supporting records agree.",
  HOLD: "Held — Maximor found a problem that must be resolved first.",
  REJECT: "Rejected.",
  APPROVE_CLOSE: "Month-end close can finish.",
  REJECT_CLOSE: "Month-end close cannot finish yet.",
  REQUEST_REVIEW: "Close still needs more evidence.",
  MATCHED: "Bank activity was matched to the ledger.",
  EXPLAINED_EXCEPTION: "A difference was found and Maximor explained it.",
};

export const MATCH_TYPE_COPY: Record<string, string> = {
  EXACT_MATCH: "Exact bank-to-ledger match",
  GROUPED_MATCH: "One payment matched to multiple records",
  FEE_NETTED: "Transfer matched after accounting for the bank fee",
  PROVIDER_PAYOUT: "Stripe payout matched to bank deposit",
  TIMING_DIFFERENCE: "Timing difference between the bank and the ledger",
  POSSIBLE_DUPLICATE_BANK_TXN: "Possible duplicate bank transaction",
  POSSIBLE_DUPLICATE_REFUND: "Possible duplicate refund",
  POSSIBLE_DUPLICATE_LEDGER_ENTRY: "Possible duplicate ledger entry",
  UNEXPLAINED_DIFFERENCE: "Unresolved difference — no supporting evidence found",
  UNMATCHED_BANK: "Bank transaction with no matching ledger entry",
  UNMATCHED_LEDGER: "Ledger entry with no matching bank transaction",
};

export const MATCH_TYPE_SENTENCE: Record<string, string> = {
  EXACT_MATCH: "One bank transaction matches one ledger entry for the same amount.",
  GROUPED_MATCH: "One bank transaction matched to several ledger entries.",
  FEE_NETTED: "Bank transfer matched after accounting for the bank fee.",
  PROVIDER_PAYOUT: "Stripe payout matched to the corresponding bank deposit.",
  TIMING_DIFFERENCE: "The bank and ledger record the same event on different dates.",
  UNEXPLAINED_DIFFERENCE: "The bank and ledger disagree, and Maximor could not find supporting evidence for the difference.",
  UNMATCHED_BANK: "This bank movement has no matching explanation in the accounting records yet.",
  UNMATCHED_LEDGER: "This ledger cash entry has no matching bank movement yet.",
};

export const METHOD_COPY: Record<string, string> = {
  seasonal_prior_year: "Use the comparable season from last year",
  SEASONAL_PRIOR_YEAR: "Use the comparable season from last year",
  last_invoice: "Reuse the most recent bill amount",
  LAST_INVOICE: "Reuse the most recent bill amount",
  simple_average: "Average of historical bills",
  SIMPLE_AVERAGE: "Average of historical bills",
  recent_average: "Average of the most recent bills",
  RECENT_AVERAGE: "Average of the most recent bills",
  weighted_recent_average: "Weighted average of recent bills, with later months counting more",
  WEIGHTED_RECENT_AVERAGE: "Weighted average of recent bills, with later months counting more",
  linear_trend: "Project the recent trend forward",
  LINEAR_TREND: "Project the recent trend forward",
  contract_commitment: "Use the contracted monthly amount",
  CONTRACT_COMMITMENT: "Use the contracted monthly amount",
  usage_run_rate: "Estimate from usage multiplied by the contract rate",
  USAGE_RUN_RATE: "Estimate from usage multiplied by the contract rate",
  goods_receipt: "Use proof that goods or services were received",
  purchase_order: "Use the authorized purchase-order amount",
  conservative_minimum: "Use the most conservative available estimate",
  CONSERVATIVE_MINIMUM: "Use the most conservative available estimate",
  AMORTIZE: "Spread the prepaid cost across the months it covers",
  DEPRECIATE: "Spread the asset cost across its useful life",
  EXPENSE: "Record the full amount as an expense now",
  straight_line_monthly: "Spread evenly across each month of coverage",
  STRAIGHT_LINE_MONTHLY: "Spread evenly across each month of coverage",
};

export const METHOD_SENTENCE: Record<string, string> = {
  seasonal_prior_year:
    "The system estimated this bill using the same seasonal pattern from last year, since a current invoice has not arrived yet.",
  SEASONAL_PRIOR_YEAR:
    "The system estimated this bill using the same seasonal pattern from last year, since a current invoice has not arrived yet.",
  last_invoice: "The system reused the most recent bill amount because a current invoice has not arrived yet.",
  LAST_INVOICE: "The system reused the most recent bill amount because a current invoice has not arrived yet.",
  simple_average: "The system averaged earlier bills from this vendor to estimate the missing amount.",
  recent_average: "The system averaged the most recent bills from this vendor to estimate the missing amount.",
  weighted_recent_average: "The system weighted recent bills more heavily than older ones to estimate the missing amount.",
  linear_trend: "The system projected the recent trend in this vendor's bills forward to estimate the missing amount.",
  contract_commitment: "The system used the contracted monthly amount because that is what the company has already agreed to pay.",
  usage_run_rate: "The system multiplied recent usage by the contract rate to estimate the missing amount.",
  goods_receipt: "The system used proof that the goods or services were received to estimate the amount that belongs in this month.",
  purchase_order: "The system used the authorized purchase-order amount as the best available estimate.",
  conservative_minimum: "The system used the most conservative available estimate so the month is not overstated.",
  AMORTIZE: "The system is spreading a cost that was paid up front across the months it actually covers.",
  DEPRECIATE: "The system is spreading the cost of equipment across the years it will be used.",
  EXPENSE: "The system recorded the full amount as an expense in this month.",
};

export const FAMILY_COPY: Record<string, string> = {
  documents: "Messy invoices, quotes, and look-alike documents",
  cash: "Bank activity matched to the books with real evidence",
  anti_hack: "Same-dollar distractors that must not be forced together",
  questions: "Questions that combine several company records",
  rubrics: "Close work graded on several criteria, not one number",
  consistency: "Whether every workflow agrees about the same bill",
  long_horizon: "Whether August decisions still matter in later months",
  memory: "Whether a prior decision is reused only when current evidence still supports it",
  recovery: "Whether a broken file or duplicate event causes invented books",
};

export const AGENT_ALIASES: Record<string, string> = {
  "AP Preparer": "ap",
  "Exception Investigator": "ap",
  "AP Reviewer": "ctl-pay",
  "AP Approver": "ctl-pay",
  "AP Audit": "ctl-pay",
  "Email Invoice Agent": "email",
  "Counterparty Message Agent": "email",
  "Finance Inbox Agent": "email",
  "Payment Scheduler": "pay",
  "Payment Audit": "ctl-pay",
  "Collections Agent": "collect",
  "Cash Application Agent": "apply",
  "Cash Application Reviewer": "ctl-cash",
  "Cash Reconciliation Preparer": "cash",
  "Cash Exception Investigator": "cash",
  "Cash Reconciliation Reviewer": "ctl-cash",
  "Close Manager": "close",
  "Accrual Agent": "close",
  "Prepaid Preparer": "close",
  "Fixed Asset Preparer": "close",
  "Month-End Close Reviewer": "ctl-books",
  "Cash Forecast Agent": "story",
  "Variance Analysis Agent": "story",
  "Forecast Variance Agent": "story",
  "Auditor Agent": "audit",
  "Audit Report Agent": "audit",
  "bot_ap": "ap",
  "bot_ctl_pay": "ctl-pay",
  "bot_ctl_cash": "ctl-cash",
  "bot_ctl_books": "ctl-books",
  AP_AGENT: "ap",
  CASH_AGENT: "cash",
  AR_AGENT: "apply",
  CLOSE_AGENT: "close",
};

export const TASK_COPY: Record<string, string> = {
  "TASK-AP": "Accounts payable",
  "TASK-AR": "Accounts receivable",
  "TASK-CASH": "Cash reconciliation",
  "TASK-ACCRUAL": "Accrued expenses",
  "TASK-PREPAID": "Prepaid expenses",
  "TASK-FA": "Fixed assets",
  "TASK-BS": "Balance sheet reconciliation",
  "TASK-FINAL": "Final close check",
  ap: "Accounts payable",
  ar: "Accounts receivable",
  cash: "Cash reconciliation",
  accruals: "Accrued expenses",
  prepaid: "Prepaid expenses",
  depreciation: "Fixed assets",
  bs: "Balance sheet reconciliation",
  final: "Final close check",
};

export const WORKFLOW_COPY: Record<string, string> = {
  email: "email intake",
  stripe: "Stripe payout explanation",
  bank: "bank feed",
  books: "accounting records",
  ap: "accounts payable review",
  pay: "vendor payment scheduling",
  apply: "customer cash application",
  collect: "collections follow-up",
  cash: "bank reconciliation",
  close: "month-end close",
  story: "forecast and reporting",
  "ctl-pay": "payables control check",
  "ctl-cash": "cash control check",
  "ctl-books": "books control check",
  audit: "independent audit",
  memory: "decision memory",
  ingest: "document intake",
  "invoice-ingestion": "invoice intake",
  inbox: "inbox handoff",
  "cfo-cycle": "full Office of the CFO cycle",
  evaluate: "evaluation run",
  accrual: "missing-bill accrual",
  forecast: "13-week cash forecast",
  "ar-aging": "unpaid invoice aging",
  "ar-collections": "collections follow-up",
  "ar-cash-apply": "customer payment matching",
  "bank-reconciliation": "bank reconciliation",
  gauntlet: "the Finance Gauntlet",
  "memory-eval": "memory on versus off comparison",
  schedule: "vendor payment scheduling",
};

export const CAPABILITY_COPY: Record<string, string> = {
  "ingestion.classify_document": "Tell invoices apart from quotes, receipts, and other documents",
  "ap.three_way_match": "Compare a vendor bill with its purchase order and receiving record",
  "ap.payment_scheduling": "Decide which approved vendor bills belong in the payment run",
  "ar.aging_collections": "Group unpaid invoices by how late they are and choose follow-up",
  "ar.cash_application": "Match customer payments to the invoices they settle",
  "cash.bank_reconciliation": "Match bank activity to ledger cash entries",
  "close.accruals": "Estimate expenses that belong in the month before the bill arrives",
  "close.prepaids": "Spread prepaid costs across the months they cover",
  "close.fixed_assets": "Record equipment as an asset and spread its cost over time",
  "close.balance_sheet_recs": "Check that balance-sheet accounts agree with supporting records",
  "close.month_end": "Coordinate finishing the month's books",
  "audit.controls": "Re-test whether company controls were followed",
  "reporting.variance_board": "Explain why results changed and prepare board figures",
  "forecast.thirteen_week": "Project cash on hand for the next 13 weeks",
  "memory.cross_period": "Reuse a prior-period decision only when current evidence still supports it",
};

export const EVAL_CASE_COPY: Record<string, { title: string; test: string }> = {
  "AC-EMAIL-CLEAN": {
    title: "Correctly classify a normal invoice",
    test: "A vendor emails a real invoice. Maximor should recognize it as a bill and extract the invoice number.",
  },
  "AC-EMAIL-QUOTE": {
    title: "Reject a quote that looks like an invoice",
    test: "A vendor sends a quotation. Maximor should not treat it as a bill to pay.",
  },
  "AC-AP-PREPARER-CLEAN": {
    title: "Approve a clean three-way match",
    test: "The invoice, purchase order, and receiving record agree. Maximor should approve the bill.",
  },
  "AC-AP-INVESTIGATOR-ALIAS": {
    title: "Approve a known vendor operating under another name",
    test: "The bill uses a vendor alias already established last period. Maximor should reuse that precedent and approve.",
  },
  "AC-AP-DUP": {
    title: "Detect a duplicate invoice",
    test: "Two vendor bills appear to request payment for the same Northline invoice. Maximor should hold the duplicate.",
  },
  "AC-SCHEDULER-DUE": {
    title: "Include a due vendor bill in the payment run",
    test: "An approved bill is due. Maximor should treat it as eligible for this week's payments.",
  },
  "AC-COLLECTIONS": {
    title: "Flag a customer invoice more than 90 days overdue",
    test: "An old unpaid invoice should land in the 90+ aging group and receive collection follow-up, not 'no action.'",
  },
  "AC-CASH-APPLY-EXACT": {
    title: "Apply an exact customer payment",
    test: "A customer payment clearly belongs to one invoice. Maximor should apply it automatically.",
  },
  "AC-CASH-APPLY-AMBIGUOUS": {
    title: "Leave an ambiguous customer payment unmatched",
    test: "Lumen Labs paid $5,000 with only 'September billing' as the description. Maximor should not guess which invoice it belongs to.",
  },
  "AC-CASH-RECON-1240": {
    title: "Detect the unexplained $12.40 bank difference",
    test: "Northstar's bank deposit is $12.40 higher than the invoice. Maximor should leave the difference unresolved rather than invent an explanation.",
  },
  "AC-CASH-RECON-GROUPED": {
    title: "Match one payment to multiple invoices",
    test: "One bank withdrawal pays several vendor invoices. Maximor should group them into a single match.",
  },
  "AC-CASH-INVESTIGATOR": {
    title: "Refuse to invent an explanation for $12.40",
    test: "When evidence is missing, the investigator must not fabricate a fee or adjustment.",
  },
  "AC-CASH-REVIEWER": {
    title: "Match a transfer after subtracting the bank fee",
    test: "A wire lands net of a bank fee. Maximor should match bank, ledger, and fee evidence together.",
  },
  "AC-ACCRUAL": {
    title: "Estimate a missing Harbor Electric bill",
    test: "September electricity was used but the bill has not arrived. Maximor should record an accrual.",
  },
  "AC-PREPAID": {
    title: "Account for a prepaid expense",
    test: "A payment covers future months of coverage. Maximor should spread the cost rather than expense it all at once.",
  },
  "AC-ASSET": {
    title: "Treat a capital purchase as a fixed asset",
    test: "A qualifying equipment purchase should be capitalized and depreciated, not expensed immediately.",
  },
  "AC-BS-RECON": {
    title: "Keep the cash rec open while $12.40 is unexplained",
    test: "Balance-sheet cash cannot be finished while the Northstar difference is still unresolved.",
  },
  "AC-CLOSE-REVIEW": {
    title: "Block month-end close on the $12.40 difference",
    test: "Close should remain incomplete until the unexplained cash difference is resolved.",
  },
  "AC-CLOSE-MANAGER": {
    test: "The close coordinator should see that cash is still blocked and not mark the month closed.",
    title: "Coordinate close without forcing a close",
  },
  "AC-AUDITOR": {
    title: "Detect planted control failures",
    test: "Independent audit should find the duplicate vendor, duplicate invoice, round payment, post-close journal, and self-approval that were planted in the population.",
  },
  "AC-VARIANCE": {
    title: "Explain the gross-margin change",
    test: "September margin moved versus August. Maximor should point at the actual supplier and hosting cost drivers.",
  },
  "AC-FORECAST": {
    title: "Produce a 13-week cash forecast",
    test: "The forecast should contain 13 weekly ending-cash projections.",
  },
  "AC-FORECAST-VAR": {
    title: "Identify why the cash forecast missed",
    test: "A late customer collection and an unexpected vendor payment should be named as miss sources.",
  },
  "AC-BOARD": {
    title: "Tie board metrics to the general ledger",
    test: "Board figures must come from the same ledger accounts as the books, not a separate invented pack.",
  },
};

export const EXCEPTION_COPY: Record<string, string> = {
  duplicate: "This invoice may be a duplicate of another invoice already in the system.",
  vendor_mismatch: "The vendor name on the bill does not match the purchase order, but a known alias may explain it.",
  quantity_variance: "The quantity billed does not match what was ordered or received.",
  price_variance: "The price billed does not match the authorized purchase order.",
  missing_po: "No purchase order was found for this bill.",
  missing_receipt: "There is no receiving record showing the goods or services arrived.",
  self_approval: "The same person requested and approved this transaction.",
  three_way_match_failed: "The invoice could not be fully matched to the purchase order and delivery record.",
  exception_duplicate_candidate: "This invoice may be a duplicate of another invoice already in the system.",
  partial_receipt: "The company was billed for more than has actually been received so far.",
  goods_not_received: "There is no record that the ordered goods or services arrived.",
  po_not_approved: "The purchase order was never approved, so this bill is not authorized.",
  material_amount_mismatch: "The billed amount is materially different from what was authorized.",
  small_amount_discrepancy: "The billed amount is slightly different from the purchase order, within a small tolerance.",
  unusual_timing: "The invoice is dated before the purchase order, which is unusual.",
  approval_limit_exceeded: "The purchase exceeds the amount this approver is allowed to authorize.",
  unknown_invoice: "This invoice is not in the company's records.",
  amount_mismatch: "The billed amount does not agree with the authorized purchase order or receiving record.",
  date_mismatch: "The dates on the bill do not line up with the order or delivery.",
  po_mismatch: "The purchase-order number on the bill does not match company records.",
  unexplained_difference: "The bank and the ledger disagree, and no supporting fee or adjustment was found.",
  qty_mismatch: "The invoice says the vendor billed for a different quantity than the company recorded as received.",
  qty_variance: "The invoice says the vendor billed for a different quantity than the company recorded as received.",
  quantity_mismatch: "The invoice says the vendor billed for a different quantity than the company recorded as received.",
};

export const AGING_COPY: Record<string, string> = {
  CURRENT: "Not overdue yet",
  "1-30": "1–30 days overdue",
  "31-60": "31–60 days overdue",
  "61-90": "61–90 days overdue",
  "90+": "More than 90 days overdue",
};

export const GLOSSARY: Record<string, string> = {
  "Accounts payable": "Money the company owes vendors for bills that have arrived.",
  "Accounts receivable": "Money customers still owe the company for invoices it has already sent.",
  Aging: "Grouping unpaid invoices by how long they have been outstanding.",
  Remittance: "The payment message a customer sends with money, often naming invoices — and sometimes not.",
  "Cash application": "Matching money received from customers to the invoices those customers were paying.",
  Reconciliation: "Checking whether two independent records of the same money tell the same story.",
  "General ledger": "The company's official set of accounting records.",
  Accrual: "Recording an expense in the month it was incurred, before the invoice arrives.",
  "Prepaid expense": "A cost paid up front that should be spread across the months it covers.",
  "Journal entry": "The formal accounting record that increases one account and decreases another by the same amount.",
  Debit: "The left-hand side of a journal entry — here, usually the expense being recorded.",
  Credit: "The right-hand side of a journal entry — here, usually the liability or cash account.",
  Close: "Finishing a month's books so the financial statements include everything that belongs in that month.",
  Variance: "The difference between what was expected and what actually happened.",
  "13-week cash forecast": "A week-by-week estimate of how much money will be in the bank over the next 13 weeks.",
  Chargeback: "A customer dispute that pulls money back out of a card or Stripe payout.",
  "Three-way match": "A check that the invoice, purchase order, and proof of delivery all agree.",
  "Unapplied cash": "Customer money that has arrived but has not yet been matched to a specific invoice.",
  "Decision memory": "A saved record of how Maximor handled a finance decision, including the evidence and reason, so a later period can reuse or override it.",
  "Purchase order": "The company's authorization to buy specific goods or services at an agreed price.",
  "Goods receipt": "The record that the ordered goods or services actually arrived.",
  "Gross margin": "The share of sales left after the direct costs of delivering the product or service.",
  "Balance sheet": "The snapshot of what the company owns and owes at a point in time.",
  "Fixed asset": "Equipment or other long-lived property that should be recorded as an asset and spread over its useful life.",
  Depreciation: "Spreading the cost of equipment across the years it will be used.",
  "Stripe payout": "The net amount Stripe sends to the bank after charges, refunds, disputes, and fees.",
  "Vendor invoice": "A bill from a supplier asking the company to pay for goods or services.",
  Quote: "A price offer, not a bill. It should not create money the company owes.",
  "Month-end close": "The work of finishing a month's books so the financial statements include everything that belongs in that month.",
  "Audit evidence": "The original records an auditor uses to check whether a transaction and its controls actually happened.",
  "Bank fee": "A charge the bank or payment processor takes, which can make a deposit or withdrawal differ from the original invoice amount.",
  "Duplicate invoice": "A second copy of the same vendor bill. Paying both would mean paying twice.",
  "Outstanding balance": "The amount still unpaid on an invoice.",
  "Payment terms": "The agreed rules for when a bill must be paid, such as due in 30 days.",
  "Aging bucket": "A group of unpaid invoices sorted by how late they are, such as not overdue yet or more than 90 days overdue.",
  "Balance-sheet account": "A ledger account that records what the company owns or owes at a point in time, such as cash or unpaid bills.",
  "Human review": "A pause because the available evidence is not strong enough for Maximor to finish the decision on its own.",
  Invoice: "A bill asking for payment. A vendor invoice is money the company may owe; a customer invoice is money a customer may owe the company.",
};

export const KNOWN_ENUMS = {
  status: Object.keys(STATUS_COPY),
  decision: Object.keys(DECISION_COPY),
  matchType: Object.keys(MATCH_TYPE_COPY),
  method: Object.keys(METHOD_COPY),
  task: Object.keys(TASK_COPY),
  agent: Object.keys(AGENT_COPY),
  capability: Object.keys(CAPABILITY_COPY),
  evalCase: Object.keys(EVAL_CASE_COPY),
  aging: Object.keys(AGING_COPY),
};

export function looksLikeId(value: unknown): boolean {
  const raw = String(value ?? "").trim();
  if (!raw) return false;
  return /^(INV|PAY|TXN|GL|TASK|JE|ACC|HI|CTR|MSG|PO|GR|MEM|CASE|CUST|VEND|APR|PRE|AC|DOC|FEE|USR|CO)-[A-Z0-9._-]+$/i.test(raw);
}

export function formatStatus(value: unknown): string {
  if (value === true) return "Yes";
  if (value === false) return "No";
  if (looksLikeId(value)) return String(value);
  return lookup(STATUS_COPY, value, lookup(DECISION_COPY, value, lookup(METHOD_COPY, value, lookup(EXCEPTION_COPY, value, humanizeToken(value) || "—"))));
}

export function formatDecision(value: unknown): string {
  return lookup(DECISION_COPY, value, lookup(STATUS_COPY, value, humanizeToken(value) || "—"));
}

export function formatMatchType(value: unknown): string {
  return lookup(MATCH_TYPE_COPY, value, humanizeToken(value) || "—");
}

export function formatMatchSentence(value: unknown): string {
  return lookup(MATCH_TYPE_SENTENCE, value, formatMatchType(value));
}

export function formatAccountingMethod(value: unknown): string {
  return lookup(METHOD_COPY, value, humanizeToken(value) || "—");
}

export function formatAccountingSentence(value: unknown): string {
  return lookup(METHOD_SENTENCE, value, formatAccountingMethod(value));
}

export function formatControlResult(value: unknown): string {
  return lookup(STATUS_COPY, value, humanizeToken(value) || "—");
}

export function formatWorkflow(value: unknown): string {
  return lookup(WORKFLOW_COPY, value, humanizeToken(value) || "workflow");
}

export function formatAgent(value: unknown): string {
  const key = String(value || "").trim();
  if (!key) return "Agent";
  if (AGENT_COPY[key]) return AGENT_COPY[key].name;
  const aliased = AGENT_ALIASES[key] || AGENT_ALIASES[key.replace(/_/g, "-")];
  if (aliased && AGENT_COPY[aliased]) return AGENT_COPY[aliased].name;
  const slug = key.replace(/_/g, "-").replace(/^bot-/, "");
  if (AGENT_COPY[slug]) return AGENT_COPY[slug].name;
  return humanizeToken(key) || "Agent";
}

export function formatFamily(value: unknown): string {
  return lookup(FAMILY_COPY, value, humanizeToken(value) || "Other tests");
}

export function formatPeriod(value: unknown): string {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{4})-(\d{2})$/);
  if (!match) return raw || "—";
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const month = months[Number(match[2]) - 1];
  return month ? `${month} ${match[1]}` : raw;
}

const MONTH_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function formatDateTime(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "—";
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (!match) return raw;
  const month = MONTH_LONG[Number(match[2]) - 1];
  if (!month) return raw;
  const date = `${month} ${Number(match[3])}, ${match[1]}`;
  return match[4] ? `${date} at ${match[4]}:${match[5]}` : date;
}

export const CADENCE_COPY: Record<string, string> = {
  daily: "Runs every day",
  weekly: "Runs every week",
  monthly: "Runs every month",
  quarterly: "Runs every quarter",
};

export function formatCadence(value: unknown): string {
  return lookup(CADENCE_COPY, value, humanizeToken(value) || "—");
}

export function formatConfidence(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  const pct = n <= 1 ? Math.round(n * 100) : Math.round(n);
  return `${pct}%`;
}

/** Translate a record identifier for humans. Internal IDs stay unchanged. */
export function formatRecordId(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (raw.startsWith("BANK-po_1Maximor") || raw.startsWith("po_1Maximor")) {
    const kind = raw.replace(/^BANK-/, "").replace(/^po_1Maximor/, "").toLowerCase();
    const payout =
      kind === "fees"
        ? "Stripe payout with processing fees"
        : kind === "refunds"
          ? "Stripe payout with refunds"
          : kind === "disputes"
            ? "Stripe payout with disputes"
            : "Stripe payout to the bank";
    return raw.startsWith("BANK-") ? `Bank deposit for ${payout}` : payout;
  }
  if (TASK_COPY[raw]) return TASK_COPY[raw];
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return formatDateTime(raw);
  if (/^\d{4}-\d{2}$/.test(raw)) return formatPeriod(raw);
  if (!looksLikeId(raw)) return raw;
  if (/^INV-AR/i.test(raw)) return `Customer invoice ${raw}`;
  if (/^INV-/i.test(raw)) return `Vendor invoice ${raw}`;
  if (/^PAY-/i.test(raw)) return `Customer payment ${raw}`;
  if (/^TXN-/i.test(raw)) return `Bank transaction ${raw}`;
  if (/^GL-/i.test(raw)) return `Ledger entry ${raw}`;
  if (/^JE-/i.test(raw)) return `Journal entry ${raw}`;
  if (/^ACC-/i.test(raw)) return `Accrual ${raw}`;
  if (/^HI-/i.test(raw)) return `Earlier bill ${raw}`;
  if (/^CTR-/i.test(raw)) return `Control test ${raw}`;
  if (/^MSG-/i.test(raw)) return `Incoming email ${raw}`;
  if (/^PO-/i.test(raw)) return `Purchase order ${raw}`;
  if (/^GR-/i.test(raw)) return `Receiving record ${raw}`;
  if (/^MEM-/i.test(raw)) return `Saved decision ${raw}`;
  if (/^CASE-/i.test(raw)) return `Case ${raw}`;
  if (/^CUST-/i.test(raw)) return `Customer ${raw}`;
  if (/^VEND-/i.test(raw)) return `Vendor ${raw}`;
  if (/^APR-/i.test(raw)) return `Approval ${raw}`;
  if (/^PRE-/i.test(raw)) return `Prepaid ${raw}`;
  if (/^AC-/i.test(raw)) return `Evaluation case ${raw}`;
  if (/^DOC-/i.test(raw)) return `Document ${raw}`;
  if (/^FEE-/i.test(raw)) return `Fee evidence ${raw}`;
  if (/^USR-/i.test(raw)) return `User ${raw}`;
  if (/^CO-/i.test(raw)) return `Company ${raw}`;
  return raw;
}

export function formatExecution(value: unknown): string {
  return lookup(STATUS_COPY, value, humanizeToken(value) || "Using the company's recorded rules");
}

export function formatRecordType(value: unknown): string {
  const table: Record<string, string> = {
    email: "Email",
    invoice: "Vendor invoice",
    customer_invoice: "Customer invoice",
    purchase_order: "Purchase order",
    goods_receipt: "Receiving record",
    bank_transaction: "Bank transaction",
    ledger_entry: "Ledger cash entry",
    journal_entry: "Journal entry",
    stripe_payout: "Stripe payout",
    stripe_balance_txn: "Stripe balance transaction",
    decision_memory: "Saved decision",
    historical_invoice: "Prior monthly bill",
    payment: "Payment",
    remittance: "Customer payment",
    document: "Document",
    table: "Supporting table",
  };
  return lookup(table, value, humanizeToken(value) || "Record");
}

export function formatTask(value: unknown): string {
  return lookup(TASK_COPY, value, humanizeToken(value) || "Close task");
}

export function formatAgingBucket(value: unknown): string {
  return lookup(AGING_COPY, value, humanizeToken(value) || "—");
}

export function formatCapability(value: unknown): string {
  return lookup(CAPABILITY_COPY, value, humanizeToken(value) || "—");
}

export function formatException(value: unknown): string {
  return lookup(EXCEPTION_COPY, value, humanizeToken(value) || "—");
}

export function formatEvalCase(caseId: unknown): { title: string; test: string; id: string } {
  const id = String(caseId || "");
  const known = EVAL_CASE_COPY[id];
  return {
    id,
    title: known?.title || humanizeToken(id.replace(/^AC-/, "")) || id,
    test: known?.test || "This case compares Maximor's result with a known expected outcome.",
  };
}

export function formatWeekDate(value: unknown): string {
  const raw = String(value || "");
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return raw || "—";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[Number(match[2]) - 1];
  return month ? `${month} ${Number(match[3])}` : raw;
}

export function formatFieldKey(key: string): string {
  const table: Record<string, string> = {
    cash: "Cash in bank",
    ap_outstanding: "Unpaid vendor bills",
    ar_outstanding: "Unpaid customer invoices",
    close_status: "Month-end status",
    exception_count: "Open exceptions",
    journal_count: "Journal entries",
    decision_memory_count: "Saved decisions",
    projected_ending_cash: "Forecast ending cash",
    unreconciled_item: "Unresolved bank item",
    match_status: "Match result",
    duplicate_status: "Duplicate check",
    payment_state: "Payment status",
    accounting_status: "Accounting status",
    invoice_id: "Invoice",
    vendor: "Vendor",
    vendor_name: "Vendor",
    amount: "Amount",
    po_id: "Purchase order",
    invoice_number: "Invoice number",
    vendor_invoice_number: "Vendor invoice number",
    invoice_date: "Invoice date",
    due_date: "Due date",
    description: "Description",
    status: "Status",
    exceptions: "Problems found",
    linked_payments: "Linked payments",
    linked_journals: "Linked journal entries",
    artifact_id: "Record",
    source_path: "Source file",
    content_type: "File type",
    amount_minor: "Amount",
    payout_id: "Stripe payout",
    bank_deposit_id: "Bank deposit",
    bank_deposit_amount: "Bank deposit amount",
    transaction_id: "Bank transaction",
    entry_id: "Ledger entry",
    counterparty: "Counterparty",
    reference: "Reference",
    beginning_cash: "Cash at start of week",
    ending_cash: "Cash at end of week",
    ar_collections: "Expected customer collections",
    ap_payments: "Expected vendor payments",
    payroll: "Payroll",
    pay_this_week: "Bills in this week's payment run",
    defer: "Bills deferred to a later week",
    classification: "Document type",
    is_invoice: "Is this a vendor invoice?",
    period_status: "Reconciliation status",
    match_type: "How it was matched",
    final_method: "Estimation method",
    final_amount: "Estimated amount",
    control_name: "Control",
    control_id: "Control",
    severity: "Severity",
    requester_id: "Requested by",
    approver_id: "Approved by",
    debit_account: "Expense or asset account",
    credit_account: "Offset account",
    memo: "Memo",
    quantity_ordered: "Quantity ordered",
    quantity_received: "Quantity received",
    authorized_amount: "Authorized amount",
    received: "Received",
    application_status: "Payment match",
    outstanding_amount: "Still unpaid",
    customer_name: "Customer",
    remittance_text: "Payment message",
    payer_name: "Payer",
    week_start: "Week of",
    week_end: "Week ending",
    sample_id: "Document",
    kind: "Type",
    rationale: "Why",
    situation_summary: "Situation",
    accounting_treatment: "Accounting method",
    selected_method: "Estimation method",
    bot: "Agent",
    slug: "Agent",
    grain: "Agent",
    billed_amount: "Billed amount",
    match_key: "Match",
    finding_id: "Finding",
    event_id: "Event",
    decision_id: "Saved decision",
    period: "Accounting month",
    cadence: "How often",
    record: "Record",
    provenance: "Source trail",
    confidence: "Confidence",
    reason: "Why",
    reason_code: "Why",
    summary: "Summary",
    title: "Title",
    detail: "Detail",
    what_changed: "What changed",
    classification_reason: "Why this document type",
    po_number: "Purchase order",
    invoice_exists_for_september: "September invoice arrived?",
    retrieved_ids: "Retrieved records",
    precedent_used: "Used a previous decision",
    deviation: "Why the previous decision was not copied",
    written_memory_id: "Saved decision",
    payment_id: "Customer payment",
    payment_date: "Payment date",
    bank_reference: "Bank reference",
    three_way: "Invoice verification",
    duplicate_peer: "Possible duplicate",
    source_document: "Original document",
    source_emails: "Source emails",
    goods_receipt: "Receiving record",
    purchase_order: "Purchase order",
    journal_entry: "Journal entry",
    selected: "Selected",
    blocked: "Blocked",
    cash_open: "Cash reconciliation still open",
    needed: "Accrual needed",
    treatment: "Accounting method",
    eligible: "Eligible for payment",
  };
  return table[key] || humanizeToken(key);
}

export function formatSummary(value: unknown): string {
  let text = String(value ?? "").trim();
  if (!text) return "";
  const replacements: Array<[RegExp, string | ((substring: string, ...args: string[]) => string)]> = [
    [/\bwas human review\b/gi, "could not be matched with enough evidence"],
    [/\bHUMAN_REVIEW\b/g, "could not finish with the available evidence"],
    [/\bUNEXPLAINED_DIFFERENCE\b/g, "unresolved difference"],
    [/\bGROUPED_MATCH\b/g, "one payment covering several bills"],
    [/\bFEE_NETTED\b/g, "transfer matched after the bank fee"],
    [/\bPROVIDER_PAYOUT\b/g, "Stripe payout matched to the bank"],
    [/\bEXACT_MATCH\b/g, "exact match"],
    [/\bAUTO_APPLY\b/g, "matched automatically"],
    [/\bUNAPPLIED\b/g, "not yet matched to an invoice"],
    [/\bNEEDS_REVIEW\b/g, "still needs more evidence"],
    [/\bthree_way_match_failed\b/g, "the invoice, purchase order, and delivery record do not all agree"],
    [/\bexception_duplicate_candidate\b/g, "possible duplicate invoice"],
    [/\bseasonal_prior_year\b/gi, "last year's seasonal pattern"],
    [/\busage_run_rate\b/gi, "usage multiplied by the contract rate"],
    [/\bcontract_commitment\b/gi, "the contracted monthly amount"],
    [/\bstraight_line_monthly\b/gi, "spread evenly across each month"],
    [/\bstripe_fee\b/gi, "Stripe processing fee"],
    [/\btxn_fee[-_]fees\b/gi, "Stripe processing fee line"],
    [/\bcanonical invoices\b/gi, "recognized vendor invoices"],
    [/\bclassified as\b/gi, "identified as"],
    [/\bpayout waterfalls\b/gi, "payout explanations"],
    [/\bprovider matches\b/gi, "processor payouts tied to the bank"],
    [/\bAR outstanding\b/g, "Unpaid customer invoices"],
    [/\bClose ([A-Z_]+)\b/g, (_m, status: string) => `Month-end status: ${formatStatus(status)}`],
    [/\bCFO cycle close=([A-Z_]+)\b/g, (_m, status: string) => `The connected finance cycle finished with month-end still ${formatStatus(status).toLowerCase()}`],
    [/\bctl-pay\b/gi, "Payables Control"],
    [/\bctl-cash\b/gi, "Cash Control"],
    [/\bctl-books\b/gi, "Books Control"],
    [/\bPython evidence\b/gi, "Supporting records"],
    [/\bPython candidates\b/gi, "Possible matches"],
    [/\bPython match combinations\b/gi, "Possible invoice matches"],
    [/\bPython estimate candidates\b/gi, "Possible estimates"],
    [/\bApproved pool\b/g, "Bills already cleared for payment"],
    [/\bCash \+ policy net\b/g, "Cash on hand and payment policy"],
    [/\bField interpretation\b/g, "Read the invoice fields"],
    [/\bCanonical invoice registration\b/g, "Create a vendor bill if this is actually an invoice"],
    [/\bCanonical registration\b/g, "Create a vendor bill if this is actually an invoice"],
    [/\bInbox classification\b/g, "Identify what kind of document arrived"],
    [/\bDocument classification\b/g, "Identify what kind of document arrived"],
    [/\bnot an invoice\b/gi, "not treated as a vendor invoice"],
    [/\bduplicates removed\b/gi, "duplicate copies set aside"],
    [/\bBS recs\b/g, "Balance-sheet checks"],
    [/\bMemory ON vs OFF evaluation complete\b/g, "Compared September with last month's saved decision against estimating from scratch"],
  ];
  for (const [pattern, next] of replacements) {
    text = text.replace(pattern, next as never);
  }
  text = text.replace(/\b[A-Z][A-Z0-9_]{3,}\b/g, (token) => {
    if (looksLikeId(token)) return token;
    const friendly = lookup(STATUS_COPY, token, lookup(DECISION_COPY, token, lookup(MATCH_TYPE_COPY, token, "")));
    return friendly || humanizeToken(token);
  });
  text = text.replace(/\b[a-z]+(?:_[a-z0-9]+)+\b/g, (token) => lookup(STATUS_COPY, token, lookup(EXCEPTION_COPY, token, humanizeToken(token))));
  text = text.replace(/\b(\d{5,}(?:\.\d+)?)\b/g, (token) => {
    const num = Number(token);
    return Number.isFinite(num) ? usd(num) : token;
  });
  return text;
}

export function explainCashMatch(item: any): { title: string; body: string } {
  const type = String(item?.match_type || "");
  const bank = usd(item?.bank_amount);
  const ledger = usd(item?.ledger_amount);
  const diff = usd(Math.abs((Number(item?.bank_amount) || 0) - (Number(item?.ledger_amount) || 0)));
  const title = formatMatchType(type);
  if (type === "UNEXPLAINED_DIFFERENCE") {
    return {
      title,
      body: `The bank shows ${bank} while the ledger records ${ledger}. Maximor searched for a fee, adjustment, or invoice difference and could not find evidence for the extra ${diff}.`,
    };
  }
  if (type === "GROUPED_MATCH") {
    const count = (item?.ledger_entry_ids || []).length;
    return {
      title,
      body: `One ${bank} bank movement corresponds to ${count || "several"} ledger entries totaling ${ledger}.`,
    };
  }
  if (type === "FEE_NETTED") {
    return {
      title,
      body: `A ${bank} bank transfer matches ${ledger} in the ledger after accounting for the bank fee.`,
    };
  }
  if (type === "PROVIDER_PAYOUT") {
    return {
      title,
      body: `A Stripe payout of ${bank} matches the bank deposit after charges, refunds, disputes, and fees.`,
    };
  }
  if (type === "EXACT_MATCH") {
    return { title, body: `Bank ${bank} matches ledger ${ledger} exactly.` };
  }
  return { title, body: formatMatchSentence(type) };
}

export function formatHandoff(bots: unknown, workflow?: unknown): string {
  const slugs = (Array.isArray(bots) ? bots : [bots])
    .map((item) => {
      if (item && typeof item === "object") {
        const row = item as Record<string, unknown>;
        return String(row.slug || row.bot || row.display_name || row.name || "");
      }
      return String(item || "");
    })
    .filter(Boolean);
  const unique = Array.from(new Set(slugs.map(formatAgent)));
  const work = formatWorkflow(workflow || slugs[0]);
  if (!unique.length) {
    return workflow ? `Work continued on ${work}.` : "";
  }
  if (unique.length === 1) {
    return `${unique[0]} finished ${work} and recorded the result on the shared company books.`;
  }
  if (unique.length === 2) {
    return `${unique[0]} sent this work to ${unique[1]} so ${work} could continue.`;
  }
  const last = unique[unique.length - 1];
  const lead = unique.slice(0, -1).join(", ");
  return `${lead} each completed their part, then handed the result to ${last} so ${work} could continue.`;
}

export function formatStage(stage: any): { label: string; detail?: string } {
  const bot = formatAgent(stage?.bot || stage?.slug);
  const id = String(stage?.id || "");
  const known: Record<string, string> = {
    memory: `${bot} retrieved the prior-period decision.`,
    ap: `${bot} reviewed featured vendor bills.`,
    ar: `${bot} applied or evaluated customer payments.`,
    cash: `${bot} reconciled bank activity to the ledger.`,
    close: `${bot} ran the month-end close checklist.`,
    reporting: `${bot} refreshed the cash forecast and explained why results changed.`,
    audit: `${bot} independently re-tested company controls.`,
    ingest: `${bot} classified the incoming document.`,
    match: `${bot} compared the bill with its purchase order and receiving record.`,
    apply: `${bot} tried to match the customer payment to invoices.`,
    facts: `${bot} gathered the invoice, purchase order, and delivery record.`,
    prepare: `${bot} checked whether the bill is safe to pay.`,
    investigate: `${bot} investigated why the bill does not line up.`,
    concur: `${bot} independently rechecked the payables decision.`,
    pool: `${bot} collected bills that had already passed payable checks.`,
    policy: `${bot} weighed due dates, cash on hand, and payment policy.`,
    candidates: `${bot} listed possible matches from the available records.`,
    decide: `${bot} made a decision from the available evidence.`,
    verify: `${bot} independently rechecked an uncertain match.`,
    unpack: `${bot} unpacked the Stripe payout into charges, refunds, fees, and disputes.`,
    math: `${bot} checked whether charges minus refunds, disputes, and fees equal the payout.`,
    bank: `${bot} tied the explained payout to the bank deposit.`,
    gl: `${bot} compared the result with the accounting records.`,
    evidence: `${bot} collected contracts, prior bills, and other supporting records.`,
    journal: `${bot} recorded the formal accounting entry.`,
    sample: `${bot} sampled invoices, payments, journals, and approvals.`,
    controls: `${bot} re-performed the company's controls.`,
    findings: `${bot} wrote findings with source evidence.`,
    sources: `${bot} collected incoming finance documents.`,
    classified: `${bot} identified what kind of document arrived.`,
    fields: `${bot} read vendor, amount, dates, and invoice number.`,
    canonical: `${bot} created a vendor bill only if the document is actually an invoice.`,
    duplicate: `${bot} checked whether this is a second copy of a bill already on file.`,
    received: `${bot} received the incoming document.`,
    dispatch: `${bot} routed the document to the right next agent.`,
    lock: `${bot} decided whether the month is actually ready to lock.`,
    prepaid: `${bot} spread prepaid costs across the months they cover.`,
    assets: `${bot} recorded equipment as an asset instead of an immediate expense.`,
    bs: `${bot} checked that balance-sheet accounts agree with supporting records.`,
    accrual: `${bot} estimated expenses that belong in the month before the bill arrives.`,
  };
  const rawLabel = String(stage?.label || "");
  const label = known[id] || (rawLabel && !/[._]|Python|ctl-|canonical/i.test(rawLabel) ? rawLabel : `${bot} ran ${formatWorkflow(rawLabel || id)}.`);
  const detail = stage?.detail != null && stage.detail !== "" ? formatSummary(stage.detail) : undefined;
  return { label, detail };
}

export function explainMetric(key: string, value: unknown, extras?: Record<string, unknown>): { label: string; interpretation: string } {
  const label = formatFieldKey(key);
  const amount = typeof value === "number" ? usd(value) : formatStatus(value);
  const overdue60 = extras?.overdue60 != null ? usd(Number(extras.overdue60)) : null;
  const table: Record<string, string> = {
    cash: `The company currently has ${amount} available in the bank. This is the starting point for paying vendors and covering payroll.`,
    ap_outstanding: `The company currently owes vendors ${amount}. These bills will reduce cash when they are paid.`,
    ar_outstanding: overdue60
      ? `Customers currently owe the company ${amount}. ${overdue60} of that amount has been unpaid for more than 60 days, which makes collection less certain and could affect near-term cash.`
      : `Customers currently owe the company ${amount}. Until they pay, this cash is not yet in the bank.`,
    projected_ending_cash: `The company is projected to have about ${amount} in cash at the end of the 13-week forecast, after expected customer collections, vendor payments, and payroll.`,
    projected_13w_ending_cash: `The company is projected to have about ${amount} in cash at the end of the 13-week forecast. The largest expected cash outflows are payroll and vendor payments.`,
    unreconciled_items: `The bank and the books disagree by ${amount}. Until that difference is explained, cash reconciliation — and therefore month-end close — stays incomplete.`,
    unreconciled_item: `There is still an unresolved bank item: ${amount}.`,
    close_status: `Month-end close is currently “${amount}.” The month cannot be treated as finished while required checks remain open.`,
    exception_count: `${amount} items still need investigation before they can be treated as complete.`,
    journal_count: `${amount} formal accounting entries are on the books for this period.`,
    decision_memory_count: `${amount} earlier decisions are saved so later months can reuse or override them.`,
    open_audit_findings: extras?.open_audit_findings == null ? "Independent audit findings appear after the audit is run." : `${amount} control issues were written by independent audit.`,
  };
  return { label, interpretation: table[key] || `${label}: ${amount}.` };
}

export function friendlyExpected(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value !== "object") return formatStatus(value);
  const row = value as Record<string, unknown>;
  const parts: string[] = [];
  if (row.classification) parts.push(`Treat the document as: ${formatStatus(row.classification)}.`);
  if (row.invoice_number) parts.push(`Extract invoice number ${row.invoice_number}.`);
  if (row.decision) parts.push(formatDecision(row.decision));
  if (Array.isArray(row.exceptions)) {
    parts.push(row.exceptions.length ? `Flag: ${(row.exceptions as string[]).map(formatException).join("; ")}.` : "No exceptions.");
  }
  if (row.aging_bucket) parts.push(`Aging group: ${formatAgingBucket(row.aging_bucket)}.`);
  if (Array.isArray(row.invoice_ids)) parts.push(`Apply to ${(row.invoice_ids as string[]).join(", ")}.`);
  if (row.status) parts.push(formatStatus(row.status));
  if (row.match_type) parts.push(formatMatchType(row.match_type));
  if (row.difference_cents != null) parts.push(`Difference of ${usd(Number(row.difference_cents) / 100)}.`);
  if (row.needed === true) parts.push("An accrual is required.");
  if (row.treatment) parts.push(formatAccountingMethod(row.treatment));
  if (row.period_status) parts.push(`Period status: ${formatStatus(row.period_status)}.`);
  if (row.blocked === true) parts.push("Close remains blocked.");
  if (row.cash_open === true) parts.push("Cash reconciliation is still open.");
  if (row.week_count) parts.push(`Produce ${row.week_count} weekly cash projections.`);
  if (row.invented_explanation === false) parts.push("Do not invent an explanation.");
  if (row.metrics_tie_to_gl === true) parts.push("Board metrics must tie to the general ledger.");
  if (Array.isArray(row.findings_include)) parts.push("Findings must include the planted source records.");
  if (Array.isArray(row.miss_sources)) parts.push("Name the actual forecast-miss sources.");
  if (row.eligible === true) parts.push("The bill is eligible for the payment run.");
  if (row.august != null && row.september != null) parts.push(`Gross margin moves from ${Number(row.august) * 100}% to ${Number(row.september) * 100}%.`);
  if (!parts.length) return "The expected outcome is stored separately from the agents so they cannot read it while they work.";
  return parts.join(" ");
}

export function idsOf(...groups: Array<unknown>): string[] {
  const out: string[] = [];
  for (const group of groups) {
    if (!group) continue;
    if (Array.isArray(group)) {
      for (const item of group) {
        if (typeof item === "string" && item.trim()) out.push(item);
        else if (item && typeof item === "object") {
          const row = item as Record<string, unknown>;
          const id = row.id || row.invoice_id || row.payment_id || row.artifact_id || row.transaction_id;
          if (typeof id === "string") out.push(id);
        }
      }
    } else if (typeof group === "string") {
      out.push(group);
    }
  }
  return Array.from(new Set(out.filter(Boolean)));
}
