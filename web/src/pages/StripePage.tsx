import { useEffect, useState } from "react";
import { usd, statusTone } from "../api";
import { demoApi } from "../demoClient";
import { useWorkflow } from "../hooks";
import { ErrorBox, Pill, RunBar } from "../layout/Shell";
import { DemoLayout, OutputHeadline, ProcessPanel, SourceArtifactViewer } from "../components/Demo";
import { ExpectedSteps, WORKFLOW_PREVIEWS } from "../components/Presentation";
import { Definition, ResultBlock, TraceIds, WhatsHappening } from "../components/Explain";
import { formatStatus } from "../copy";
import { savedGet } from "../data/savedDemo";

export default function Stripe() {
  const [data, setData] = useState<any>(() => savedGet("/api/stripe"));
  const [index, setIndex] = useState(0);
  const { running, result, error, source, run } = useWorkflow();

  useEffect(() => {
    demoApi.loadStripe().then(setData).catch(() => setData(savedGet("/api/stripe")));
  }, [result]);

  const payouts = result?.result?.payouts || data?.payouts || [];
  const current = payouts[index];
  const payoutId = current?.payout?.payout_id;
  const bundle = data?.bundles?.[payoutId] || result?.result?.io?.inputs;
  const bd = current?.breakdown;
  const inner = result?.result;
  const expected = bd?.expected_payout ?? bd?.net;
  const deposit = current?.payout?.bank_deposit_amount ?? bundle?.bank_deposit?.record?.amount;

  return (
    <DemoLayout
      eyebrow="Stripe"
      title="How a Stripe payout became a bank deposit"
      task="Stripe collects customer card payments, takes fees, handles refunds and chargebacks, then sends a net payout to the bank. Maximor reconstructs that waterfall so the bank deposit can be explained."
      source={source}
      happening={
        <WhatsHappening
          happening="A Stripe payout is not a single customer payment. It is gross charges minus refunds, disputes, and Stripe fees. That net amount should match the bank deposit."
          figureOut="Does this payout tie out to the bank, and if not, which piece of the waterfall is off?"
          why="Without this explanation, cash reconciliation would see a bank deposit it cannot match to the books."
        />
      }
      runBar={
        <>
          <div className="toolbar">
            <div className="btn-row">
              <button className="btn primary" disabled={running} onClick={() => run(() => demoApi.runStripeReconciliation())}>
                {running ? "Running…" : "Explain this payout"}
              </button>
            </div>
            <Pill tone={data?.mode?.mode === "live" ? "warn" : "info"}>Stripe {data?.mode?.mode || "simulated"}</Pill>
          </div>
          <ErrorBox error={error} />
        </>
      }
      input={
        <div className="stack">
          <div className="card">
            <h2>The payout Stripe sent</h2>
            {(payouts || []).map((item: any, idx: number) => (
              <div key={item.payout?.payout_id || idx} className="card clickable" onClick={() => setIndex(idx)} style={{ marginBottom: 8 }}>
                <div className="split">
                  <div>{item.payout?.description || `Payout for ${usd(item.payout?.bank_deposit_amount || item.breakdown?.expected_payout || 0)}`}</div>
                  <Pill tone={item.tied ? "ok" : "bad"}>{item.tied ? "Tied to the bank deposit" : "Does not tie out"}</Pill>
                </div>
              </div>
            ))}
            <SourceArtifactViewer artifact={bundle?.payout} />
          </div>
          <div className="card">
            <h2>Charges, refunds, fees, and disputes</h2>
            {(bundle?.balance_transactions || []).map((item: any, idx: number) => (
              <SourceArtifactViewer key={item.artifact_id || item.title || idx} artifact={item} compact />
            ))}
            <h2>Bank deposit</h2>
            <SourceArtifactViewer artifact={bundle?.bank_deposit} />
          </div>
        </div>
      }
      process={inner?.stages?.length ? <ProcessPanel stages={inner?.stages} handoffs={inner?.handoffs} summary={inner?.summary} /> : <ExpectedSteps steps={WORKFLOW_PREVIEWS.stripe} />}
      output={
        <div className="card">
          <OutputHeadline label="Tied to the bank deposit?" value={current?.tied ? "Yes" : current ? "Not yet" : "Select a payout"} tone={current?.tied ? "ok" : "bad"} />
          <Definition term="Chargeback" />
          {bd ? (
            <>
              <ResultBlock
                found={
                  current?.tied
                    ? `Customer charges, refunds, disputes, and Stripe fees add up to an expected payout of ${usd(expected)}, which matches the ${usd(deposit)} bank deposit.`
                    : `The expected payout of ${usd(expected)} does not match the ${usd(deposit)} bank deposit.`
                }
                why="A Stripe payout is not a single customer payment. It is the net of everything Stripe processed before sending money to the bank."
                result={
                  current?.tied
                    ? "Cash reconciliation can treat this bank deposit as explained."
                    : "Cash reconciliation still needs an explanation for the difference before the deposit can be treated as complete."
                }
              />
              <div className="waterfall-eq">
                <div>Customer charges {usd(bd.gross_payments)}</div>
                <div>− refunds {usd(Math.abs(Number(bd.refunds || 0)))}</div>
                <div>− disputes / chargebacks {usd(Math.abs(Number(bd.chargebacks || 0)))}</div>
                <div>− Stripe fees {usd(Math.abs(Number(bd.fees || 0)))}</div>
                <div>= expected payout {usd(expected)}</div>
                <div>Bank deposit {usd(deposit)}</div>
                <div>Difference {usd((expected || 0) - (deposit || 0))}</div>
              </div>
            </>
          ) : (
            <p className="muted">Select a payout. The arithmetic comes from Stripe reconciliation, not a number invented in this page.</p>
          )}
          {(bd?.exceptions || []).map((item: string) => (
            <Pill key={item} tone="bad">
              {formatStatus(item)}
            </Pill>
          ))}
          <TraceIds ids={[payoutId, current?.payout?.bank_deposit_id]} />
        </div>
      }
    />
  );
}
