import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import App from "./App";
import { API_PATHS, STALE_API_PATHS, apiOrigin, apiUrl, checkHealth, resetHealthCache } from "./api";
import { demoApi } from "./demoClient";
import { INBOX_DOCUMENTS } from "./data/inboxDocuments";

const SRC = dirname(fileURLToPath(import.meta.url));

const fetchMock = vi.fn();

beforeEach(() => {
  resetHealthCache();
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => ({
    ok: false,
    status: 404,
    statusText: "Not Found",
    json: async () => ({ detail: "Not Found" }),
  }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test("demo client named functions cover the office workflows", () => {
  for (const name of [
    "identifyDocument",
    "sortInbox",
    "runAccountsPayable",
    "runAccountsReceivable",
    "runCashReconciliation",
    "runClose",
    "runForecast",
    "runAudit",
    "runMemory",
    "runStripeReconciliation",
    "runCfoCycle",
  ] as const) {
    expect(typeof demoApi[name]).toBe("function");
  }
});

test("vite-dev API origin does not double-prefix /api", () => {
  expect(apiUrl(API_PATHS.inbox)).toBe("/api/inbox");
  expect(apiUrl(API_PATHS.health)).toBe("/api/health");
  expect(apiUrl(API_PATHS.inbox)).not.toContain("/api/api/");
  expect(apiUrl(API_PATHS.inbox)).not.toMatch(/:8765/);
  expect(apiOrigin()).toBe("");
  expect(API_PATHS.health).toBe("/api/health");
});

test("health checks are cached briefly instead of firing on every call", async () => {
  fetchMock.mockImplementation(async (url: string) => ({
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => (String(url).includes("health") ? { ok: true } : {}),
  }));
  await checkHealth();
  await checkHealth();
  const healthCalls = fetchMock.mock.calls.filter((call) => String(call[0]).includes("/api/health"));
  expect(healthCalls.length).toBe(1);
});

test("concurrent health checks share one in-flight request", async () => {
  fetchMock.mockImplementation(async (url: string) => {
    await new Promise((resolve) => setTimeout(resolve, 30));
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => (String(url).includes("health") ? { ok: true } : {}),
    };
  });
  await Promise.all([checkHealth(), checkHealth(), checkHealth()]);
  const healthCalls = fetchMock.mock.calls.filter((call) => String(call[0]).includes("/api/health"));
  expect(healthCalls.length).toBe(1);
});

test("inbox still shows documents when the demo API 404s", async () => {
  render(
    <MemoryRouter initialEntries={["/inbox"]}>
      <App />
    </MemoryRouter>
  );
  expect((await screen.findAllByText(/August warehouse supplies invoice/i)).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/Quote for office renovation/i).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/Purchase order for 40 monitors/i).length).toBeGreaterThan(0);
  expect(screen.queryByText(/invoice_bad_03/i)).not.toBeInTheDocument();
});

test("a live 404 falls back to the saved demonstration result", async () => {
  const payload = await demoApi.identifyDocument("MSG-E-QUOTE");
  expect(payload._source).toBe("saved");
  expect(payload.result.classification).not.toBe("invoice");
  expect(String(payload.result.what_changed)).toMatch(/quote/i);
});

test("unreachable API falls back to a saved demonstration result", async () => {
  fetchMock.mockImplementation(async () => {
    throw new TypeError("Failed to fetch");
  });
  const payload = await demoApi.identifyDocument("MSG-E-QUOTE");
  expect(payload._source).toBe("saved");
  expect(payload.result.classification).not.toBe("invoice");
  expect(String(payload.result.what_changed)).toMatch(/quote/i);
});

test("an aborted API request falls back instead of hanging on live", async () => {
  fetchMock.mockImplementation(async () => {
    const err = new Error("The user aborted a request.");
    err.name = "AbortError";
    throw err;
  });
  const payload = await demoApi.identifyDocument("MSG-E-QUOTE");
  expect(payload._source).toBe("saved");
  const api = readFileSync(join(SRC, "api.ts"), "utf8");
  expect(api).toMatch(/REQUEST_TIMEOUT_MS = 8000/);
  expect(api).toContain("controller.abort()");
  expect(api).toMatch(/lastError\.name !== "AbortError"/);
});

test("sort inbox fallback groups the curated documents when the API is unreachable", async () => {
  fetchMock.mockImplementation(async () => {
    throw new TypeError("Failed to fetch");
  });
  const payload = await demoApi.sortInbox();
  const ids = payload.result.groups.map((group: { id: string }) => group.id);
  expect(ids).toEqual(expect.arrayContaining(["bills_to_process", "do_not_book", "needs_investigation"]));
  expect(INBOX_DOCUMENTS).toHaveLength(8);
});

