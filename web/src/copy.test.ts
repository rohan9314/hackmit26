import { describe, expect, test } from "vitest";
import {
  AGENT_COPY,
  AGING_COPY,
  EVAL_CASE_COPY,
  GRAIN_SLUGS,
  MATCH_TYPE_COPY,
  METHOD_COPY,
  STATUS_COPY,
  formatAccountingMethod,
  formatAccountingSentence,
  formatAgingBucket,
  formatAgent,
  formatEvalCase,
  formatException,
  formatFamily,
  formatHandoff,
  formatMatchType,
  formatPeriod,
  formatRecordId,
  formatCadence,
  formatDateTime,
  formatConfidence,
  formatStatus,
  formatSummary,
  formatTask,
  humanizeToken,
} from "./copy";

const REQUIRED_STATUSES = [
  "HUMAN_REVIEW",
  "NEEDS_REVIEW",
  "BLOCKED",
  "EXPLAINED_EXCEPTION",
  "AUTO_APPLY",
  "UNAPPLIED",
];

const REQUIRED_MATCHES = [
  "UNEXPLAINED_DIFFERENCE",
  "PROVIDER_PAYOUT",
  "GROUPED_MATCH",
  "FEE_NETTED",
  "EXACT_MATCH",
];

test("formatStatus never returns HUMAN_REVIEW as primary copy", () => {
  for (const key of REQUIRED_STATUSES) {
    const label = formatStatus(key);
    expect(label).toBeTruthy();
    expect(label).not.toMatch(/HUMAN_REVIEW/i);
    expect(label).not.toBe(key);
  }
});

test("match types and methods have sentence-level labels", () => {
  for (const key of REQUIRED_MATCHES) {
    expect(formatMatchType(key)).not.toBe(key);
  }
  expect(formatMatchType("UNEXPLAINED_DIFFERENCE")).toMatch(/unresolved difference/i);
  expect(formatMatchType("PROVIDER_PAYOUT")).toMatch(/stripe payout/i);
  expect(formatMatchType("GROUPED_MATCH")).toMatch(/multiple/i);
  expect(formatMatchType("FEE_NETTED")).toMatch(/fee/i);
  expect(formatMatchType("EXACT_MATCH")).toMatch(/exact/i);
  expect(formatAccountingMethod("SEASONAL_PRIOR_YEAR")).toMatch(/season/i);
  expect(formatAccountingMethod("seasonal_prior_year")).toMatch(/season/i);
});

test("unknown enums fall back to readable words", () => {
  expect(formatStatus("SOME_NEW_ENUM")).toBe("Some New Enum");
  expect(humanizeToken("memory.cross_period")).toBe("Memory Cross Period");
  expect(formatMatchType("BRAND_NEW_MATCH")).toBe("Brand New Match");
  expect(formatStatus("INV-AR-013")).toBe("INV-AR-013");
  expect(formatStatus("HI-HE-2026-08")).toBe("HI-HE-2026-08");
});

test("aging buckets are explained in days overdue", () => {
  expect(formatAgingBucket("CURRENT")).toMatch(/not overdue/i);
  expect(formatAgingBucket("1-30")).toMatch(/1–30/);
  expect(formatAgingBucket("90+")).toMatch(/90/);
  expect(Object.keys(AGING_COPY).sort()).toEqual(["1-30", "31-60", "61-90", "90+", "CURRENT"].sort());
});

test("close tasks use finance names, not TASK ids", () => {
  expect(formatTask("TASK-CASH")).toMatch(/cash/i);
  expect(formatTask("TASK-AP")).toMatch(/payable/i);
  expect(formatTask("TASK-ACCRUAL")).toMatch(/accrued/i);
});

test("all 15 agents have judge-facing descriptions", () => {
  expect(GRAIN_SLUGS).toHaveLength(15);
  for (const slug of GRAIN_SLUGS) {
    const row = AGENT_COPY[slug];
    expect(row.name).toBeTruthy();
    expect(row.role.length).toBeGreaterThan(40);
    expect(row.example.length).toBeGreaterThan(20);
    expect(row.inputs.length).toBeGreaterThan(10);
    expect(row.outputs.length).toBeGreaterThan(10);
    expect(row.passesTo.length).toBeGreaterThan(10);
    expect(formatAgent(slug)).toBe(row.name);
  }
});

