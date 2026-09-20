/** Canonical Office of the CFO grain. Source: harness roster + slug-map + handle-map. */

export const GRAIN_SLUGS = [
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
] as const;

export type AgentSlug = (typeof GRAIN_SLUGS)[number];

export type RoomId = "intake" | "pay" | "cash" | "books-close";

export type AgentProfile = { id: string; name: string };

export type AgentDef = {
  slug: AgentSlug;
  name: string;
  room: RoomId;
  role: string;
  example: string;
  inputs: string;
  outputs: string;
  passesTo: string;
  responsibilities: string[];
  workflows: string[];
  skills: string[];
  profiles: AgentProfile[];
};

export const ROOMS: { id: RoomId; title: string; plain: string }[] = [
  { id: "intake", title: "Incoming records", plain: "Documents and money movement land here first: email, Stripe, the bank, and the accounting system." },
  { id: "pay", title: "Money the company owes", plain: "Vendor bills are checked, independently rechecked, and scheduled for payment." },
  { id: "cash", title: "Money in and money at the bank", plain: "Customer payments are matched to invoices, overdue balances are tracked, and the bank is tied to the books." },
  { id: "books-close", title: "Finishing the books", plain: "The month is completed, independently reviewed, explained, and later sampled by audit." },
];

export const SKILL_COPY: Record<string, string> = {
  "invoice-source-identification": "Tell a real bill apart from a quote, receipt, or statement",
  "invoice-field-interpretation": "Read vendor, amount, dates, and invoice number from a document",
  "inbox-triage": "Sort incoming finance mail and decide who should see it next",
  "superseded-document-handling": "Ignore a document that a later file has already replaced",
  "bank-charge-invoice-discovery": "Find whether a card or bank charge already has a matching bill",
  "three-way-match-analysis": "Check that the vendor bill agrees with what was ordered and what arrived",
  "ap-exception-investigation": "Investigate a bill that does not line up",
  "prior-period-precedent": "Look up how a similar case was handled in an earlier month",
  "payment-prioritization": "Choose which approved bills belong in this week's payment run",
  "early-payment-discount-evaluation": "Weigh an early-pay discount against cash on hand",
  "cash-application": "Match customer money to the invoices it was meant to pay",
  "ar-collections-policy": "Decide which unpaid customer invoices need follow-up",
  "cash-reconciliation-method-selection": "Choose how to compare a bank line with the ledger",
  "bank-reference-interpretation": "Read bank memo text and reference numbers",
  "reconciliation-exception-investigation": "Investigate a bank line that does not match the books",
  "reconciliation-evidence-validation": "Check that a proposed bank match actually has supporting evidence",
  "accrual-evidence-evaluation": "Judge whether an unbilled expense belongs in this month",
  "accrual-method-selection": "Choose how to estimate an expense before the bill arrives",
  "prepaid-expense-accounting": "Spread a prepaid cost across the months it covers",
  "fixed-asset-depreciation": "Record equipment as an asset and spread its cost over time",
  "balance-sheet-reconciliation": "Check that a balance-sheet account agrees with supporting records",
  "month-end-close-coordination": "Coordinate the work needed to finish the month",
  "month-end-close-review": "Recheck whether the month is actually ready to lock",
  "financial-variance-analysis": "Explain why results changed versus last period",
  "cash-forecasting": "Project cash on hand week by week",
  "ar-cash-forecasting": "Estimate when customers are likely to pay",
  "forecast-vs-actual-interpretation": "Explain why a cash forecast missed",
  "board-financial-reporting": "Prepare board figures that tie to the official books",
  "audit-sampling-interpretation": "Choose and interpret a sample of transactions after the fact",
  "control-testing-interpretation": "Retest whether company controls were followed",
  "reconciliation-reperformance-review": "Re-perform a reconciliation independently",
  "segregation-of-duties-interpretation": "Check that the same person did not request and approve a transaction",
  "audit-finding-writing": "Write an audit finding with source evidence",
};

