import { useEffect, useState } from "react";
import { usd, statusTone } from "../api";
import { demoApi } from "../demoClient";
import { useWorkflow } from "../hooks";
import { ErrorBox, Pill, RunBar } from "../layout/Shell";
import { DemoLayout, OutputHeadline, ProcessPanel, SourceArtifactViewer } from "../components/Demo";
import { ExpectedSteps, WORKFLOW_PREVIEWS } from "../components/Presentation";
import { Definition, ResultBlock, StoryCard, TraceIds, WhatsHappening } from "../components/Explain";
import { explainCashMatch, formatMatchType, formatStatus } from "../copy";
import { savedGet } from "../data/savedDemo";

export default function Cash() {
  const [data, setData] = useState<any>(() => savedGet("/api/cash"));
  const [focus, setFocus] = useState<string>("unexplained");
  const { running, result, error, source, run } = useWorkflow();

  useEffect(() => {
    demoApi.loadCash().then(setData).catch(() => setData(savedGet("/api/cash")));
  }, [result]);

  const report = result?.result?.report || data?.report;
  const matches = report?.matches || result?.result?.io?.outputs?.matches || [];
  const inner = result?.result;
  const featured = data?.featured_cases?.[focus];
  const featuredMatch = (matches || []).find((item: any) => (item.bank_transaction_ids || []).includes(featured?.bank?.artifact_id));
  const story = explainCashMatch(featuredMatch || { match_type: focus === "unexplained" ? "UNEXPLAINED_DIFFERENCE" : focus === "grouped" ? "GROUPED_MATCH" : "FEE_NETTED" });

  return (
    <DemoLayout
      eyebrow="Cash"
      title="Does the bank agree with the books?"
      task="Bank reconciliation checks whether the company's bank activity agrees with its accounting records. Every bank deposit or withdrawal should have a matching explanation in the ledger."
      source={source}
      happening={
        <WhatsHappening
          happening="The bank shows that Northstar paid Maximor $12,412.40. The accounting ledger says Northstar owed and paid $12,400."
          figureOut="Why is there an extra $12.40 in the bank?"
          why="Cash reconciliation — and therefore September close — remains incomplete until the $12.40 difference can be explained."
        />
      }
      runBar={
        <>
          <RunBar label="Reconcile bank to ledger" running={running} onRun={() => run(() => demoApi.runCashReconciliation())} />
          <ErrorBox error={error} />
          <div className="btn-row" style={{ marginBottom: 14 }}>
            {[
              ["unexplained", "The $12.40 Northstar difference"],
              ["fee_netted", "Wire with a bank fee"],
              ["grouped", "One payment, several bills"],
            ].map(([id, label]) => (
              <button key={id} className={`btn ${focus === id ? "primary" : ""}`} onClick={() => setFocus(id)}>
                {label}
              </button>
            ))}
          </div>
        </>
      }
      input={
        <div className="stack">
          <StoryCard title={focus === "unexplained" ? "What the bank and the books show" : "Bank and ledger evidence"}>
            {focus === "unexplained" ? (
              <>
                <p>The bank shows that Northstar paid Maximor $12,412.40.</p>
                <p>The accounting ledger says Northstar owed and paid $12,400.</p>
              </>
            ) : focus === "grouped" ? (
              <p>One bank withdrawal should correspond to several approved vendor invoices paid together.</p>
            ) : (
              <p>A bank wire arrived for less than the ledger amount because a bank fee was taken out.</p>
            )}
          </StoryCard>
          <div className="card">
            <h2>Bank statement row</h2>
            <SourceArtifactViewer artifact={featured?.bank} />
          </div>
          <div className="card">
            <h2>Accounting ledger rows</h2>
            {(featured?.ledger || []).map((item: any, idx: number) => (
              <SourceArtifactViewer key={item.artifact_id || item.title || idx} artifact={item} compact />
            ))}
            {(featured?.fees || []).map((item: any, idx: number) => (
              <SourceArtifactViewer key={item.artifact_id || item.title || idx} artifact={item} compact />
            ))}
          </div>
        </div>
      }
      process={inner?.stages?.length ? <ProcessPanel stages={inner?.stages} handoffs={inner?.handoffs} summary={inner?.summary} /> : <ExpectedSteps steps={WORKFLOW_PREVIEWS.cash} />}
      output={
        <div className="card">
          <OutputHeadline label="Reconciliation result" value={story.title} tone={statusTone(featuredMatch?.status || report?.period_status)} />
          <Definition term="Reconciliation" />
          {focus === "fee_netted" ? <Definition term="Bank fee" /> : null}
          {featuredMatch ? (
            <ResultBlock
              found={story.body}
              why={
                featuredMatch.match_type === "UNEXPLAINED_DIFFERENCE"
                  ? "Maximor searched for a fee, adjustment, invoice difference, or other supporting transaction. It could not find evidence explaining the extra $12.40."
                  : formatMatchType(featuredMatch.match_type)
              }
              result={
                featuredMatch.match_type === "UNEXPLAINED_DIFFERENCE"
                  ? "Cash reconciliation remains incomplete until the $12.40 difference can be explained. Maximor does not invent a balancing entry."
                  : `${formatStatus(featuredMatch.status)}. Bank ${usd(featuredMatch.bank_amount)} versus ledger ${usd(featuredMatch.ledger_amount)}.`
              }
              evidence={
                <dl className="kv">
                  <dt>Bank amount</dt>
                  <dd>{usd(featuredMatch.bank_amount)}</dd>
                  <dt>Ledger amount</dt>
                  <dd>{usd(featuredMatch.ledger_amount)}</dd>
                  <dt>Difference</dt>
                  <dd>{usd((featuredMatch.bank_amount || 0) - (featuredMatch.ledger_amount || 0))}</dd>
                </dl>
              }
            />
          ) : (
            <p className="muted">Run reconciliation to persist the match against these exact source rows. Until then, the known story is still the $12.40 Northstar difference.</p>
          )}
          <TraceIds ids={[...(featuredMatch?.bank_transaction_ids || []), ...(featuredMatch?.ledger_entry_ids || [])]} />
          <h2>All matches</h2>
          {matches.length === 0 ? (
            <p className="muted">After you run reconciliation, every bank-to-ledger match appears here. Until then, the known story is the $12.40 Northstar difference above.</p>
          ) : (
            <div className="table-scroll">
              <table className="data">
                <thead>
                  <tr>
                    <th>What happened</th>
                    <th>Result</th>
                    <th className="right">Bank</th>
                    <th className="right">Ledger</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.map((item: any) => {
                    const row = explainCashMatch(item);
                    return (
                      <tr key={item.reconciliation_id || item.match_key}>
                        <td>
                          <div>{row.title}</div>
                          <div className="muted">{row.body}</div>
                          <TraceIds ids={[...(item.bank_transaction_ids || []), ...(item.ledger_entry_ids || [])]} />
                        </td>
                        <td>
                          <Pill tone={statusTone(item.status)}>{formatStatus(item.status)}</Pill>
                        </td>
                        <td className="num right">{usd(item.bank_amount)}</td>
                        <td className="num right">{usd(item.ledger_amount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      }
    />
  );
}
