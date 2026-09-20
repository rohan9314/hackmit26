function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorMessage(payload: any, fallback: string): string {
  const detail = payload?.detail || payload?.error?.message || payload?.error || fallback;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => (typeof item === "string" ? item : item?.msg || JSON.stringify(item)))
      .join("; ");
  }
  return typeof detail === "object" ? JSON.stringify(detail) : String(detail || fallback);
}

export type RunSource = "live" | "saved";

const HEALTH_TTL_MS = 8000;
const REQUEST_TIMEOUT_MS = 8000;
type HealthListener = (live: boolean) => void;

let healthState: { live: boolean; checkedAt: number } = { live: false, checkedAt: 0 };
let healthInflight: Promise<boolean> | null = null;
let lastSource: RunSource = "live";
const healthListeners = new Set<HealthListener>();

function setHealth(live: boolean) {
  healthState = { live, checkedAt: Date.now() };
  healthListeners.forEach((listener) => listener(live));
}

export function subscribeHealth(listener: HealthListener) {
  healthListeners.add(listener);
  listener(healthState.live);
  return () => {
    healthListeners.delete(listener);
  };
}

export function markApiReachable(live: boolean) {
  setHealth(live);
}

/** Current Maximor demo API paths. Pages must not hardcode these strings. */
export const API_PATHS = {
  health: "/api/health",
  healthRoot: "/health",
  demoStatus: "/api/demo/status",
  demoOverview: "/api/demo/overview",
  demoCompanyState: "/api/demo/company-state",
  demoReset: "/api/demo/reset",
  inbox: "/api/inbox",
  invoices: "/api/invoices",
  ar: "/api/ar",
  cash: "/api/cash",
  stripe: "/api/stripe",
  close: "/api/close",
  forecast: "/api/forecast",
  audit: "/api/audit",
  memory: "/api/memory",
  agents: "/api/agents",
  evaluations: "/api/evaluations",
  gauntlet: "/api/gauntlet",
  scenarios: "/api/scenarios",
  architecture: "/api/architecture",
  invoiceIngestion: "/api/workflows/invoice-ingestion",
  sortInbox: "/api/workflows/inbox",
  accountsPayable: "/api/workflows/ap",
  schedule: "/api/workflows/schedule",
  arAging: "/api/workflows/ar-aging",
  arCollections: "/api/workflows/ar-collections",
  arCashApply: "/api/workflows/ar-cash-apply",
  bankReconciliation: "/api/workflows/bank-reconciliation",
  stripeReconciliation: "/api/workflows/stripe-reconciliation",
  closeWorkflow: "/api/workflows/close",
  accrual: "/api/workflows/accrual",
  forecastWorkflow: "/api/workflows/forecast",
  auditWorkflow: "/api/workflows/audit",
  memoryWorkflow: "/api/workflows/memory",
  memoryEval: "/api/workflows/memory-eval",
  cfoCycle: "/api/workflows/cfo-cycle",
  evaluate: "/api/workflows/evaluate",
  gauntletWorkflow: "/api/workflows/gauntlet",
} as const;

/** Removed 43-agent / pre-migration paths that must not appear in the frontend. */
export const STALE_API_PATHS = [
  "/api/workflows/identify-document",
  "/api/workflows/document-identification",
  "/api/workflows/sort-inbox",
  "/api/workflows/three-way-match",
  "/api/workflows/ap-preparer",
  "/api/workflows/finance-inbox",
  "/demo/inbox",
  "/demo/ap",
  "/demo/workflows",
  "/api/agents/email/identify",
  "/api/v1/workflows/ap",
] as const;

export function inboxSamplePath(sampleId: string): string {
  return `${API_PATHS.inbox}/${encodeURIComponent(sampleId)}`;
}

export function invoicePath(invoiceId: string): string {
  return `${API_PATHS.invoices}/${encodeURIComponent(invoiceId)}`;
}

export function accountsPayablePath(invoiceId: string): string {
  return `${API_PATHS.accountsPayable}/${encodeURIComponent(invoiceId)}`;
}