test("identify on a 404 API shows the saved result, not a route-mismatch error", async () => {
  render(
    <MemoryRouter initialEntries={["/inbox"]}>
      <App />
    </MemoryRouter>
  );
  fireEvent.click(await screen.findByRole("button", { name: /Identify this document/i }));
  expect((await screen.findAllByText(/Saved demo result/i)).length).toBeGreaterThan(0);
  expect(screen.queryByText(/did not match a route/i)).not.toBeInTheDocument();
  expect(screen.getByText(/added it to accounts payable/i)).toBeInTheDocument();
});

test("sort inbox on a 404 API groups the curated documents", async () => {
  render(
    <MemoryRouter initialEntries={["/inbox"]}>
      <App />
    </MemoryRouter>
  );
  fireEvent.click(await screen.findByRole("button", { name: /Sort the inbox/i }));
  expect(await screen.findByText(/Inbox sort/i)).toBeInTheDocument();
  expect(screen.getByText(/No ledgers were rewritten/i)).toBeInTheDocument();
  expect(screen.queryByText(/did not match a route/i)).not.toBeInTheDocument();
});

test("pages do not scatter stale 43-agent API paths", () => {
  const pages =
    readFileSync(join(SRC, "pages", "Inbox.tsx"), "utf8") +
    readFileSync(join(SRC, "pages", "AP.tsx"), "utf8") +
    readFileSync(join(SRC, "pages", "AR.tsx"), "utf8") +
    readFileSync(join(SRC, "layout", "Shell.tsx"), "utf8");
  for (const stale of STALE_API_PATHS) {
    expect(pages).not.toContain(stale);
  }
  expect(pages).not.toMatch(/["'`]\/api\/workflows\//);
});

test("saved Harbor September estimate matches the live 4650 accrual", () => {
  const saved = readFileSync(join(SRC, "data", "savedDemo.ts"), "utf8");
  expect(saved).toMatch(/estimated at \$4,650/);
  expect(saved).toMatch(/final_amount: 4650/);
  expect(saved).toMatch(/amount: 4650/);
  expect(saved).toMatch(/estimated \$7,800 using last year's seasonal pattern/);
  expect(saved).toMatch(/amount: 7800/);
});

test("payables register does not repeat the Invoice heading in the match trio", () => {
  const ap = readFileSync(join(SRC, "pages", "AP.tsx"), "utf8");
  expect(ap).toMatch(/Amount on the bill/);
  expect(ap.match(/<h2>Invoice<\/h2>/g)?.length).toBe(1);
});

test("stripe waterfall subtracts unsigned fee and refund amounts", () => {
  const stripe = readFileSync(join(SRC, "pages", "StripePage.tsx"), "utf8");
  expect(stripe).toMatch(/Math\.abs\(Number\(bd\.fees/);
  expect(stripe).toMatch(/Math\.abs\(Number\(bd\.refunds/);
  expect(stripe).toMatch(/Math\.abs\(Number\(bd\.chargebacks/);
});

test("inbox identify can fill vendor and amount from the selected letter", () => {
  const inbox = readFileSync(join(SRC, "pages", "Inbox.tsx"), "utf8");
  expect(inbox).toContain("displayExtracted");
  expect(inbox).toContain("Quoted amount");
  expect(inbox).toContain("Quote number");
});

test("supporting-record chips rename Stripe fixture payout ids", () => {
  const explain = readFileSync(join(SRC, "components", "Explain.tsx"), "utf8");
  expect(explain).toContain("Stripe payout with processing fees");
  expect(explain).toContain("friendlyRecordId");
});

test("stripe provenance links do not show fixture payout ids", () => {
  const demo = readFileSync(join(SRC, "components", "Demo.tsx"), "utf8");
  expect(demo).toContain("provenanceLabel");
  expect(demo).toContain("Stripe payout to the bank");
});

test("artifact lists keep a fallback React key when artifact_id is missing", () => {
  const files = ["pages/StripePage.tsx", "pages/Forecast.tsx", "pages/Cash.tsx", "pages/Close.tsx", "pages/AP.tsx"];
  for (const file of files) {
    const src = readFileSync(join(SRC, file), "utf8");
    expect(src).toMatch(/artifact_id \|\| item\.title \|\| idx/);
  }
});
