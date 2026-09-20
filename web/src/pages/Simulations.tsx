import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { statusTone } from "../api";
import { demoApi } from "../demoClient";
import { useWorkflow } from "../hooks";
import { ErrorBox, PageHead, Pill } from "../layout/Shell";
import { ArtifactStack, BeforeAfterDiff, flattenInputs, ProcessPanel, SourceArtifactViewer } from "../components/Demo";
import { SimulationCard } from "../components/SimulationCard";
import { DevDetails, TraceIds } from "../components/Explain";
import { AGENTS_BY_SLUG } from "../data/agents";
import { LIVE_RUNNERS, SIMULATIONS, SIMULATIONS_BY_ID, type Simulation } from "../data/simulations";
import { formatEvalCase, formatFieldKey, formatStatus, friendlyExpected } from "../copy";

export default function Simulations() {
  const { id } = useParams();
  const selected = id ? SIMULATIONS_BY_ID[id] : null;
  if (id && !selected) {
    return (
      <div>
        <PageHead eyebrow="Simulations" title="Simulation not found" lede="That simulation is not in the catalog." />
        <Link to="/simulations">Back to simulations</Link>
      </div>
    );
  }
  return selected ? <SimulationDetail item={selected} /> : <SimulationIndex />;
}

function SimulationIndex() {
  const [cards, setCards] = useState<any[]>([]);
  useEffect(() => {
    demoApi.loadScenarios().then((payload: any) => setCards(payload.scenarios || []));
  }, []);
  const byId = Object.fromEntries(cards.map((row) => [row.id, row]));

  return (
    <div>
      <PageHead
        eyebrow="Simulations"
        title="Finance scenarios on the real office"
        lede="A simulation is evidence that the agentic system handles a finance problem. It is not a separate product demo. Expected answers stay hidden until a run. Status is 'Runnable' until this machine has actually scored the case."
      />
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Live office runners</h2>
        <p className="muted">These pages run against the live demo company. They live here as simulations as well as in the office navigation.</p>
        <div className="chip-row">
          {LIVE_RUNNERS.map((row) => (
            <Link className="chip" key={row.id} to={row.href}>
              {row.title}
            </Link>
          ))}
        </div>
      </div>
      <div className="grid-2">
        {SIMULATIONS.map((item) => (
          <SimulationCard
            key={item.id}
            item={item}
            status={statusFor(item, byId[item.id])}
          />
        ))}
      </div>
    </div>
  );
}

