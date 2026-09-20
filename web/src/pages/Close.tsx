import { useEffect, useState } from "react";
import { usd, statusTone } from "../api";
import { demoApi } from "../demoClient";
import { useWorkflow } from "../hooks";
import { ErrorBox, Pill, RunBar } from "../layout/Shell";
import { BeforeAfterDiff, DemoLayout, OutputHeadline, ProcessPanel, SourceArtifactViewer } from "../components/Demo";
import { Definition, ResultBlock, StoryCard, TraceIds, WhatsHappening } from "../components/Explain";
import { ExpectedSteps, WORKFLOW_PREVIEWS } from "../components/Presentation";
import { formatAccountingSentence, formatStatus, formatTask } from "../copy";
import { savedGet } from "../data/savedDemo";

export default function Close() {
  const [data, setData] = useState<any>(() => savedGet("/api/close"));
  const { running, result, error, source, run } = useWorkflow();

  useEffect(() => {
    demoApi.loadClose().then(setData).catch(() => setData(savedGet("/api/close")));
  }, [result]);

  const inner = result?.result;
  const io = inner?.io;
  const harbor = data?.harbor?.input;
  const accrualOut = result?.workflow === "accrual" ? io?.outputs : null;
  const journal = accrualOut?.journal_entry || harbor?.seeded_journal?.record;
  const amount = accrualOut?.amount ?? (journal?.amount_minor != null ? journal.amount_minor / 100 : 4650);
  const method = accrualOut?.selected_method || accrualOut?.method;
  const history = harbor?.history_table?.rows || harbor?.history_table?.record || [];
  const amounts = (Array.isArray(history) ? history : []).map((row: any) => Number(row.expense || row.amount || 0)).filter(Boolean);
  const minAmt = amounts.length ? Math.min(...amounts) : 4700;
  const maxAmt = amounts.length ? Math.max(...amounts) : 4800;
  const beforeTasks = Object.fromEntries((io?.before?.tasks || data?.before_close || []).map((item: any) => [item.task_id, item.status]));
  const afterTasks = Object.fromEntries((io?.after?.tasks || data?.tasks || []).map((item: any) => [item.task_id, item.status]));

  return (
    <DemoLayout
      eyebrow="Month-end"
      title="Finish September's books"
      task="Month-end close is the work of making sure September's financial statements include everything that belongs in September — even bills that have not arrived yet."
      source={source}
      happening={
        <WhatsHappening
          happening="Harbor Electric is Maximor Demo Corp's electricity provider. Harbor Electric normally bills Maximor every month. September has ended, but the September electricity bill has not arrived yet. The company still used electricity during September, so its September financial statements need to include an estimated electricity expense."
          figureOut="How much September electricity expense should Maximor record using the evidence it has?"
          why="Leaving the cost out would make September look more profitable than it was. Recording an accrual keeps the month honest until the real bill arrives."
        />
      }
      runBar={
        <>
          <RunBar
            label="Run month-end close"
            running={running}
            onRun={() => run(() => demoApi.runClose())}
            extra={
              <button className="btn" disabled={running} onClick={() => run(() => demoApi.runAccrual("Harbor Electric"))}>
                Estimate Harbor Electric
              </button>
            }
          />
          <ErrorBox error={error} />
        </>
      }
      input={
        <div className="stack">
          <StoryCard title="About this scenario">
            <p>Harbor Electric is Maximor Demo Corp's electricity provider.</p>
            <p>
              An <strong>accrual</strong> records an expense in the month it was incurred, before the invoice arrives. Maximor must estimate how much September electricity expense to record using the evidence it has.
            </p>
            <Definition term="Accrual" />
          </StoryCard>
          <div className="card">
            <h2>Recent Harbor Electric bills</h2>
            <p className="muted">These are Harbor Electric's recent monthly bills. Recent bills have stayed close to {usd(minAmt)}–{usd(maxAmt)} per month.</p>
            <p>September invoice arrived? {harbor?.invoice_exists_for_september ? "Yes" : "No — the later invoice on file is for October."}</p>
            <SourceArtifactViewer artifact={harbor?.history_table} />
          </div>
          <div className="card">
            <h2>Contract evidence</h2>
            <p className="muted">This vendor contract confirms that Harbor Electric provides monthly utility service to Maximor.</p>
            <SourceArtifactViewer artifact={harbor?.contract} compact />
            {(harbor?.current_evidence || []).map((item: any, idx: number) => (
              <SourceArtifactViewer key={item.artifact_id || item.title || idx} artifact={item} compact />
            ))}
          </div>
          <div className="card">
            <h2>What Maximor remembered from August</h2>
            {(harbor?.prior_memory || []).map((item: any, idx: number) => (
              <SourceArtifactViewer key={item.artifact_id || item.title || idx} artifact={item} />
            ))}
          </div>
        </div>
      }
      process={inner?.stages?.length ? <ProcessPanel stages={inner?.stages} handoffs={inner?.handoffs} summary={inner?.summary} /> : <ExpectedSteps steps={WORKFLOW_PREVIEWS.close} />}
      output={
        <div className="stack">
          <div className="card">
            <OutputHeadline label="Month-end status" value={formatStatus(data?.status || io?.after?.status)} tone={statusTone(data?.status || io?.after?.status)} />
            <Definition term="Month-end close" />
            <ResultBlock
              found={`Maximor estimated September's Harbor Electric expense at ${usd(amount)}.`}
              why={
                method
                  ? formatAccountingSentence(method)
                  : "It used Harbor Electric's contract and recent monthly bills as evidence. The seeded September books already include this estimate."
              }
              result={`Maximor recorded ${usd(amount)} of September utility expense, paired with a ${usd(amount)} accrued liability. This lets September reflect the cost even though Harbor Electric has not sent the invoice yet.`}
            />
            <TraceIds ids={[accrualOut?.accrual_id || data?.harbor?.accrual_id, accrualOut?.written_memory_id, journal?.entry_id || data?.harbor?.journal_id]} />
            <h2>Formal journal entry</h2>
            <Definition term="Journal entry" />
            <p className="muted">
              This records {usd(amount)} of September utility expense, paired with {usd(amount)} still owed until the real bill arrives.
            </p>
            {accrualOut?.journal_entry ? (
              <SourceArtifactViewer artifact={{ kind: "journal_entry", artifact_id: accrualOut.journal_entry.entry_id, title: "Harbor Electric accrual", source_path: "accrual workflow", record: accrualOut.journal_entry }} />
            ) : (
              <SourceArtifactViewer artifact={harbor?.seeded_journal} />
            )}
          </div>
          <div className="card">
            <h2>Close checklist</h2>
            {(data?.tasks || []).map((item: any) => (
              <div className="split" key={item.task_id} style={{ marginBottom: 8 }}>
                <div>
                  <div>{formatTask(item.task_id)}</div>
                  <TraceIds ids={[item.task_id]} />
                </div>
                <Pill tone={statusTone(item.status)}>{formatStatus(item.status)}</Pill>
              </div>
            ))}
          </div>
          <div className="card">
            <h2>What changed on the close checklist</h2>
            <BeforeAfterDiff before={beforeTasks} after={afterTasks} onlyChanged unchangedMessage="Close-task statuses did not change in this run." labelFor={formatTask} />
          </div>
          <div className="card">
            <h2>Journal entries</h2>
            <div className="table-scroll">
              <table className="data">
                <thead>
                  <tr>
                    <th>What it recorded</th>
                    <th>Expense / asset</th>
                    <th>Offset</th>
                    <th className="right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.journals || []).slice(0, 12).map((item: any) => (
                    <tr key={item.entry_id}>
                      <td>
                        <div>{item.memo || item.vendor || "Journal entry"}</div>
                        <TraceIds ids={[item.entry_id]} />
                      </td>
                      <td>{item.debit_account}</td>
                      <td>{item.credit_account}</td>
                      <td className="num right">{usd((item.amount_minor || 0) / 100)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      }
    />
  );
}
