import { useEffect, useMemo, useState } from "react";
import { usd } from "../api";
import { demoApi } from "../demoClient";
import { useWorkflow } from "../hooks";
import { ErrorBox, Pill, RunBar } from "../layout/Shell";
import { DemoLayout, OutputHeadline, ProcessPanel } from "../components/Demo";
import { DocumentLetter, ExpectedSteps, SamplePicker, WORKFLOW_PREVIEWS } from "../components/Presentation";
import { Definition, ResultBlock, WhatsHappening } from "../components/Explain";
import { formatStatus } from "../copy";
import { DEFAULT_INBOX_SAMPLE, GROUP_LABELS, INBOX_DOCUMENTS, INBOX_DOCUMENTS_BY_ID, type InboxDocument } from "../data/inboxDocuments";

function mergeSamples(catalog: any): InboxDocument[] {
  const extras = (catalog?.samples || []).filter((item: any) => item?.sample_id && !INBOX_DOCUMENTS_BY_ID[item.sample_id]);
  const featured = INBOX_DOCUMENTS.map((doc) => {
    const api = (catalog?.samples || []).find((item: any) => item.sample_id === doc.sample_id) || {};
    return {
      ...doc,
      from: api.from || doc.from,
      sent_at: api.sent_at || doc.sent_at,
    };
  });
  return [
    ...featured,
    ...extras.map((item: any) => ({
      sample_id: item.sample_id,
      title: item.subject || item.title || "Incoming finance document",
      kind: item.kind || "other",
      looks_like: item.looks_like || item.kind || "Incoming document",
      description: item.test || item.preview || "Incoming finance document.",
      test: item.test || "See whether Maximor treats this as a vendor bill.",
      group: "needs_investigation" as const,
      from: item.from || "Unknown sender",
      to: "ap@maximor.example",
      sent_at: item.sent_at || "",
      body: item.preview || "",
    })),
  ];
}