function SimulationDetail({ item }: { item: Simulation }) {
  const [cards, setCards] = useState<any[]>([]);
  const { running, result, error, run } = useWorkflow();
  const [evals, setEvals] = useState<any>(null);

  useEffect(() => {
    demoApi.loadScenarios().then((payload: any) => setCards(payload.scenarios || []));
    demoApi.loadEvaluations().then(setEvals).catch(() => setEvals(null));
  }, [result]);

  const apiRow = cards.find((row) => row.id === item.id);
  const inner = result?.result;
  const io = inner?.io;
  const scored = scoredCases(item, evals);

  return (
    <div>
      <PageHead eyebrow="Simulation" title={item.title} lede={item.scenario} />
      <div className="btn-row" style={{ marginBottom: 16 }}>
        <Link className="btn" to="/simulations">
          All simulations
        </Link>
        <Link className="btn" to={item.href}>
          Open live runner
        </Link>
        {apiRow ? (
          <button
            className="btn primary"
            disabled={running}
            onClick={() => run(() => demoApi.runScenario(item.id))}
          >
            {running ? "Running…" : "Run this simulation"}
          </button>
        ) : item.runner === "cfo-cycle" ? (
          <button className="btn primary" disabled={running} onClick={() => run(() => demoApi.runCfoCycle())}>
            {running ? "Running…" : "Run the connected cycle"}
          </button>
        ) : null}
      </div>
      <ErrorBox error={error} />
      <div className="grid-2">
        <div className="stack">
          <div className="card">
            <h2>Business scenario</h2>
            <p>{item.scenario}</p>
            <h2>What makes it difficult</h2>
            <p>{item.difficulty}</p>
            <h2>Agents involved</h2>
            <p>{item.agents.map((slug) => AGENTS_BY_SLUG[slug]?.name).join(" · ")}</p>
          </div>
          <div className="card">
            <h2>Process</h2>
            <ol className="plain-list">
              {item.process.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
          {inner ? (
            <div className="card">
              <h2>What just ran</h2>
              <ProcessPanel stages={inner.stages} handoffs={inner.handoffs} summary={inner.summary} />
            </div>
          ) : (
            <div className="card">
              <p className="muted">Run the simulation to see the live agent steps, or open the live runner for the full working surface.</p>
            </div>
          )}
        </div>
        <div className="stack">
          <div className="card">
            <h2>Expected result</h2>
            <p>{item.expected}</p>
            <h2>Actual result</h2>
            {inner ? (
              <>
                <p>{inner.summary || formatStatus(result.status)}</p>
                <Pill tone={statusTone(result.status)}>{formatStatus(result.status)}</Pill>
                <TraceIds ids={inner.record_ids || result.record_ids} />
              </>
            ) : (
              <p className="muted">Not run on this page yet. The expected answer stays visible as the judging criterion; it is not treated as a claimed success.</p>
            )}
          </div>
          <div className="card">
            <h2>Evaluation cases</h2>
            {(item.evalCases || []).length ? (
              item.evalCases!.map((caseId) => {
                const copy = formatEvalCase(caseId);
                const row = scored[caseId];
                return (
                  <div key={caseId} style={{ marginBottom: 10 }}>
                    <div className="split">
                      <strong>{copy.title}</strong>
                      <Pill tone={row ? statusTone(row.passed ? "pass" : "fail") : "neutral"}>
                        {row ? (row.passed ? "Passed" : "Failed") : "Not scored here"}
                      </Pill>
                    </div>
                    <p className="muted">{copy.test}</p>
                  </div>
                );
              })
            ) : (
              <p className="muted">This scenario is runnable on the live office. It does not have a separately published agent-case id.</p>
            )}
          </div>
          {io?.inputs ? (
            <div className="card">
              <h2>Starting information</h2>
              <ArtifactStack artifacts={flattenInputs(io.inputs)} />
            </div>
          ) : apiRow?.input_preview?.length ? (
            <div className="card">
              <h2>Starting information</h2>
              <ArtifactStack artifacts={apiRow.input_preview} />
            </div>
          ) : null}
          {io?.before || io?.after ? (
            <div className="card">
              <h2>Downstream impact</h2>
              <BeforeAfterDiff before={flattenState(io.before)} after={flattenState(io.after)} labelFor={formatFieldKey} />
            </div>
          ) : null}
          {Array.isArray(result?.expected) && result.expected.length ? (
            <div className="card">
              <h2>Hidden expected outcome (after run)</h2>
              {result.expected.map((row: any) => (
                <div key={row.case_id} className="muted">
                  <div>{formatEvalCase(row.case_id).title}</div>
                  <div>{friendlyExpected(row.expected)}</div>
                </div>
              ))}
            </div>
          ) : null}
          {flattenInputs(io?.outputs).slice(0, 4).map((artifact: any, idx: number) => (
            <div className="card" key={artifact.artifact_id || idx}>
              <SourceArtifactViewer artifact={artifact} compact />
            </div>
          ))}
          {inner ? (
            <DevDetails raw={inner}>
              <p className="muted">Machine-readable stages, handoffs, and record ids for a technical judge.</p>
            </DevDetails>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function statusFor(item: Simulation, apiRow: any) {
  if (apiRow?.status) return { label: formatStatus(apiRow.status), tone: statusTone(apiRow.status) };
  return { label: "Runnable", tone: "neutral" };
}

function scoredCases(item: Simulation, evals: any): Record<string, { passed: boolean }> {
  const out: Record<string, { passed: boolean }> = {};
  const cases = evals?.latest?.cases || evals?.catalog || [];
  for (const caseId of item.evalCases || []) {
    const row = cases.find((entry: any) => entry.case_id === caseId);
    if (row && typeof row.passed === "boolean") out[caseId] = { passed: row.passed };
  }
  return out;
}

function flattenState(value: any): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) return null;
  const flat: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (item !== null && typeof item !== "object") flat[key] = item;
    else if (Array.isArray(item) && item.every((entry) => typeof entry !== "object")) flat[key] = item;
  }
  return Object.keys(flat).length ? flat : null;
}