export const AGENTS: AgentDef[] = [
  {
    slug: "email",
    name: "Email Agent",
    room: "intake",
    role: "Reads incoming finance emails and attachments and identifies what kind of document arrived.",
    example: "If a vendor emails an invoice, the Email Agent identifies it as an invoice, extracts the attachment, and sends the record into accounts payable.",
    inputs: "Emails, attachments, employee uploads, and vendor-portal documents.",
    outputs: "A classification (invoice, quote, statement, receipt, or other) plus extracted fields when the document is a bill.",
    passesTo: "Hands invoices to the Accounts Payable Agent and customer remittances toward cash application.",
    responsibilities: [
      "Land and classify finance mail",
      "Extract invoice fields from attachments",
      "Route customer remittances separately from vendor bills",
    ],
    workflows: ["Inbox", "Invoice intake"],
    skills: ["invoice-source-identification", "invoice-field-interpretation", "inbox-triage", "superseded-document-handling"],
    profiles: [
      { id: "inbox", name: "Sort incoming finance mail" },
      { id: "invoice", name: "Read a vendor invoice from email" },
      { id: "employee", name: "Read an employee-submitted receipt" },
      { id: "portal", name: "Read a vendor-portal invoice" },
      { id: "document", name: "Read a scanned paper document" },
    ],
  },
  {
    slug: "stripe",
    name: "Stripe Agent",
    room: "intake",
    role: "Tracks money processed through Stripe. It connects customer charges, refunds, disputes, Stripe fees, and payouts so Maximor can explain exactly how a Stripe payout became a bank deposit.",
    example: "When Stripe sends a payout, this agent reconstructs gross charges minus refunds, chargebacks, and fees, then ties that net amount to the bank deposit.",
    inputs: "Stripe payouts, balance transactions, refunds, disputes, and matching bank deposits.",
    outputs: "A payout waterfall and a yes/no answer for whether the deposit matches Stripe's net.",
    passesTo: "Hands the explained payout to cash reconciliation. A broken payout waterfall goes to Cash Control.",
    responsibilities: [
      "Unpack Stripe payouts into charges, refunds, fees, and disputes",
      "Explain why a bank deposit equals Stripe's net",
    ],
    workflows: ["Stripe payout explanation"],
    skills: [],
    profiles: [{ id: "payout", name: "Explain a Stripe payout" }],
  },
  {
    slug: "bank",
    name: "Bank Agent",
    room: "intake",
    role: "Reads bank activity and provides the cash transactions that Maximor needs to reconcile against the accounting ledger.",
    example: "It lands each deposit and withdrawal from the bank feed so cash reconciliation can look for a matching ledger explanation.",
    inputs: "Bank statement lines and corporate-card charges.",
    outputs: "Canonical bank transactions used by cash reconciliation.",
    passesTo: "Hands bank lines to the Cash Reconciliation Agent. A card charge is not treated as a vendor bill.",
    responsibilities: [
      "Land bank statement lines",
      "Land corporate-card charges without inventing a vendor bill",
    ],
    workflows: ["Bank feed"],
    skills: ["bank-charge-invoice-discovery"],
    profiles: [{ id: "card", name: "Land bank and card charges" }],
  },
  {
    slug: "books",
    name: "Books Agent",
    room: "intake",
    role: "Provides the company's accounting records: the general ledger, vendor and customer records, purchase orders, and period-close information.",
    example: "When another agent needs the authorized purchase order or a ledger cash entry, the Books Agent supplies the official record.",
    inputs: "ERP and accounting-system records (ledger, vendors, customers, purchase orders, period lock).",
    outputs: "Read-only accounting records other agents can rely on.",
    passesTo: "Hands new bills to payables, open customer invoices to collections, and period-lock state to month-end close. It does not close the period itself.",
    responsibilities: [
      "Serve the official books to every other agent",
      "Surface purchase orders, vendors, customers, and lock state",
    ],
    workflows: ["Accounting records", "Purchase orders"],
    skills: ["invoice-source-identification"],
    profiles: [
      { id: "erp-invoice", name: "Read an invoice from the accounting system" },
      { id: "procurement", name: "Read a purchasing-system bill" },
      { id: "edi", name: "Read an electronic invoice" },
    ],
  },
  {
    slug: "ap",
    name: "Accounts Payable Agent",
    room: "pay",
    role: "Checks vendor bills before they are paid. It compares invoices with purchase orders and proof that goods or services were received, detects duplicates, and identifies exceptions.",
    example: "A clean Acme invoice that matches its purchase order and receiving record is approved. A second copy of the same Northline bill is held as a duplicate.",
    inputs: "Vendor invoices, purchase orders, delivery records, and prior vendor decisions.",
    outputs: "Approve or hold decisions, exception reasons, and links to later payment records.",
    passesTo: "Approved-looking bills go to Payables Control. Payable bills go to the Payments Agent. Unreceived goods can be sent to month-end close. This agent does not release cash.",
    responsibilities: [
      "Compare each bill with the purchase order and receiving record",
      "Detect duplicate bills",
      "Investigate exceptions using earlier-period decisions",
    ],
    workflows: ["Accounts payable", "Three-way match"],
    skills: ["three-way-match-analysis", "ap-exception-investigation", "prior-period-precedent", "superseded-document-handling"],
    profiles: [
      { id: "prepare", name: "Check a new vendor bill" },
      { id: "investigate", name: "Investigate a problem bill" },
    ],
  },
  {
    slug: "pay",
    name: "Payments Agent",
    room: "pay",
    role: "Builds the proposed vendor-payment schedule from bills that have already passed Maximor's payable checks.",
    example: "Once invoices are approved, this agent decides which bills belong in this week's payment run based on due dates, cash, and discounts — it does not move money on its own.",
    inputs: "The approved bill pool, cash position, and treasury policies.",
    outputs: "A draft weekly payment plan.",
    passesTo: "Sends the draft plan to Payables Control before any cash would be released. After a run, wires go to cash reconciliation.",
    responsibilities: [
      "Draft the weekly vendor payment run",
      "Respect cash reserves and early-pay discounts",
    ],
    workflows: ["Vendor payment scheduling"],
    skills: ["payment-prioritization", "early-payment-discount-evaluation"],
    profiles: [{ id: "schedule", name: "Draft this week's vendor payments" }],
  },
  {
    slug: "apply",
    name: "Cash Application Agent",
    room: "cash",
    role: "Matches incoming customer payments to the customer invoices those payments settle.",
    example: "If Lumen Labs sends $5,000 labeled only 'September billing,' this agent tries to determine which Lumen invoices that money belongs to — and leaves it unmatched when the evidence is not strong enough.",
    inputs: "Customer payments, remittance text, open invoices, and prior cash-application precedents.",
    outputs: "Applied, partially applied, or unmatched payment decisions.",
    passesTo: "Hands uncertain applications to Cash Control. Identified deposits also go to cash reconciliation. Remaining unpaid invoices go to collections.",
    responsibilities: [
      "Stick customer payments to the right invoices",
      "Refuse to guess when the remittance is ambiguous",
    ],
    workflows: ["Cash application"],
    skills: ["cash-application"],
    profiles: [{ id: "apply", name: "Match customer payments to invoices" }],
  },
  {
    slug: "collect",
    name: "Collections Agent",
    room: "cash",
    role: "Tracks unpaid customer invoices and identifies overdue balances that need collection follow-up.",
    example: "It looks at invoice aging and decides which customers are late enough to chase, after cash application has already applied any incoming payments.",
    inputs: "Open customer invoices, aging, payment history, and collection policy.",
    outputs: "Follow-up recommendations for overdue customers.",
    passesTo: "If new deposits are still sitting unmatched, it sends them back to cash application. Write-off or reserve proposals go to Payables Control.",
    responsibilities: [
      "Watch unpaid customer invoices after payments have been applied",
      "Flag balances that are far overdue",
    ],
    workflows: ["Collections", "Accounts receivable aging"],
    skills: ["ar-collections-policy"],
    profiles: [{ id: "chase", name: "Follow unpaid customer invoices" }],
  },
  {
    slug: "cash",
    name: "Cash Reconciliation Agent",
    room: "cash",
    role: "Matches bank activity to accounting records and explains differences such as grouped payments, bank fees, and unresolved discrepancies.",
    example: "It matches a $30,000 bank withdrawal to three vendor invoices, nets a wire against its bank fee, and leaves the $12.40 Northstar difference unresolved when no evidence exists.",
    inputs: "Bank transactions, ledger cash entries, fee evidence, and Stripe payout explanations.",
    outputs: "Match decisions, explained exceptions, and unresolved differences.",
    passesTo: "Sends material reconciling items to Cash Control. Trusted cash status is handed to month-end close. Unresolved cash differences block close.",
    responsibilities: [
      "Match bank activity to ledger cash",
      "Explain grouped payments and bank fees",
      "Leave unexplained differences unresolved instead of inventing a story",
    ],
    workflows: ["Bank reconciliation"],
    skills: [
      "cash-reconciliation-method-selection",
      "bank-reference-interpretation",
      "reconciliation-exception-investigation",
      "prior-period-precedent",
      "reconciliation-evidence-validation",
    ],
    profiles: [
      { id: "match", name: "Match bank activity to the books" },
      { id: "investigate", name: "Investigate a bank difference" },
    ],
  },
  {
    slug: "close",
    name: "Month-End Close Agent",
    room: "books-close",
    role: "Coordinates the work needed to finish a month's books, including accruals, prepaids, fixed assets, reconciliations, and final close checks.",
    example: "When Harbor Electric's September bill has not arrived, this agent estimates the electricity expense so September still includes the cost.",
    inputs: "Close checklist, vendor history, contracts, prepaid schedules, asset records, and cash status.",
    outputs: "Accruals, prepaid treatments, depreciation, close-task status, and journal entries.",
    passesTo: "Hands each treatment and the period lock to Books Control. After the pack is ready, it wakes reporting and independent audit. It does not mark the month closed on its own.",
    responsibilities: [
      "Estimate expenses that belong in the month before the bill arrives",
      "Spread prepaid costs and depreciate assets",
      "Coordinate the close checklist without forcing a close",
    ],
    workflows: ["Month-end close", "Accruals", "Prepaid expenses", "Fixed assets"],
    skills: [
      "accrual-evidence-evaluation",
      "accrual-method-selection",
      "prepaid-expense-accounting",
      "fixed-asset-depreciation",
      "balance-sheet-reconciliation",
      "month-end-close-coordination",
      "prior-period-precedent",
    ],
    profiles: [
      { id: "coordinate", name: "Coordinate finishing the month" },
      { id: "accrue", name: "Estimate expenses before the bill arrives" },
      { id: "prepaid", name: "Spread prepaid costs across months" },
      { id: "assets", name: "Record equipment as an asset" },
      { id: "bs", name: "Check that balance-sheet accounts agree" },
    ],
  },
  {
    slug: "story",
    name: "Reporting Agent",
    room: "books-close",
    role: "Explains what changed in the company's cash and results. It builds the 13-week cash forecast, variance analysis, and board-facing financial narrative.",
    example: "It projects weekly ending cash from expected customer collections, vendor payments, and payroll, then explains why this month's margin moved.",
    inputs: "Ledger actuals, forecast assumptions, collections timing, and payment schedules.",
    outputs: "13-week cash forecast, variance explanations, and board metrics tied to the books.",
    passesTo: "Reads close and cash results. It does not move money or own the books. Independent audit later samples the pack.",
    responsibilities: [
      "Explain why results changed",
      "Project cash for the next 13 weeks",
      "Prepare board figures that tie to the ledger",
    ],
    workflows: ["13-week cash forecast", "Variance analysis", "Board reporting"],
    skills: [
      "financial-variance-analysis",
      "cash-forecasting",
      "ar-cash-forecasting",
      "forecast-vs-actual-interpretation",
      "board-financial-reporting",
    ],
    profiles: [
      { id: "flux", name: "Explain why results changed" },
      { id: "forecast", name: "Project cash for the next 13 weeks" },
      { id: "forecast-miss", name: "Explain why the cash forecast missed" },
      { id: "board", name: "Prepare board-facing financial figures" },
    ],
  },
  {
    slug: "ctl-pay",
    name: "Payables Control Agent",
    room: "pay",
    role: "Independently checks accounts-payable match decisions and proposed payment plans before they become final. It looks for reasons to refuse, not reasons to wave things through.",
    example: "If payables approved a bill, this agent re-checks the invoice, purchase order, and receiving record and only concurs when the packet is complete.",
    inputs: "AP match packets, payment-run drafts, and company policy.",
    outputs: "Concurrence or refusal on match and payment-plan decisions.",
    passesTo: "Returns a verified decision to the Accounts Payable and Payments agents. Uncertain cases stay with this control agent — they are not sent to a person.",
    responsibilities: [
      "Recheck bill-match packets before they count as approved",
      "Recheck payment-run drafts before cash would be released",
      "Review write-off proposals from collections",
    ],
    workflows: ["Payables control", "Payment audit"],
    skills: [
      "three-way-match-analysis",
      "ap-exception-investigation",
      "payment-prioritization",
      "early-payment-discount-evaluation",
      "prior-period-precedent",
    ],
    profiles: [
      { id: "review-match", name: "Recheck a bill before it is treated as approved" },
      { id: "review-pay", name: "Recheck a payment plan before cash would be released" },
    ],
  },
  {
    slug: "ctl-cash",
    name: "Cash Control Agent",
    room: "cash",
    role: "Independently checks cash-application and bank-reconciliation decisions before they are accepted as complete.",
    example: "If cash reconciliation claims a fee-netted match, this agent verifies the bank line, ledger entries, and fee evidence before concurring.",
    inputs: "Cash-application packets and bank-reconciliation proposals.",
    outputs: "Concurrence or refusal on cash matches.",
    passesTo: "Returns verified cash decisions to the Cash Application and Cash Reconciliation agents.",
    responsibilities: [
      "Recheck uncertain customer-payment matches",
      "Recheck bank-reconciliation sign-off",
    ],
    workflows: ["Cash control"],
    skills: [
      "cash-application",
      "cash-reconciliation-method-selection",
      "reconciliation-exception-investigation",
      "bank-reference-interpretation",
      "prior-period-precedent",
      "reconciliation-evidence-validation",
    ],
    profiles: [
      { id: "review-apply", name: "Recheck an uncertain customer-payment match" },
      { id: "review-rec", name: "Recheck a bank reconciliation" },
    ],
  },
  {
    slug: "ctl-books",
    name: "Books Control Agent",
    room: "books-close",
    role: "Independently checks month-end accounting treatments and whether the period is actually ready to lock.",
    example: "It reviews the Harbor Electric accrual, prepaid amortization, asset depreciation, and balance-sheet recs, and will not lock the month while cash is still unresolved.",
    inputs: "Accrual, prepaid, asset, and balance-sheet packets plus close-gate results.",
    outputs: "Concurrence on treatments and the period lock.",
    passesTo: "Returns verified close treatments to the Month-End Close Agent.",
    responsibilities: [
      "Recheck prepaid, asset, and balance-sheet treatments",
      "Refuse the period lock while close gates still fail",
    ],
    workflows: ["Close review", "Period lock"],
    skills: [
      "prepaid-expense-accounting",
      "fixed-asset-depreciation",
      "balance-sheet-reconciliation",
      "month-end-close-review",
      "prior-period-precedent",
    ],
    profiles: [
      { id: "review-treatment", name: "Recheck prepaid accounting" },
      { id: "review-assets", name: "Recheck asset accounting" },
      { id: "review-bs", name: "Recheck balance-sheet recs" },
      { id: "lock", name: "Decide whether the month is actually ready to lock" },
    ],
  },
  {
    slug: "audit",
    name: "Audit Agent",
    room: "books-close",
    role: "Independently inspects transactions and accounting records for signs that company controls were broken or records do not agree. It does not operate the books.",
    example: "It flags an invoice that the same user requested and approved, two bills that look like the same vendor invoice, and round-number payments that need extra testing.",
    inputs: "Invoices, payments, journals, vendors, and approval records sampled after the fact.",
    outputs: "Control findings with source evidence.",
    passesTo: "Reports independently. It does not fix or re-post the books, and it does not approve payments.",
    responsibilities: [
      "Sample the books after operations have recorded them",
      "Retest whether company controls were followed",
      "Write findings with source evidence",
    ],
    workflows: ["Independent audit", "Control testing"],
    skills: [
      "audit-sampling-interpretation",
      "control-testing-interpretation",
      "reconciliation-reperformance-review",
      "segregation-of-duties-interpretation",
      "audit-finding-writing",
    ],
    profiles: [
      { id: "interpret", name: "Sample the books after the fact" },
      { id: "report", name: "Write findings" },
    ],
  },
];