test("evaluation cases lead with English titles", () => {
  expect(formatEvalCase("AC-CASH-RECON-1240").title).toMatch(/12\.40/);
  expect(formatEvalCase("AC-EMAIL-QUOTE").title.toLowerCase()).not.toBe("ac-email-quote");
  expect(Object.keys(EVAL_CASE_COPY).length).toBeGreaterThanOrEqual(20);
});

test("known enum tables stay internally keyed", () => {
  expect(STATUS_COPY.HUMAN_REVIEW).toMatch(/unresolved/i);
  expect(MATCH_TYPE_COPY.UNEXPLAINED_DIFFERENCE).toBeTruthy();
  expect(METHOD_COPY.seasonal_prior_year).toBeTruthy();
});

test("legacy agent display names map to job titles", () => {
  expect(formatAgent("AP Preparer")).toBe("Accounts Payable Agent");
  expect(formatAgent("ctl-pay")).toBe("Payables Control Agent");
  expect(formatAgent("bot_ap")).toBe("Accounts Payable Agent");
});

test("exceptions and methods become sentences", () => {
  expect(formatException("three_way_match_failed")).toMatch(/purchase order/i);
  expect(formatException("exception_duplicate_candidate")).toMatch(/duplicate/i);
  expect(formatException("partial_receipt")).toMatch(/received so far/i);
  expect(formatStatus("approved_pool")).toMatch(/this week's payments/i);
  expect(formatAccountingSentence("seasonal_prior_year")).toMatch(/seasonal pattern from last year/i);
  expect(formatFamily("anti_hack")).toMatch(/same-dollar/i);
  expect(formatPeriod("2026-09")).toBe("September 2026");
});

test("summaries and handoffs stay in English", () => {
  expect(formatSummary("Close BLOCKED")).toMatch(/cannot finish/i);
  expect(formatSummary("classified as quote")).toMatch(/identified as/i);
  expect(formatSummary("Python evidence")).toMatch(/supporting records/i);
  expect(formatSummary("The PAY-004 customer payment was human review")).toMatch(/could not be matched/i);
  expect(formatSummary("The PAY-004 customer payment was human review")).not.toMatch(/human review/i);
  expect(formatHandoff(["ap", "ctl-pay"], "ap")).toMatch(/Accounts Payable Agent/);
  expect(formatHandoff(["ap", "ctl-pay"], "ap")).toMatch(/Payables Control/);
  expect(formatHandoff(["ap", "ctl-pay"], "ap")).not.toMatch(/AP_AGENT/);
  expect(formatSummary("used seasonal_prior_year (4,650.00)")).toMatch(/last year's seasonal pattern/i);
  expect(formatSummary("used usage_run_rate (11,849.90)")).not.toMatch(/usage_run_rate/);
});

test("record ids and dates are labeled without changing formatStatus", () => {
  expect(formatStatus("INV-AR-013")).toBe("INV-AR-013");
  expect(formatStatus("HI-HE-2026-08")).toBe("HI-HE-2026-08");
  expect(formatRecordId("INV-AR-013")).toMatch(/customer invoice/i);
  expect(formatRecordId("INV-003")).toMatch(/vendor invoice/i);
  expect(formatRecordId("PAY-004")).toMatch(/payment/i);
  expect(formatRecordId("TXN-2026-09-015")).toMatch(/bank transaction/i);
  expect(formatRecordId("TASK-CASH")).toMatch(/cash/i);
  expect(formatRecordId("po_1MaximorFees")).toMatch(/stripe payout/i);
  expect(formatRecordId("BANK-po_1MaximorFees")).toMatch(/bank deposit/i);
  expect(formatCadence("weekly")).toMatch(/week/i);
  expect(formatDateTime("2026-09-15")).toMatch(/September/);
  expect(formatConfidence(0.72)).toBe("72%");
  expect(formatException("qty_mismatch")).toMatch(/quantity/i);
});