export default function Inbox() {
  const [catalog, setCatalog] = useState<any>({ samples: INBOX_DOCUMENTS });
  const [selected, setSelected] = useState<string>(DEFAULT_INBOX_SAMPLE);
  const { running, result, error, source, run, setResult } = useWorkflow();

  useEffect(() => {
    demoApi.loadInbox().then(setCatalog).catch(() => setCatalog({ samples: INBOX_DOCUMENTS }));
  }, [result]);

  const samples = useMemo(() => mergeSamples(catalog), [catalog]);
  const doc = INBOX_DOCUMENTS_BY_ID[selected] || samples.find((item) => item.sample_id === selected) || samples[0];
  const inner = result?.result;
  const io = inner?.io;
  const outputs = io?.outputs;
  const isSort = inner?.classification === "inbox_sort" || Array.isArray(inner?.groups);
  const belongsToSelection = isSort || !inner?.sample_id || inner.sample_id === selected;
  const classification = belongsToSelection ? outputs?.classification || inner?.classification : undefined;
  const isInvoice = Boolean(belongsToSelection && (outputs?.is_invoice || classification === "invoice"));
  const extracted = displayExtracted(belongsToSelection ? inner?.extracted : undefined, doc);

  return (
    <DemoLayout
      eyebrow="Inbox"
      title="What just arrived in finance email?"
      task="Maximor reads incoming finance emails and attachments and decides whether they are invoices, quotes, receipts, or something else — before anyone books a bill."
      source={source}
      happening={
        <WhatsHappening
          happening="Vendors send many kinds of documents. A quote looks like a bill, a statement lists old invoices, and a receipt is proof of a purchase already made. Maximor has to classify first."
          figureOut="Is this document a vendor invoice Maximor should put on the books?"
          why="Treating a quote as a bill would create a fake amount owed."
        />
      }
      runBar={
        <>
          <RunBar
            label="Identify this document"
            running={running}
            onRun={() => run(() => demoApi.identifyDocument(selected))}
            extra={
              <button className="btn" disabled={running} onClick={() => run(() => demoApi.sortInbox())}>
                Sort the inbox
              </button>
            }
          />
          <ErrorBox error={error} />
          <div className="card" style={{ marginBottom: 14 }}>
            <SamplePicker samples={samples} selected={selected} onSelect={(id) => { setSelected(id); setResult(null); }} />
          </div>
        </>
      }
      input={
        <div className="card">
          <Definition term="Vendor invoice" />
          {doc ? <DocumentLetter doc={doc} /> : <p className="muted">Select a document from the list.</p>}
        </div>
      }
      process={
        belongsToSelection && inner?.stages?.length ? (
          <ProcessPanel stages={inner.stages} handoffs={inner.handoffs} summary={inner.summary} />
        ) : (
          <ExpectedSteps steps={WORKFLOW_PREVIEWS.inbox} />
        )
      }
      output={
        belongsToSelection && isSort ? (
          <div className="card">
            <OutputHeadline label="Inbox sort" value={`${(inner.items || samples).length} documents`} />
            <ResultBlock
              found="Document Intake read each sample and grouped them by whether they create money the company owes."
              why="Quotes, receipts, statements, and purchase orders must not be booked as bills."
              result={inner?.what_changed || outputs?.what_changed || "No ledgers were rewritten. This pass only identified which documents are vendor bills and which are not."}
            />
            {(inner.groups || []).map((group: any) => (
              <div key={group.id} style={{ marginTop: 12 }}>
                <h2>{group.label || GROUP_LABELS[group.id as keyof typeof GROUP_LABELS]}</h2>
                <ul className="plain-list">
                  {(group.items || []).map((item: any) => (
                    <li key={item.sample_id}>
                      <button className="linkish" onClick={() => setSelected(item.sample_id)}>
                        {item.title}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : belongsToSelection && inner ? (
          <div className="card">
            <OutputHeadline label="Is this a vendor invoice?" value={formatStatus(isInvoice ? "invoice" : classification)} />
            <ResultBlock
              found={
                isInvoice
                  ? "Document Intake identified this as a vendor invoice and extracted the fields needed to book a bill."
                  : `Document Intake identified this as ${article(formatStatus(classification).toLowerCase())}.`
              }
              why={inner.classification_reason || doc?.test || "A quote, statement, or receipt should not create money the company owes."}
              result={inner.what_changed || outputs?.what_changed || ((inner.record_ids || []).length ? "A vendor bill was created from this document and handed to Accounts Payable." : "No vendor bill was created.")}
            />
            <dl className="kv">
              <dt>Document type</dt>
              <dd>
                <Pill>{formatStatus(classification)}</Pill>
              </dd>
              <dt>Vendor</dt>
              <dd>{extracted.vendor}</dd>
              <dt>{extracted.numberLabel}</dt>
              <dd>{extracted.number}</dd>
              <dt>Amount</dt>
              <dd>{extracted.amount}</dd>
              <dt>Purchase order</dt>
              <dd>{extracted.po}</dd>
            </dl>
          </div>
        ) : (
          <div className="card">
            <OutputHeadline label="What will appear here" value="Not run yet" />
            <p>
              Click <strong>Identify this document</strong> to see whether Maximor treats “{doc?.title}” as a vendor bill.
            </p>
            <p className="muted">{doc?.test}</p>
            <p className="muted">This column will then show the document type, whether a payable was created, and the extracted vendor, invoice number, and amount.</p>
          </div>
        )
      }
    />
  );
}

function article(label: string) {
  const word = String(label || "document").replace(/^an? /, "");
  return /^[aeiou]/i.test(word) ? `an ${word}` : `a ${word}`;
}

function blank(value: unknown) {
  return value == null || value === "" || value === "—";
}

function attachmentFields(doc?: InboxDocument) {
  return Object.fromEntries(doc?.attachment?.fields || []);
}

function moneyFromLabel(raw?: string) {
  if (!raw) return undefined;
  const n = Number(String(raw).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

function displayExtracted(extracted: any, doc?: InboxDocument) {
  const fields = attachmentFields(doc);
  const vendor = !blank(extracted?.vendor) ? extracted.vendor : fields.Vendor || (doc?.from || "").split("<")[0].trim() || "—";
  const number = !blank(extracted?.invoice_number)
    ? extracted.invoice_number
    : !blank(extracted?.vendor_invoice_number)
      ? extracted.vendor_invoice_number
      : fields["Invoice number"] || fields["Quote number"] || fields["Receipt number"] || fields["PO number"] || "—";
  const amountValue = !blank(extracted?.amount)
    ? Number(extracted.amount)
    : moneyFromLabel(fields["Amount due"] || fields["Quoted amount"] || fields["Amount paid"] || fields["Authorized amount"] || fields["Balance brought forward"]);
  const po = !blank(extracted?.po_number) ? extracted.po_number : !blank(extracted?.po_id) ? extracted.po_id : fields["Purchase order"] || "—";
  const kind = String(doc?.kind || extracted?.classification || "").toLowerCase();
  const numberLabel = kind === "quote" ? "Quote number" : kind === "receipt" ? "Receipt number" : kind === "purchase_order" ? "Purchase order number" : "Invoice number";
  return {
    vendor: vendor || "—",
    number: number || "—",
    numberLabel,
    amount: amountValue != null && Number.isFinite(amountValue) ? usd(amountValue) : "—",
    po: po || "—",
  };
}