export function scenarioPath(scenarioId: string): string {
  return `/api/workflows/scenario/${encodeURIComponent(scenarioId)}`;
}

export function storyPath(name: string): string {
  return `/api/stories/${encodeURIComponent(name)}`;
}

export function lineagePath(recordId: string): string {
  return `/api/lineage/${encodeURIComponent(recordId)}`;
}

export function apiOrigin(): string {
  const env = (import.meta as { env?: { VITE_API_BASE?: string } }).env?.VITE_API_BASE;
  if (env) return String(env).replace(/\/$/, "");
  // Same-origin in Vite/dev and when the API serves the SPA. Vite proxies /api and /health.
  return "";
}

export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${apiOrigin()}${path}`;
}

export function lastRunSource(): RunSource {
  return lastSource;
}

export function isApiLive(): boolean {
  return healthState.live;
}

export function markRunSource(source: RunSource) {
  lastSource = source;
}

export function resetHealthCache() {
  healthState = { live: false, checkedAt: 0 };
  healthInflight = null;
}

export function isUnreachableError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const status = (err as Error & { status?: number }).status;
  return (
    err.message === "Failed to fetch" ||
    err.message === "Demo API unavailable" ||
    err.message === "The demo API did not respond. If it was restarting, run this again." ||
    err.name === "TypeError" ||
    err.name === "AbortError" ||
    status === 502 ||
    status === 503 ||
    status === 504
  );
}

export function isMissingRouteError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const status = (err as Error & { status?: number }).status;
  return (
    status === 404 ||
    status === 405 ||
    err.message === "Not Found" ||
    /unknown api route/i.test(err.message) ||
    /did not match a route/i.test(err.message) ||
    /method not allowed/i.test(err.message)
  );
}

export async function checkHealth(): Promise<boolean> {
  if (healthState.checkedAt && Date.now() - healthState.checkedAt < HEALTH_TTL_MS) {
    return healthState.live;
  }
  if (healthInflight) return healthInflight;
  healthInflight = (async () => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2500);
      const response = await fetch(apiUrl(API_PATHS.health), { signal: controller.signal });
      clearTimeout(timer);
      const payload = await response.json().catch(() => ({}));
      setHealth(Boolean(response.ok && (payload as { ok?: boolean })?.ok));
    } catch {
      setHealth(false);
    } finally {
      healthInflight = null;
    }
    return healthState.live;
  })();
  return healthInflight;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let lastError: Error | null = null;
  const url = apiUrl(path);
  const method = String(init?.method || "GET").toUpperCase();
  const mutating = method !== "GET" && method !== "HEAD";
  for (let attempt = 0; attempt < 3; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
        ...init,
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const err = new Error(errorMessage(payload, response.statusText));
        (err as Error & { status?: number }).status = response.status;
        const retryGateway = !mutating && [502, 503, 504].includes(response.status) && attempt < 2;
        if (retryGateway) {
          lastError = err;
          await sleep(400 * (attempt + 1));
          continue;
        }
        throw err;
      }
      lastSource = "live";
      setHealth(true);
      return payload as T;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if ((lastError as Error & { status?: number }).status) throw lastError;
      const retryable =
        lastError.name !== "AbortError" &&
        (lastError.message === "Failed to fetch" || lastError.name === "TypeError");
      if (attempt < 2 && retryable) {
        await sleep(400 * (attempt + 1));
        continue;
      }
      throw lastError;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError || new Error("Request failed");
}

export const get = <T,>(path: string) => api<T>(path);

export const post = <T,>(path: string, body?: unknown) =>
  api<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) });

export function usd(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return Number(value).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function statusTone(status: string | undefined): string {
  const value = (status || "").toLowerCase();
  if (["closed", "matched", "approve", "completed", "pass", "tied", "clear", "paid"].some((item) => value.includes(item))) {
    return "ok";
  }
  if (["blocked", "hold", "fail", "unexplained", "exception", "human_review", "cannot", "duplicate"].some((item) => value.includes(item))) {
    return "bad";
  }
  if (["review", "running", "open", "ready"].some((item) => value.includes(item))) {
    return "warn";
  }
  return "neutral";
}
