import { useEffect, useState } from "react";
import { usd, statusTone } from "../api";
import { demoApi } from "../demoClient";
import { useWorkflow } from "../hooks";
import { ErrorBox, Pill, RunBar } from "../layout/Shell";
import { DemoLayout, OutputHeadline, ProcessPanel, SourceArtifactViewer } from "../components/Demo";
import { ExpectedSteps, WORKFLOW_PREVIEWS } from "../components/Presentation";
import { Definition, GlossaryTerm, ResultBlock, StoryCard, TraceIds, WhatsHappening } from "../components/Explain";
import { AGING_COPY, formatDecision, formatRecordId, formatStatus } from "../copy";
import { savedGet } from "../data/savedDemo";

const BUCKETS = ["CURRENT", "1-30", "31-60", "61-90", "90+"];

export default function AR() {
  const [data, setData] = useState<any>(() => savedGet("/api/ar"));
  const [selected, setSelected] = useState<any>(() => (savedGet("/api/ar")?.invoices || []).find((item: any) => item.outstanding_amount > 0) || null);
  const { running, result, error, source, run } = useWorkflow();

  useEffect(() => {
    demoApi.loadReceivables().then(setData).catch(() => setData(savedGet("/api/ar")));
  }, [result]);
  const inner = result?.result;
  const io = inner?.io;
  const remittance = io?.inputs?.payment || data.featured_payment?.payment;
  const paymentOut = io?.outputs;
  const payment = remittance?.record || remittance || (data.payments || []).find((item: any) => item.payment_id === "PAY-004");
  const applied = paymentOut?.invoice_ids || [];
  const decision = paymentOut?.decision || inner?.summary;
  const buckets = data.buckets || {};
  const current = Number(buckets.CURRENT || 0);
  const overdue90 = Number(buckets["90+"] || 0);
  const outstanding = Number(data.outstanding || 0);

  return (
    <div>
      <DemoLayout
        eyebrow="Accounts receivable"
        title="Money customers still owe"
        task="Accounts receivable is money customers still owe the company. Maximor tracks every unpaid customer invoice, determines how late it is, follows up on overdue balances, and matches incoming customer payments to the invoices they paid."
        source={source}
        happening={
          <WhatsHappening
            happening="Lumen Labs sent Maximor a $5,000 payment. The payment description only says “September billing” and does not identify an invoice. Maximor needs to determine which customer invoice or invoices this payment belongs to."
            figureOut="Which Lumen Labs invoice should receive this $5,000 payment?"
            why="If Maximor guesses, the company's customer balances would be wrong. Leaving the money unmatched is safer than applying it to the wrong bill."
          />
        }
        runBar={
          <>
            <RunBar
              label="Age unpaid invoices"
              running={running}
              onRun={() => run(() => demoApi.runAccountsReceivableAging())}
              extra={
                <>
                  <button className="btn" disabled={running} onClick={() => run(() => demoApi.runCollections())}>
                    Decide collection follow-up
                  </button>
                  <button className="btn" disabled={running} onClick={() => run(() => demoApi.runCashApplication("PAY-004"))}>
                    Match the Lumen Labs payment
                  </button>
                </>
              }
            />
            <ErrorBox error={error} />
          </>
        }
        input={
          <div className="stack">
            <StoryCard title="What came in">
              <p>
                <strong>Lumen Labs payment</strong>
              </p>
              <dl className="kv">
                <dt>Amount</dt>
                <dd>{usd(payment?.amount || 5000)}</dd>
                <dt>Date</dt>
                <dd>{payment?.payment_date || payment?.date || "September 26"}</dd>
                <dt>Bank reference</dt>
                <dd>{payment?.bank_reference || payment?.reference || "ACH-LUMEN-5K"}</dd>
                <dt>Message</dt>
                <dd>“{payment?.remittance_text || payment?.description || "September billing"}”</dd>
              </dl>
              <TraceIds ids={[payment?.payment_id || "PAY-004"]} />
              <SourceArtifactViewer artifact={remittance} />
            </StoryCard>
            <div className="card">
              <h2>Open customer invoices</h2>
              <Definition term="Accounts receivable" />
              <div className="table-scroll">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>What the invoice is for</th>
                      <th className="right">Still unpaid</th>
                      <th>Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.invoices || [])
                      .filter((item: any) => item.outstanding_amount > 0)
                      .map((item: any) => (
                        <tr key={item.invoice_id} className={selected?.invoice_id === item.invoice_id ? "selected" : ""} onClick={() => setSelected(item)}>
                          <td>
                            <div>{item.customer_name}</div>
                            <div className="muted">{formatRecordId(item.invoice_id)}</div>
                          </td>
                          <td>{item.description || "Customer invoice"}</td>
                          <td className="num right">{usd(item.outstanding_amount)}</td>
                          <td>{item.due_date}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
            {selected ? (
              <div className="card">
                <SourceArtifactViewer artifact={{ kind: "customer_invoice", artifact_id: selected.invoice_id, title: `${selected.customer_name} invoice`, source_path: "ar_invoices.json", record: selected }} />
              </div>
            ) : null}
          </div>
        }
        process={inner?.stages?.length ? <ProcessPanel stages={inner?.stages} handoffs={inner?.handoffs} summary={inner?.summary} /> : <ExpectedSteps steps={WORKFLOW_PREVIEWS.ar} />}
        output={
          <div className="stack">
            <div className="card">
              <OutputHeadline
                label="Cash application"
                value={decision ? formatDecision(decision) : "Not run yet"}
                tone={statusTone(decision)}
              />
              <Definition term="Cash application" />
              <ResultBlock
                found={
                  applied.length
                    ? `Maximor applied the ${usd(payment?.amount || 5000)} Lumen Labs payment to ${applied.map(formatRecordId).join(" and ")}.`
                    : decision
                      ? "Maximor could not identify a matching invoice with enough evidence. The $5,000 remains recorded as an unmatched customer payment."
                      : "Run cash application to see whether Maximor can safely attach this $5,000 to a Lumen Labs invoice."
                }
                why={
                  applied.length
                    ? "The remittance or amount lined up with those invoices strongly enough to apply automatically."
                    : "Lumen Labs has more than one open $5,000 invoice, and the payment message only says “September billing.” Guessing would mark the wrong invoice as paid."
                }
                result={
                  applied.length
                    ? "Those customer invoices are now reduced by the applied amount."
                    : "The money is on the books as unapplied cash — received, but not yet tied to a specific bill."
                }
              />
              <TraceIds ids={[payment?.payment_id, ...applied]} />
            </div>
            <div className="card">
              <h2>Invoice aging</h2>
              <Definition term="Aging bucket" />
              <p className="muted">
                Invoice aging groups unpaid customer invoices by how long they have been outstanding. An invoice that was due 75 days ago belongs in the 61–90 day group. Older balances are more concerning, since customers are taking longer to pay.
              </p>
              <p>
                Most of the company's unpaid customer invoices are still current ({usd(current)} of {usd(outstanding)}),
                {overdue90 > 0 ? ` but ${usd(overdue90)} has been outstanding for more than 90 days.` : " and nothing is more than 90 days overdue."}
              </p>
              {BUCKETS.map((key) => (
                <div className="split" key={key} style={{ marginBottom: 6 }}>
                  <span>
                    <GlossaryTerm term="Aging">{AGING_COPY[key]}</GlossaryTerm>
                  </span>
                  <span className="num">{usd(buckets[key])}</span>
                </div>
              ))}
              <p className="muted" style={{ marginTop: 10 }}>
                The Collections agent looks at overdue invoices and decides which customers need follow-up. The Cash Application agent matches money received from customers to the invoices those customers were paying.
              </p>
            </div>
            <div className="card">
              <h2>Customer payments on the books</h2>
              {(data.payments || []).slice(0, 8).map((item: any) => (
                <div className="split" key={item.payment_id} style={{ marginBottom: 8 }}>
                  <div>
                    <div>{item.payer_name || "Customer payment"}</div>
                    <div className="muted">{item.remittance_text || "No remittance message"}</div>
                    <TraceIds ids={[item.payment_id]} />
                  </div>
                  <div className="right">
                    <div className="num">{usd(item.amount)}</div>
                    <Pill tone={statusTone(item.application_status)}>{formatStatus(item.application_status)}</Pill>
                  </div>
                </div>
              ))}
            </div>
          </div>
        }
      />
    </div>
  );
}
