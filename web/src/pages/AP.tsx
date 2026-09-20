import { useEffect, useState } from "react";
import { usd, statusTone } from "../api";
import { demoApi } from "../demoClient";
import { useWorkflow } from "../hooks";
import { ErrorBox, Pill, RunBar } from "../layout/Shell";
import { BeforeAfterDiff, DemoLayout, OutputHeadline, ProcessPanel, ProvenanceLinks, SourceArtifactViewer } from "../components/Demo";
import { ExpectedSteps, WORKFLOW_PREVIEWS } from "../components/Presentation";
import { Definition, ExceptionCard, LineageChain, ResultBlock, TraceIds, WhatsHappening } from "../components/Explain";
import { formatDecision, formatException, formatFieldKey, formatStatus } from "../copy";
import { savedGet } from "../data/savedDemo";

export default function AP() {
  const [rows, setRows] = useState<any[]>(() => savedGet("/api/invoices")?.invoices || []);
  const [detail, setDetail] = useState<any>(() => savedGet("/api/invoices/INV-003"));
  const { running, result, error, source, run } = useWorkflow();
  const selected = detail?.invoice_id || "INV-003";

  useEffect(() => {
    demoApi
      .loadInvoices()
      .then((payload: any) => setRows(payload.invoices || savedGet("/api/invoices")?.invoices || []))
      .catch(() => setRows(savedGet("/api/invoices")?.invoices || []));
  }, [result]);

  async function open(id: string) {
    const saved = savedGet(`/api/invoices/${id}`);
    try {
      const row = await demoApi.loadInvoice(id);
      const arts = row?.three_way?.artifacts || {};
      const hasDocs = Boolean(arts.invoice || arts.purchase_order || row?.source_document || (row?.source_emails || []).length);
      setDetail(hasDocs ? row : { ...saved, ...row, three_way: saved?.three_way, source_document: saved?.source_document });
    } catch {
      setDetail(saved);
    }
  }

  useEffect(() => {
    open("INV-003");
  }, []);

  const inner = result?.result;
  const tw = detail?.three_way?.artifacts || {};
  const io = inner?.io;
  const pair = detail?.duplicate_peer;

  return (
    <DemoLayout
      eyebrow="Accounts payable"
      title="Vendor bills waiting to be paid"
      task="Accounts payable is money the company owes vendors. Maximor checks each bill against the purchase order and the record that goods or services were received before it can go on a payment run."
      source={source}
      happening={
        <WhatsHappening
          happening="A vendor bill is only safe to pay if it matches what was ordered and what actually arrived. Maximor also looks for a second copy of the same bill."
          figureOut="Should this vendor invoice be approved, or held because something does not line up?"
          why="Paying a duplicate or an unauthorized bill would send company cash to the wrong place."
        />
      }
      runBar={
        <>
          <RunBar
            label="Check this vendor bill"
            running={running}
            onRun={() => run(() => demoApi.runAccountsPayable(selected))}
            extra={
              <button className="btn" disabled={running} onClick={() => run(() => demoApi.runPaymentSchedule())}>
                Draft this week's payments
              </button>
            }
          />
          <ErrorBox error={error} />
          <div className="card" style={{ marginBottom: 14 }}>
            <h2>Invoice register</h2>
            <table className="data">
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th className="right">Amount</th>
                  <th>Match</th>
                  <th>Payment</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.invoice_id} className={row.invoice_id === selected ? "selected" : ""} onClick={() => open(row.invoice_id)}>
                    <td>
                      <div>{row.vendor}</div>
                      <TraceIds ids={[row.invoice_id, row.po_id]} />
                    </td>
                    <td className="num right">{usd(row.amount)}</td>
                    <td>
                      <Pill tone={statusTone(row.duplicate_status === "duplicate" ? "duplicate" : row.match_status)}>
                        {row.duplicate_status === "duplicate" ? formatStatus("duplicate") : formatStatus(row.match_status)}
                      </Pill>
                    </td>
                    <td>{formatStatus(row.payment_state)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      }
      input={
        pair?.document_a ? (
          <div className="stack">
            <div className="card">
              <h2>First copy</h2>
              <SourceArtifactViewer artifact={pair.document_a} />
            </div>
            <div className="card">
              <h2>Second copy</h2>
              <SourceArtifactViewer artifact={pair.document_b} />
            </div>
          </div>
        ) : (
          <div className="stack">
            <div className="card">
              <h2>Invoice</h2>
              {(detail?.source_emails || []).map((item: any, idx: number) => (
                <SourceArtifactViewer key={item.artifact_id || item.title || idx} artifact={item} />
              ))}
              {!(detail?.source_emails || []).length ? <SourceArtifactViewer artifact={tw.invoice || detail?.source_document} /> : null}
            </div>
            <div className="match-trio">
              <div className="card">
                <h2>Amount on the bill</h2>
                <div>{detail?.vendor || tw.invoice?.record?.vendor || "Vendor invoice"}</div>
                <div>{usd(tw.invoice?.record?.amount || detail?.amount)}</div>
              </div>
              <div className="card">
                <h2>Purchase order</h2>
                <p className="muted">The company's authorization to buy these goods or services.</p>
                <SourceArtifactViewer artifact={tw.purchase_order} compact />
              </div>
              <div className="card">
                <h2>Delivery record</h2>
                <p className="muted">Proof that the ordered goods or services actually arrived.</p>
                <SourceArtifactViewer artifact={tw.goods_receipt} compact />
              </div>
            </div>
          </div>
        )
      }
      process={inner?.stages?.length ? <ProcessPanel stages={inner?.stages} handoffs={inner?.handoffs} summary={inner?.summary} /> : <ExpectedSteps steps={WORKFLOW_PREVIEWS.ap} />}
      output={
        <div className="stack">
          <div className="card">
            <OutputHeadline label="Payables decision" value={inner?.decision?.decision ? formatDecision(inner.decision.decision) : "Not run yet"} />
            <Definition term="Three-way match" />
            {pair?.comparison ? <Definition term="Duplicate invoice" /> : null}
            {pair?.comparison ? (
              <ExceptionCard
                problem="These two documents look like the same vendor bill sent twice."
                evidence="The vendor, amount, and invoice identity line up closely enough that paying both would mean paying twice for one shipment."
                response="The Accounts Payable Agent held the extra copy and sent the packet to Payables Control to recheck the hold."
                effect="No second amount owed was created, and this copy will not enter a payment run."
              />
            ) : (detail?.exceptions || inner?.evidence?.exception_types || []).length ? (
              <ExceptionCard
                problem={(detail?.exceptions || inner?.evidence?.exception_types || []).map(formatException).join(" ")}
                evidence="The invoice was compared with the purchase order and the record that goods or services were received."
                response="Payment is paused until the mismatch is resolved."
                effect="This bill is not treated as money the company should pay yet."
              />
            ) : (
              <ResultBlock
                found={inner?.explanation?.narrative || inner?.io?.explanation || "Run accounts payable to see whether this bill is safe to pay."}
                why="A vendor bill is only safe to pay if it matches what was ordered and what actually arrived, and is not a second copy of a bill already on file."
                result={inner?.decision?.decision ? formatDecision(inner.decision.decision) : "Not run yet"}
              />
            )}
            {inner?.naive ? <p>{inner.naive}</p> : null}
            <dl className="kv">
              <dt>Duplicate check</dt>
              <dd>{formatStatus(detail?.duplicate_status)}</dd>
              <dt>Payment</dt>
              <dd>{formatStatus(detail?.payment_state)}</dd>
            </dl>
            <LineageChain steps={inner?.lineage?.steps} />
            {(inner?.lineage?.changed || []).map((item: string) => (
              <p key={item}>{item}</p>
            ))}
            <ProvenanceLinks links={detail?.provenance} />
          </div>
          {io?.before || io?.after ? (
            <div className="card">
              <h2>What changed on the books</h2>
              <BeforeAfterDiff before={io.before} after={io.after} fields={["invoice_id", "match_status", "duplicate_status", "payment_state", "accounting_status", "exceptions", "linked_payments", "linked_journals"]} labelFor={formatFieldKey} />
            </div>
          ) : null}
        </div>
      }
    />
  );
}
