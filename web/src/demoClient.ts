import {
  API_PATHS,
  accountsPayablePath,
  checkHealth,
  get,
  inboxSamplePath,
  invoicePath,
  isApiLive,
  isMissingRouteError,
  isUnreachableError,
  lineagePath,
  markApiReachable,
  markRunSource,
  post,
  scenarioPath,
  storyPath,
  type RunSource,
} from "./api";
import { savedGet, savedPost } from "./data/savedDemo";

export type DemoResult<T = any> = T & { _source?: RunSource };

function withSource<T>(payload: T, source: RunSource): DemoResult<T> {
  markRunSource(source);
  return Object.assign(payload as object, { _source: source }) as DemoResult<T>;
}

function isUsableGet(path: string, payload: any): boolean {
  if (!payload || typeof payload !== "object") return false;
  if (Array.isArray(payload) && payload.length === 0) return false;
  if (path === API_PATHS.inbox) return Array.isArray(payload.samples) && payload.samples.length > 0;
  if (path === API_PATHS.invoices) return Array.isArray(payload.invoices) && payload.invoices.length > 0;
  if (path === API_PATHS.ar) return Array.isArray(payload.invoices) && payload.invoices.length > 0;
  if (path === API_PATHS.forecast) return Array.isArray(payload.weeks) && payload.weeks.length > 0;
  if (path === API_PATHS.cash) return Boolean(payload.featured_cases?.unexplained || payload.report?.matches?.length);
  if (path === API_PATHS.stripe) return Array.isArray(payload.payouts) && payload.payouts.length > 0;
  if (path === API_PATHS.close) return Array.isArray(payload.tasks) && payload.tasks.length > 0;
  if (path === API_PATHS.audit) return Boolean(payload.inputs?.featured?.self_approval);
  if (path === API_PATHS.memory) return Boolean((payload.decisions || []).length || (payload.harbor?.prior_memory || []).length);
  if (path === API_PATHS.evaluations) return Array.isArray(payload.catalog) && payload.catalog.length > 0;
  if (path === API_PATHS.gauntlet) return Array.isArray(payload.cases) && payload.cases.length > 0;
  if (path === API_PATHS.demoOverview) return Boolean(payload.metrics && Object.keys(payload.metrics).length);
  return Object.keys(payload).length > 0;
}

function isUsablePost(payload: any): boolean {
  if (!payload || typeof payload !== "object") return false;
  if (payload.ok === false) return false;
  return payload.result != null || payload.ok === true;
}

function shouldFallback(err: unknown): boolean {
  if (!(err instanceof Error)) return true;
  const status = (err as Error & { status?: number }).status;
  return isUnreachableError(err) || isMissingRouteError(err) || status === 500 || (typeof status === "number" && status >= 500);
}

async function liveFirstGet<T>(path: string): Promise<DemoResult<T>> {
  const fallback = savedGet(path);
  try {
    const payload = await get<T>(path);
    if (isUsableGet(path, payload)) {
      return withSource(payload, "live");
    }
  } catch (err) {
    if (isUnreachableError(err)) markApiReachable(false);
    if (!shouldFallback(err)) throw err;
  }
  if (fallback !== undefined) {
    return withSource(fallback, "saved");
  }
  throw new Error("Live agent run unavailable.");
}

async function liveFirstPost<T>(path: string, body?: unknown): Promise<DemoResult<T>> {
  const fallback = savedPost(path, body);
  try {
    const payload = await post<T>(path, body);
    if (isUsablePost(payload)) {
      return withSource(payload, "live");
    }
  } catch (err) {
    if (isUnreachableError(err)) markApiReachable(false);
    if (!shouldFallback(err)) throw err;
  }
  if (fallback !== undefined) {
    return withSource(fallback, "saved");
  }
  throw new Error("Live agent run unavailable.");
}

