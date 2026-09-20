import { useEffect, useState } from "react";
import { statusTone } from "../api";
import { demoApi } from "../demoClient";
import { useWorkflow } from "../hooks";
import { Pill, RunBar } from "../layout/Shell";
import { DemoLayout, OutputHeadline, ProcessPanel } from "../components/Demo";
import { DevDetails, LineageChain, ResultBlock, TraceIds, WhatsHappening } from "../components/Explain";
import { formatCapability, formatEvalCase, formatFamily, formatPeriod, formatStatus, friendlyExpected } from "../copy";
import { savedGet } from "../data/savedDemo";

const FAMILY_ORDER = [
  "documents",
  "cash",
  "anti_hack",
  "questions",
  "rubrics",
  "consistency",
  "long_horizon",
  "memory",
  "recovery",
];

export default function Evaluations() {
  const [data, setData] = useState<any>(() => savedGet("/api/evaluations"));
  const [gauntlet, setGauntlet] = useState<any>(() => savedGet("/api/gauntlet"));
  const [stories, setStories] = useState<any>({});
  const [lineage, setLineage] = useState<any>(null);
  const [open, setOpen] = useState<any>(null);
  const { running, result, error, source, run } = useWorkflow();

  useEffect(() => {
    demoApi.loadEvaluations().then(setData).catch(() => setData(savedGet("/api/evaluations")));
    demoApi.loadGauntlet().then(setGauntlet).catch(() => setGauntlet(savedGet("/api/gauntlet")));
    demoApi.loadStory("trap").then((row) => setStories((prev: any) => ({ ...prev, trap: row }))).catch(() => undefined);
    demoApi.loadStory("harbor").then((row) => setStories((prev: any) => ({ ...prev, harbor: row }))).catch(() => undefined);
    demoApi.loadStory("stripe").then((row) => setStories((prev: any) => ({ ...prev, stripe: row }))).catch(() => undefined);
    demoApi.loadStory("correction").then((row) => setStories((prev: any) => ({ ...prev, correction: row }))).catch(() => undefined);
    demoApi.loadLineage("INV-006")
      .then(setLineage)
      .catch(() => setLineage(null));
  }, [result]);

  const gauntletPayload = result?.workflow === "gauntlet" ? result?.result?.payload || result?.result : gauntlet?.latest;
  const scorecard = gauntletPayload?.scorecard || gauntlet?.latest?.scorecard;
  const gauntletCases =
    gauntletPayload?.cases ||
    gauntlet?.cases ||
    gauntlet?.catalog ||
    data?.catalog ||
    [];
  const scored = Boolean(scorecard);
  const cases = latestAgentCases(data, result);
  const summary = summarize(data?.latest, cases, data?.summary);
  const selected = open || gauntletCases[0];
  const selectedCopy = formatEvalCase(selected?.case_id);
  const modes = gauntlet?.modes || (result?.result?.comparison ? { comparison: result.result.comparison, modes: result.result.payload?.modes } : null);
  const trap = stories.trap;
  const harbor = stories.harbor;
  const stripe = stories.stripe;
  const correction = stories.correction;

  return (
    <DemoLayout
      eyebrow="Evaluation Lab"
      title="Can these agents run connected finance work over time?"
      task="The Finance Gauntlet tests the same Maximor agents used in the live office against finance scenarios with known correct outcomes. Hidden expected outcomes stay off the agent path. A judge should be able to see what Maximor received, what it decided, why, what changed elsewhere, and whether that was correct."
      source={source}
      happening={
        <WhatsHappening
          happening="Maximor is scored on messy documents, bank-to-ledger evidence, multi-step questions, month-after-month accruals, and whether every workflow agrees on the same bill."
          figureOut="How often did Maximor get the finance treatment right, and did memory or shared books actually change the result?"
          why="This is how we show that the office is measured, not just narrated."
        />
      }
      error={error}
      runBar={
        <RunBar
            label="Run Finance Gauntlet"
            running={running}
            onRun={() => run(() => demoApi.runGauntlet())}
            extra={
              <>
                <button className="btn" disabled={running} onClick={() => run(() => demoApi.runEvaluate())}>
                  Run the published finance cases
                </button>
                <button className="btn" disabled={running} onClick={() => run(() => demoApi.runGauntlet({ modes: true }))}>
                  Compare memory on vs off
                </button>
              </>
            }
          />
      }
      input={
        <div className="stack">
          <div className="card">
            <h2>What Maximor is tested on</h2>
            <p className="muted">
              Public documents and questions are what the agents see. The correct answers are kept separate so Maximor cannot read them while it works.
            </p>
            <div className="table-scroll">
              <table className="data">
                <thead>
                  <tr>
                    <th>Scenario</th>
                    <th>Family</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {gauntletCases.map((item: any) => (
                    <tr key={item.case_id} className={selected?.case_id === item.case_id ? "selected" : ""} onClick={() => setOpen(item)}>
                      <td>
                        <div>{item.title || selectedCopy.title}</div>
                        <TraceIds ids={[item.case_id]} />
                      </td>
                      <td>{familyLabel(item.family, gauntlet)}</td>
                      <td>
                        {item.passed === undefined || item.passed === null ? (
                          <Pill>Not run</Pill>
                        ) : (
                          <Pill tone={statusTone(item.passed ? "pass" : "fail")}>{item.passed ? "Passed" : "Failed"}</Pill>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {trap ? (
            <div className="card">
              <h2>The trap</h2>
              <p>{trap.naive}</p>
              <div className="doc-paper">
                <pre>{trap.received}</pre>
              </div>
            </div>
          ) : null}
        </div>
      }
      process={<ProcessPanel stages={result?.result?.stages} summary={result?.result?.summary} />}
      output={
        <div className="stack">
          <div className="card">
            <OutputHeadline
              label="Finance Gauntlet"
              value={scored ? `${scorecard.scenarios_passed} / ${scorecard.total_scenarios} scenarios correct` : "Run the gauntlet to score Maximor"}
              tone={scored && scorecard.scenarios_failed === 0 ? "ok" : scored ? "warn" : "neutral"}
            />
            {scored ? (
              <>
                <div className="score-grid">
                  {FAMILY_ORDER.filter((key) => scorecard.by_family?.[key]).map((key) => {
                    const row = scorecard.by_family[key];
                    return (
                      <div key={key}>
                        <div className="muted">{familyLabel(key, gauntlet)}</div>
                        <strong>
                          {row.passed}/{row.total}
                        </strong>
                        <div className="meter">
                          <span style={{ width: `${Math.round((row.rate || 0) * 100)}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <dl className="kv">
                  <dt>Did every workflow agree?</dt>
                  <dd>
                    {pct(scorecard.cross_workflow_consistency_rate ?? scorecard.cross_workflow_consistency)}
                    <div className="muted">How often payables, cash, close, and reporting treated the same bill the same way.</div>
                  </dd>
                  <dt>Did a mistake spread?</dt>
                  <dd>
                    {pct(scorecard.error_propagation_rate)}
                    <div className="muted">How often an error in one step contaminated later finance work.</div>
                  </dd>
                  <dt>Unsupported claims</dt>
                  <dd>
                    {pct(scorecard.unsupported_assertion_rate ?? scorecard.unsupported_action_rate)}
                    <div className="muted">How often Maximor claimed something it did not have evidence for.</div>
                  </dd>
                  <dt>Recovery after a bad file</dt>
                  <dd>
                    {pct(scorecard.recovery_rate ?? scorecard.error_recovery)}
                    <div className="muted">How often Maximor recovered after a broken document or duplicate event instead of inventing books.</div>
                  </dd>
                </dl>
                {scorecard.long_horizon_by_period ? (
                  <div>
                    <h2>Month after month</h2>
                    {Object.entries(scorecard.long_horizon_by_period).map(([period, row]: any) => (
                      <p key={period}>
                        {formatPeriod(period)}: {pct(row.rate)} ({row.passed}/{row.total} cases correct)
                      </p>
                    ))}
                  </div>
                ) : null}
              </>
            ) : (
              <p className="muted">{gauntlet?.note || "Run the Finance Gauntlet to populate scored results."}</p>
            )}
          </div>
          {modes?.comparison ? (
            <div className="card">
              <h2>Did architecture features change the score?</h2>
              <p>
                With last month's saved decisions available, Maximor scored {pct(modes.comparison.memory_on_vs_off?.on)} overall and{" "}
                {pct(modes.comparison.memory_on_vs_off?.long_horizon_on)} on month-after-month cases. Without that memory, it scored{" "}
                {pct(modes.comparison.memory_on_vs_off?.off)} overall and {pct(modes.comparison.memory_on_vs_off?.long_horizon_off)} on those later-month cases.
              </p>
              <p>
                With every agent sharing the same company books, Maximor scored {pct(modes.comparison.shared_state_on_vs_off?.on)}. With a reduced shared picture, it scored{" "}
                {pct(modes.comparison.shared_state_on_vs_off?.off)}.
              </p>
              <p className="muted">These come from real configuration switches, not restated claims. If a feature does not help, the measured result stays visible.</p>
            </div>
          ) : null}
          {lineage?.received || lineage?.decision ? (
            <div className="card">
              <h2>Transaction lineage</h2>
              {lineage.received ? <p>{lineage.received}</p> : null}
              {lineage.decision ? (
                <p>
                  <strong>Decision.</strong> {lineage.decision}
                </p>
              ) : null}
              {lineage.why ? (
                <p>
                  <strong>Why.</strong> {lineage.why}
                </p>
              ) : null}
              <LineageChain steps={lineage.steps} />
              {(lineage.changed || []).map((item: string) => (
                <p key={item}>{item}</p>
              ))}
              {typeof lineage.correct === "boolean" ? (
                <Pill tone={lineage.correct ? "ok" : "warn"}>{lineage.correct ? "Consistent across workflows" : "Needs review"}</Pill>
              ) : null}
            </div>
          ) : null}
          {selected ? (
            <div className="card">
              <h2>{selected.title || selectedCopy.title}</h2>
              <ResultBlock
                found={selected.prompt || selectedCopy.test}
                why={`This belongs to the “${familyLabel(selected.family, gauntlet)}” tests.`}
                evidence={
                  <>
                    <p>{selected.passed === undefined || selected.passed === null ? "Not scored yet." : selected.reason || selectedCopy.test}</p>
                    {selected.actual != null ? <p>Maximor returned: {friendlyExpected(selected.actual)}</p> : null}
                  </>
                }
                result={
                  selected.passed === undefined || selected.passed === null
                    ? "Not scored yet."
                    : selected.passed
                      ? "Passed. Maximor's result matched the hidden expected outcome."
                      : "Failed. Maximor's result did not match the hidden expected outcome."
                }
              />
              {selected.expected != null ? (
                <DevDetails raw={{ expected: selected.expected, actual: selected.actual }}>
                  <p className="muted">Machine-readable expected and actual values stay here so a technical judge can verify the score.</p>
                </DevDetails>
              ) : null}
            </div>
          ) : null}
          {trap ? (
            <div className="card">
              <h2>What a naive system would do</h2>
              <p>{trap.naive}</p>
              <p>
                <strong>What Maximor detected.</strong> {trap.detected}
              </p>
              <p>{(trap.prevented || []).join(" ")}</p>
              {trap.duplicate?.title ? <p>Related live bill: {trap.duplicate.title}. {trap.duplicate.why}</p> : null}
            </div>
          ) : null}
          {harbor ? (
            <div className="card">
              <h2>Long-horizon memory: Harbor Electric</h2>
              <p>{harbor.august_evidence}</p>
              <p>{harbor.august_decision}</p>
              <p>{harbor.september_evidence}</p>
              <p>{harbor.september_decision}</p>
              <p>{harbor.explanation}</p>
            </div>
          ) : null}
          {correction ? (
            <div className="card">
              <h2>Self-correction when new evidence arrives</h2>
              <p>{correction.august}</p>
              <p>{correction.september}</p>
              <p>{correction.october}</p>
              <p>{typeof correction.explanation === "string" ? correction.explanation : correction.explanation?.narrative}</p>
            </div>
          ) : null}
          {stripe ? (
            <div className="card">
              <h2>Stripe to books</h2>
              <p>{stripe.received}</p>
              <p>{stripe.explanation}</p>
            </div>
          ) : null}
          {summary ? (
            <div className="card">
              <h2>Existing agent cases</h2>
              <p>
                {summary.passed} / {summary.total} previously published finance cases also passed. Ability under test: {formatCapability(cases[0]?.capability)}.
              </p>
            </div>
          ) : null}
        </div>
      }
    />
  );
}

function familyLabel(family: string | undefined, gauntlet: any) {
  const row = gauntlet?.families?.[family || ""];
  if (row?.plain) return row.plain;
  return formatFamily(family || "other");
}

function pct(value: unknown) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return `${Math.round(Number(value) * 1000) / 10}%`;
}

function latestAgentCases(data: any, result: any) {
  const latest = result?.result?.payload || data?.latest;
  const cases = latest?.cases ? mergeCases(data?.catalog || [], latest.cases) : data?.catalog || [];
  return cases;
}

function mergeCases(catalog: any[], results: any[]) {
  const byId = Object.fromEntries(results.map((item) => [item.case_id, item]));
  if (catalog.length) {
    return catalog.map((item) => ({ ...item, ...(byId[item.case_id] || {}) }));
  }
  return results;
}

function summarize(latest: any, cases: any[], existing: any) {
  if (existing && existing.total) return existing;
  const scored = cases.filter((item) => item.passed !== undefined);
  if (!scored.length && !latest?.total) return null;
  const total = latest?.total || scored.length;
  const passed = latest?.passed ?? scored.filter((item) => item.passed).length;
  return { total, passed, failed: latest?.failed ?? total - passed, success_rate: total ? passed / total : 0 };
}
