import { useEffect, useState } from "react";
import { usd } from "../api";
import { demoApi } from "../demoClient";
import { useWorkflow } from "../hooks";
import { ErrorBox, Pill, RunBar } from "../layout/Shell";
import { DemoLayout, OutputHeadline, ProcessPanel, SourceArtifactViewer } from "../components/Demo";
import { Definition, DevDetails, ResultBlock, StoryCard, TraceIds, WhatsHappening } from "../components/Explain";
import { ExpectedSteps, WORKFLOW_PREVIEWS } from "../components/Presentation";
import { formatAccountingMethod, formatAccountingSentence, formatAgent, formatPeriod, formatStatus, formatSummary } from "../copy";
import { savedGet } from "../data/savedDemo";

function describeLookup(lookup: any) {
  if (!lookup || typeof lookup !== "object") return null;
  const retrieved = lookup.retrieved || lookup.retrieved_ids || [];
  const used = lookup.precedent_used;
  const method = lookup.final_method || lookup.method || lookup.selected_method;
  return (
    <ResultBlock
      found={
        retrieved.length
          ? "When September arrived without a bill, Maximor retrieved the August Harbor Electric decision, including the evidence, amount, method, and reason."
          : "Maximor looked for a prior Harbor Electric decision to reuse."
      }
      why={
        used
          ? "The August approach still fit the current evidence, so Maximor reused that precedent as a starting point — then re-checked September's bills and contract before posting."
          : lookup.deviation
            ? `Maximor did not copy the old answer. ${lookup.deviation}`
            : "Maximor checked September's evidence again before deciding whether the August approach still made sense."
      }
      result={
        method
          ? `September decision: ${formatAccountingMethod(method)}${lookup.amount != null ? ` at ${usd(lookup.amount)}` : ""}.`
          : "See the September decision below."
      }
    />
  );
}