export const AGENT_COPY: Record<
  string,
  { name: string; role: string; example: string; inputs: string; outputs: string; passesTo: string }
> = Object.fromEntries(
  AGENTS.map((agent) => [
    agent.slug,
    {
      name: agent.name,
      role: agent.role,
      example: agent.example,
      inputs: agent.inputs,
      outputs: agent.outputs,
      passesTo: agent.passesTo,
    },
  ])
);

export const AGENTS_BY_SLUG = Object.fromEntries(AGENTS.map((agent) => [agent.slug, agent])) as Record<AgentSlug, AgentDef>;

export const ROUTINES = [
  { id: "weekly-pay-run", bot: "pay" as AgentSlug, cadence: "weekly", title: "Weekly vendor payment draft" },
  { id: "daily-aging", bot: "collect" as AgentSlug, cadence: "daily", title: "Daily unpaid-invoice review" },
  { id: "month-end", bot: "close" as AgentSlug, cadence: "monthly", title: "Month-end completeness" },
  { id: "period-story", bot: "story" as AgentSlug, cadence: "monthly", title: "Month-end story and cash forecast" },
  { id: "post-close-assurance", bot: "audit" as AgentSlug, cadence: "monthly", title: "After-the-fact audit sampling" },
];

export function agentName(slug: string): string {
  return AGENTS_BY_SLUG[slug as AgentSlug]?.name || slug;
}

export function skillLabel(slug: string): string {
  if (SKILL_COPY[slug]) return SKILL_COPY[slug];
  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
