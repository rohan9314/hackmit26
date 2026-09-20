import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { usd, statusTone } from "../api";
import { demoApi } from "../demoClient";
import { useWorkflow } from "../hooks";
import { ErrorBox, Pill, SourceBadge } from "../layout/Shell";
import { BeforeAfterDiff, ProcessPanel } from "../components/Demo";
import { GlossaryTerm, MetricCard, TraceIds } from "../components/Explain";
import { HowItWorks } from "../components/HowItWorks";
import { CoverageGrid } from "../components/CoverageGrid";
import { SimulationCard } from "../components/SimulationCard";
import { VideoShowcase } from "../components/VideoShowcase";
import { AGENTS, ROOMS } from "../data/agents";
import { SIMULATIONS } from "../data/simulations";
import { VIDEOS } from "../data/videos";
import { INVOICE_STORY } from "../data/workflowStory";
import { formatFieldKey, formatStatus, EVAL_CASE_COPY, explainMetric } from "../copy";
import { savedGet } from "../data/savedDemo";

export default function Overview() {
  const [data, setData] = useState<any>(() => savedGet("/api/demo/overview"));
  const [error, setError] = useState<string | null>(null);
  const [start, setStart] = useState<any>(() => savedGet("/api/demo/company-state"));
  const [evals, setEvals] = useState<any>(() => savedGet("/api/evaluations"));
  const { running, result, error: runError, source, run } = useWorkflow();

  useEffect(() => {
    demoApi.loadOverview().then(setData).catch(() => setData(savedGet("/api/demo/overview")));
    demoApi.loadCompanyState().then(setStart).catch(() => setStart(savedGet("/api/demo/company-state")));
    demoApi.loadEvaluations().then(setEvals).catch(() => setEvals(savedGet("/api/evaluations")));
  }, [result]);

  const m = data?.metrics || {};
  const inner = result?.result;
  const io = inner?.io;
  const before = io?.before || start;
  const after = io?.after;
  const featured = SIMULATIONS.filter((item) => item.featured).slice(0, 6);
  const evalSummary = evals?.summary;

  return (
    <div className="home">
      <section className="hero">
        <div className="eyebrow">HackMIT · Agentic Systems for the Office of the CFO</div>
        <h1>An AI finance team for the Office of the CFO.</h1>
        <p className="lede hero-lede">
          Maximor uses a coordinated team of finance agents to handle{" "}
          <GlossaryTerm term="Accounts payable">bills the company owes</GlossaryTerm>,{" "}
          <GlossaryTerm term="Reconciliation">matching the bank to the books</GlossaryTerm>,{" "}
          <GlossaryTerm term="Month-end close">finishing the month</GlossaryTerm>, projecting cash, and checking controls, while sharing the same company records and remembered decisions.
        </p>
        <div className="btn-row">
          <Link className="btn primary" to="/architecture">
            See how the agents work together
          </Link>
          <Link className="btn" to="/simulations">
            Open simulations
          </Link>
          <Link className="btn" to="/workflow">
            Follow one invoice
          </Link>
        </div>
        <div className="hero-flow" aria-label="Simplified finance flow">
          {ROOMS.map((room) => (
            <div className="hero-room" key={room.id}>
              <div className="hero-room-title">{room.title}</div>
              <div className="hero-agents">
                {AGENTS.filter((agent) => agent.room === room.id).map((agent) => (
                  <span key={agent.slug}>{agent.name.replace(/ Agent$/, "")}</span>
                ))}
              </div>
            </div>
          ))}
          <div className="hero-room shared">
            <div className="hero-room-title">Shared company context</div>
            <div className="hero-agents">
              <span>Books</span>
              <span>Memory</span>
              <span>Evidence</span>
            </div>
          </div>
        </div>
      </section>

      <HowItWorks />

      <section className="showcase-section">
        <div className="eyebrow">The team</div>
        <h2 className="section-title">Agents coordinate. They do not each own a product demo.</h2>
        <p className="lede">
          Earlier, dozens of narrow finance roles existed as separate display names. Those jobs still exist as skills and profiles on a smaller set of standing agents. Control agents recheck uncertain work. Audit samples after the fact.
        </p>
        <div className="grid-2">
          <div className="card">
            <h2>Working agents and control agents</h2>
            <p>Payables, payments, cash application, collections, cash reconciliation, close, and reporting prepare work. Payables Control, Cash Control, and Books Control look for reasons to refuse. The Audit Agent does not operate the books.</p>
            <p className="muted">The number of agents is an implementation choice. The story is shared context, handoffs, and an inspectable trail.</p>
            <Link className="btn" to="/architecture" style={{ marginTop: 8 }}>
              Open how the agents work together
            </Link>
          </div>
          <div className="card">
            <h2>What one invoice touches</h2>
            <ol className="plain-list">
              {INVOICE_STORY.slice(0, 5).map((step) => (
                <li key={step.n}>
                  <strong>{step.title}. </strong>
                  {step.body}
                </li>
              ))}
            </ol>
            <Link className="btn" to="/workflow">
              Follow the full path
            </Link>
          </div>
        </div>
      </section>

      <section className="showcase-section">
        <div className="eyebrow">Memory</div>
        <h2 className="section-title">September is not a blank slate</h2>
        <div className="grid-2">
          <div className="card">
            <h2>Without memory</h2>
            <p>Each month estimates Harbor Electric as if the company had never seen the vendor. The reason for last month's method is gone.</p>
          </div>
          <div className="card">
            <h2>With memory</h2>
            <p>September can retrieve August's evidence, method, amount, and reason — then re-check current facts instead of pasting last month's number.</p>
            <Link className="btn" to="/memory">
              Open the Harbor Electric memory
            </Link>
          </div>
        </div>
      </section>

      <CoverageGrid compact />

      <section className="showcase-section" id="simulations">
        <div className="eyebrow">Simulations</div>
        <h2 className="section-title">Evidence that the real system handles finance scenarios</h2>
        <p className="lede">
          These are not isolated product demos. Each card is a scenario the office can run against the live books, with expected outcomes held off the agent path.
        </p>
        <div className="grid-2">
          {featured.map((item) => (
            <SimulationCard key={item.id} item={item} />
          ))}
        </div>
        <p className="muted" style={{ marginTop: 12 }}>
          <Link to="/simulations">All simulations →</Link>
        </p>
      </section>

      <VideoShowcase videos={VIDEOS.filter((item) => item.featured).concat(VIDEOS.filter((item) => !item.featured)).slice(0, 4)} />

      <section className="showcase-section">
        <div className="eyebrow">Evidence</div>
        <h2 className="section-title">Measured against hidden expected outcomes</h2>
        <div className="grid-2">
          <div className="card">
            <h2>Published agent cases</h2>
            {evalSummary?.total ? (
              <p>
                {evalSummary.passed} / {evalSummary.total} scored cases matched the hidden expected outcome in the latest run on this machine.
              </p>
            ) : (
              <p>
                The catalog contains {Array.isArray(evals?.catalog) && evals.catalog.length ? evals.catalog.length : Object.keys(EVAL_CASE_COPY).length} agent cases with grader-only expected answers. Scores appear after you run evaluations — they are not hardcoded.
              </p>
            )}
            <Link className="btn" to="/evaluations">
              Open evaluation evidence
            </Link>
          </div>
          <div className="card">
            <h2>What we will not claim</h2>
            <p>Pass rates, memory-on versus memory-off deltas, and planted-error counts are shown only from an actual run. If a gauntlet has not been executed here, the page says so.</p>
          </div>
        </div>
      </section>

      <section className="showcase-section" id="live-books">
        <div className="eyebrow">Live books</div>
        <h2 className="section-title">Maximor Demo Corp, September 2026</h2>
        <p className="lede">
          The showcase above is the architecture. Below is the same office running on the demo company. Starting company state, the work the agents perform, and the ending state stay visible.
        </p>
        {error ? <div className="notice">{error}</div> : null}
        {!data && !error ? <div className="muted">Loading Maximor books…</div> : null}
        <div className="toolbar">
          <div className="btn-row">
            <button className="btn primary" disabled={running} onClick={() => run(() => demoApi.runCfoCycle())}>
              {running ? "Running…" : "Run the connected CFO cycle"}
            </button>
            <Link className="btn" to="/simulations/cfo-cycle">
              About this simulation
            </Link>
            <SourceBadge source={source} />
          </div>
        </div>
        <ErrorBox error={runError} />
        <div className="io-flow">
          <div className="io-col">
            <div className="io-label">Starting company state</div>
            <StateCard state={before} />
          </div>
          <div className="io-arrow">→</div>
          <div className="io-col">
            <div className="io-label">What the agents did</div>
            <ProcessPanel stages={inner?.stages} handoffs={inner?.handoffs} summary={inner?.summary} />
          </div>
          <div className="io-arrow">→</div>
          <div className="io-col">
            <div className="io-label">Ending company state</div>
            {after ? (
              <div className="stack">
                <StateCard state={after} />
                <div className="card">
                  <h2>What changed</h2>
                  <BeforeAfterDiff
                    before={pickState(before)}
                    after={pickState(after)}
                    fields={["cash", "ap_outstanding", "ar_outstanding", "close_status", "exception_count", "journal_count", "decision_memory_count", "projected_ending_cash"]}
                    onlyChanged
                    unchangedMessage="The CFO cycle ran, but these headline company totals did not move."
                    labelFor={formatFieldKey}
                  />
                </div>
              </div>
            ) : (
              <div className="card">
                <p className="muted">Run the cycle to persist ending cash, unpaid bills, close status, journals, memory, and the cash forecast from the live agents.</p>
              </div>
            )}
          </div>
        </div>
        {data ? (
          <>
            <div className="metrics">
              <MetricCard
                label="Cash in bank"
                value={usd(m.cash)}
                interpretation={explainMetric("cash", m.cash).interpretation}
              />
              <MetricCard
                label="Unpaid vendor bills"
                value={usd(m.ap_outstanding)}
                interpretation={explainMetric("ap_outstanding", m.ap_outstanding).interpretation}
              />
              <MetricCard
                label="Unpaid customer invoices"
                value={usd(m.ar_outstanding)}
                interpretation={explainMetric("ar_outstanding", m.ar_outstanding).interpretation}
              />
              <MetricCard
                label="13-week ending cash"
                value={usd(m.projected_13w_ending_cash)}
                interpretation={explainMetric("projected_13w_ending_cash", m.projected_13w_ending_cash).interpretation}
                driver="The largest expected cash outflows are payroll and vendor payments."
              />
              <MetricCard
                label="Unresolved bank difference"
                value={usd(m.unreconciled_items)}
                interpretation={explainMetric("unreconciled_items", m.unreconciled_items).interpretation}
                driver="The Northstar deposit is $12.40 above the invoice."
              />
              <MetricCard
                label="Month-end status"
                value={formatStatus(m.close_status)}
                interpretation={explainMetric("close_status", m.close_status).interpretation}
              />
              <MetricCard
                label="Audit findings"
                value={m.open_audit_findings ?? "Not run yet"}
                interpretation="Independent audit findings appear after the audit is run. The Audit Agent samples the books after operations have recorded them."
              />
              <MetricCard
                label="Finance team"
                value={`${AGENTS.length} agents`}
                interpretation="Standing office workers sharing one set of books, saved decisions, and evidence."
              />
            </div>
            <div className="grid-2">
              <div className="card">
                <h2>What needs attention</h2>
                {(data.briefing || []).length === 0 ? (
                  <p className="muted">Nothing currently needs extra attention on the live books.</p>
                ) : (
                  (data.briefing || []).map((item: any) => (
                  <Link key={item.title} to={item.href} className="tl-item" style={{ marginBottom: 10 }}>
                    <div />
                    <div className="tl-body">
                      <div className="tl-title">{item.title}</div>
                      <div className="tl-meta">{item.detail}</div>
                      <TraceIds ids={item.record_ids} />
                    </div>
                  </Link>
                  ))
                )}
              </div>
              <div className="card">
                <h2>Finance operations</h2>
                {(data.operations || []).map((item: any) => (
                  <Link key={item.id} to={item.href} className="split" style={{ marginBottom: 8 }}>
                    <strong>{item.label}</strong>
                    <Pill tone={statusTone(item.status)}>{formatStatus(item.status)}</Pill>
                  </Link>
                ))}
              </div>
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}

function pickState(state: any) {
  if (!state) return {};
  const { close_tasks, open_ap, open_ar, ...rest } = state;
  return rest;
}

function StateCard({ state }: { state: any }) {
  if (!state) return <div className="card"><p className="muted">Loading company state…</p></div>;
  return (
    <div className="card">
      <dl className="kv">
        <dt>Cash in bank</dt>
        <dd>{usd(state.cash)}</dd>
        <dt>Unpaid vendor bills</dt>
        <dd>{usd(state.ap_outstanding)}</dd>
        <dt>Unpaid customer invoices</dt>
        <dd>{usd(state.ar_outstanding)}</dd>
        <dt>Unresolved bank item</dt>
        <dd>{state.unreconciled_item === "TXN-2026-09-015" ? "Northstar $12.40 difference" : formatStatus(state.unreconciled_item)}</dd>
        <dt>Month-end</dt>
        <dd>{formatStatus(state.close_status)}</dd>
        <dt>Open exceptions</dt>
        <dd>
          {state.exception_count}
          <div className="muted">
            {Number(state.exception_count) === 0
              ? "No bills or bank items are currently waiting on extra investigation."
              : `${state.exception_count} item${Number(state.exception_count) === 1 ? "" : "s"} still need investigation before they can be treated as settled.`}
          </div>
        </dd>
        <dt>Forecast ending cash</dt>
        <dd>{usd(state.projected_ending_cash)}</dd>
      </dl>
      <TraceIds ids={[state.unreconciled_item]} label="Bank reference" />
    </div>
  );
}