export default function Memory() {
  const [data, setData] = useState<any>(() => savedGet("/api/memory"));
  const { running, result, error, source, run } = useWorkflow();

  useEffect(() => {
    demoApi.loadMemory().then(setData).catch(() => setData(savedGet("/api/memory")));
  }, [result]);

  const inner = result?.result;
  const io = inner?.io;
  const off = result?.workflow === "memory-eval" ? inner?.payload : null;
  const method = io?.outputs?.final_method;
  const amount = io?.outputs?.final_amount;

  return (
    <DemoLayout
      eyebrow="Organizational memory"
      title="Decisions that travel from August to September"
      task="Decision memory lets Maximor remember how it handled a finance decision in an earlier period, including the evidence and reasoning behind it. Later periods can use that precedent, reject it when facts change, and record why."
      source={source}
      happening={
        <WhatsHappening
          happening="In August, Maximor estimated Harbor Electric from the contract and recent bills and saved that decision. In September the bill is missing again. Maximor retrieves the August record, then re-evaluates current evidence instead of blindly copying last month's number."
          figureOut="Should September reuse August's Harbor Electric method, or do current facts require a different estimate?"
          why="This is how accounting precedent survives across months without freezing the books into last month's answer."
        />
      }
      runBar={
        <>
          <RunBar
            label="Replay Harbor Electric memory"
            running={running}
            onRun={() => run(() => demoApi.runMemory("harbor"))}
            extra={
              <>
                <button className="btn" disabled={running} onClick={() => run(() => demoApi.runMemory("stripe"))}>
                  Replay Stripe memory
                </button>
                <button className="btn" disabled={running} onClick={() => run(() => demoApi.runMemoryEval())}>
                  Compare memory on vs off
                </button>
              </>
            }
          />
          <ErrorBox error={error} />
        </>
      }
      input={
        <div className="stack">
          <StoryCard title="What decision memory is">
            <Definition term="Decision memory" />
            <p>This is the saved professional judgment — what Maximor saw, what it decided, and why — so the next period can argue with it.</p>
          </StoryCard>
          <div className="card">
            <h2>What Maximor remembered from August</h2>
            <p>In August, Maximor estimated Harbor Electric using the contract plus recent bills. It saved the evidence, amount, method, and reason for that decision.</p>
            {(data?.harbor?.prior_memory || []).map((item: any, idx: number) => (
              <SourceArtifactViewer key={item.artifact_id || item.title || idx} artifact={item} />
            ))}
          </div>
          <div className="card">
            <h2>September evidence</h2>
            <SourceArtifactViewer artifact={data?.harbor?.history_table} />
          </div>
        </div>
      }
      process={inner?.stages?.length ? <ProcessPanel stages={inner?.stages} handoffs={inner?.handoffs} summary={inner?.summary} /> : <ExpectedSteps steps={WORKFLOW_PREVIEWS.memory} />}
      output={
        <div className="stack">
          <div className="card">
            <OutputHeadline label="How September estimated the missing bill" value={method ? formatAccountingMethod(method) : inner?.summary || "Not run yet"} />
            {method ? (
              <ResultBlock
                found={`Maximor chose “${formatAccountingMethod(method)}”${amount != null ? ` and estimated ${usd(Number(amount))}` : ""}.`}
                why={formatAccountingSentence(method)}
                result="The system's memory carries accounting precedent from one month into the next, but current evidence can override that precedent."
              />
            ) : (
              <p className="muted">Run the Harbor memory story to see whether September reused or overrode August's method.</p>
            )}
            <TraceIds ids={[io?.outputs?.written_memory_id, io?.outputs?.journal_entry?.entry_id]} />
            {io?.outputs?.journal_entry ? (
              <SourceArtifactViewer
                artifact={{
                  kind: "journal_entry",
                  artifact_id: io.outputs.journal_entry.entry_id || "harbor-je",
                  title: "September Harbor Electric journal",
                  source_path: "memory.scenarios",
                  record: io.outputs.journal_entry,
                }}
              />
            ) : null}
            {io?.outputs?.september_lookup ? (
              <div style={{ marginTop: 12 }}>
                <h2>How September used August</h2>
                <DevDetails raw={io.outputs.september_lookup}>{describeLookup(io.outputs.september_lookup)}</DevDetails>
              </div>
            ) : null}
          </div>
          {off ? (
            <div className="card">
              <h2>Memory on versus memory off</h2>
              <p className="muted">Same original Harbor input. Turning memory off forces September to estimate without last month's saved decision.</p>
              <DevDetails raw={off}>
                <ResultBlock
                  found="The same Harbor Electric facts were run twice: once with last month's saved decision available, and once as if September had never seen the vendor."
                  why="This measures whether memory actually changes the estimate, rather than restating that memory exists."
                  result="The numbers below come from that live comparison. They are not rewritten here."
                />
              </DevDetails>
            </div>
          ) : null}
          <div className="card">
            <h2>Saved decisions in this runtime</h2>
            {(data?.decisions || []).length === 0 ? (
              <p className="muted">After you replay Harbor Electric, saved decisions from this runtime appear here. August's estimate is already shown above.</p>
            ) : (
              (data.decisions || []).map((item: any) => (
                <div key={item.decision_id || item.id} className="card" style={{ marginBottom: 8 }}>
                  <strong>{formatAccountingMethod(item.decision || item.accounting_treatment) || formatSummary(item.summary)}</strong>
                  <p className="muted">{formatSummary(item.situation_summary || item.reason || item.summary)}</p>
                  <TraceIds ids={[item.decision_id || item.id]} />
                  <DevDetails raw={item}>
                    <dl className="kv">
                      <dt>Decision</dt>
                      <dd>{formatAccountingMethod(item.decision)}</dd>
                      <dt>Accounting month</dt>
                      <dd>{formatPeriod(item.period) || "—"}</dd>
                      <dt>Why</dt>
                      <dd>{formatSummary(item.rationale || item.reason || item.situation_summary) || "—"}</dd>
                    </dl>
                  </DevDetails>
                </div>
              ))
            )}
          </div>
          <div className="card">
            <h2>Other remembered events</h2>
            {(data?.events || []).length === 0 ? (
              <p className="muted">No other remembered events are available for this runtime yet.</p>
            ) : (
              (data.events || []).map((item: any) => (
                <div className="split" key={item.event_id} style={{ marginBottom: 8 }}>
                  <div>
                    <div>{item.title}</div>
                    <div className="muted">{formatPeriod(item.period)} · {formatStatus(item.kind)}</div>
                    <TraceIds ids={item.record_ids} />
                  </div>
                  <Pill>{formatAgent(item.agent)}</Pill>
                </div>
              ))
            )}
          </div>
        </div>
      }
    />
  );
}