export const demoApi = {
  checkHealth,
  isLive: isApiLive,

  loadHealth: () => liveFirstGet(API_PATHS.health),
  loadStatus: () => liveFirstGet(API_PATHS.demoStatus),
  loadOverview: () => liveFirstGet(API_PATHS.demoOverview),
  loadCompanyState: () => liveFirstGet(API_PATHS.demoCompanyState),
  resetBooks: () => liveFirstPost(API_PATHS.demoReset),

  loadInbox: () => liveFirstGet(API_PATHS.inbox),
  loadInboxSample: (sampleId: string) => liveFirstGet(inboxSamplePath(sampleId)),
  identifyDocument: (sampleId: string) => liveFirstPost(API_PATHS.invoiceIngestion, { sample_id: sampleId }),
  sortInbox: () => liveFirstPost(API_PATHS.sortInbox, {}),

  loadInvoices: () => liveFirstGet(API_PATHS.invoices),
  loadInvoice: (invoiceId: string) => liveFirstGet(invoicePath(invoiceId)),
  runAccountsPayable: (invoiceId: string) => liveFirstPost(accountsPayablePath(invoiceId)),
  runAccountsPayableExample: (invoiceId: string) => liveFirstPost(accountsPayablePath(invoiceId)),
  runPaymentSchedule: () => liveFirstPost(API_PATHS.schedule),

  loadReceivables: () => liveFirstGet(API_PATHS.ar),
  runAccountsReceivable: () => liveFirstPost(API_PATHS.arAging),
  runAccountsReceivableAging: () => liveFirstPost(API_PATHS.arAging),
  runCollections: () => liveFirstPost(API_PATHS.arCollections),
  runCashApplication: (paymentId = "PAY-004") => liveFirstPost(API_PATHS.arCashApply, { payment_id: paymentId }),

  loadCash: () => liveFirstGet(API_PATHS.cash),
  runCashReconciliation: () => liveFirstPost(API_PATHS.bankReconciliation),
  runCashReconciliationExample: () => liveFirstPost(API_PATHS.bankReconciliation),

  loadStripe: () => liveFirstGet(API_PATHS.stripe),
  runStripeReconciliation: () => liveFirstPost(API_PATHS.stripeReconciliation),

  loadClose: () => liveFirstGet(API_PATHS.close),
  runClose: () => liveFirstPost(API_PATHS.closeWorkflow),
  runCloseExample: () => liveFirstPost(API_PATHS.closeWorkflow),
  runAccrual: (vendor = "Harbor Electric") => liveFirstPost(API_PATHS.accrual, { vendor }),

  loadForecast: () => liveFirstGet(API_PATHS.forecast),
  runForecast: () => liveFirstPost(API_PATHS.forecastWorkflow),
  runForecastExample: () => liveFirstPost(API_PATHS.forecastWorkflow),

  loadAudit: () => liveFirstGet(API_PATHS.audit),
  runAudit: () => liveFirstPost(API_PATHS.auditWorkflow),
  runAuditExample: () => liveFirstPost(API_PATHS.auditWorkflow),

  loadMemory: () => liveFirstGet(API_PATHS.memory),
  runMemory: (story = "harbor") => liveFirstPost(API_PATHS.memoryWorkflow, { story }),
  runMemoryExample: (story = "harbor") => liveFirstPost(API_PATHS.memoryWorkflow, { story }),
  runMemoryEval: () => liveFirstPost(API_PATHS.memoryEval),

  loadAgents: () => liveFirstGet(API_PATHS.agents),
  loadEvaluations: () => liveFirstGet(API_PATHS.evaluations),
  loadGauntlet: () => liveFirstGet(API_PATHS.gauntlet),
  loadScenarios: () => liveFirstGet(API_PATHS.scenarios),
  loadArchitecture: () => liveFirstGet(API_PATHS.architecture),
  loadStory: (name: string) => liveFirstGet(storyPath(name)),
  loadLineage: (recordId: string) => liveFirstGet(lineagePath(recordId)),

  runCfoCycle: () => liveFirstPost(API_PATHS.cfoCycle),
  runEvaluate: () => liveFirstPost(API_PATHS.evaluate),
  runGauntlet: (body?: { modes?: boolean; include_existing?: boolean }) => liveFirstPost(API_PATHS.gauntletWorkflow, body),
  runScenario: (scenarioId: string) => liveFirstPost(scenarioPath(scenarioId)),
};
