import { Fragment, ReactNode } from "react";
import { GROUP_LABELS, type InboxDocument, type InboxGroup } from "../data/inboxDocuments";
import { formatDateTime, formatFieldKey, formatRecordId, formatPeriod, formatStatus, looksLikeId } from "../copy";
import { Pill } from "../layout/Shell";

export function SavedDemoBadge({ show }: { show?: boolean }) {
  if (!show) return null;
  return <div className="saved-demo-badge">Saved demo result</div>;
}

export function DocumentLetter({ doc }: { doc: InboxDocument }) {
  const attachment = doc.attachment;
  return (
    <div className="document-letter">
      <div className="letter-head">
        <div className="letter-kicker">Incoming finance email</div>
        <h3>{doc.title}</h3>
        {doc.description ? <p className="muted">{doc.description}</p> : null}
      </div>
      <dl className="kv">
        <dt>From</dt>
        <dd>{doc.from}</dd>
        <dt>To</dt>
        <dd>Accounts payable</dd>
        <dt>Subject</dt>
        <dd>{doc.title}</dd>
        <dt>Date</dt>
        <dd>{formatDateTime(doc.sent_at)}</dd>
      </dl>
      {attachment ? (
        <div className="letter-body">
          <div className="doc-paper">
            <div className="split">
              <strong>{attachment.heading}</strong>
              <span className="muted">{attachment.filename}</span>
            </div>
            <dl className="kv">
              {attachment.fields.map(([label, value]) => (
                <Fragment key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </Fragment>
              ))}
            </dl>
            {(attachment.lines || []).map((line) => (
              <p key={line}>{line}</p>
            ))}
            {attachment.note ? <p className="muted">{attachment.note}</p> : null}
          </div>
        </div>
      ) : null}
      <div className="doc-paper">
        <pre>{doc.body}</pre>
      </div>
      <p className="muted" style={{ marginTop: 10 }}>
        What you are testing. {doc.test}
      </p>
    </div>
  );
}

export function SamplePicker({
  samples,
  selected,
  onSelect,
}: {
  samples: InboxDocument[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  const groups = (Object.keys(GROUP_LABELS) as InboxGroup[]).map((id) => ({
    id,
    label: GROUP_LABELS[id],
    rows: samples.filter((item) => item.group === id),
  }));
  return (
    <div className="sample-picker">
      <h2>Documents to try</h2>
      <p className="muted sample-picker-lede">
        Click a document to open it, then identify it. Each example tests a different kind of finance mail.
      </p>
      {groups.map((group) =>
        group.rows.length ? (
          <div className="sample-group" key={group.id}>
            <div className="sample-group-label">{group.label}</div>
            <div className="sample-grid">
              {group.rows.map((item) => (
                <button
                  type="button"
                  key={item.sample_id}
                  className={`sample-card${item.sample_id === selected ? " selected" : ""}`}
                  onClick={() => onSelect(item.sample_id)}
                >
                  <div className="sample-card-top">
                    <strong>{item.title}</strong>
                    <Pill>{formatStatus(item.kind)}</Pill>
                  </div>
                  <p>{item.description || item.looks_like}</p>
                  <p className="muted">What you are testing. {item.test}</p>
                </button>
              ))}
            </div>
          </div>
        ) : null,
      )}
    </div>
  );
}

export function FieldList({ row }: { row: unknown }) {
  if (row == null) return <p className="muted">No extra fields.</p>;
  if (typeof row !== "object") return <p>{String(row)}</p>;
  const skip = new Set(["raw_metadata", "lines", "attachments", "source_path", "content_hash", "checksum", "bytes", "mime", "artifact_id", "raw"]);
  const entries = Object.entries(row as Record<string, unknown>).filter(([key, value]) => !skip.has(key) && value !== null && value !== undefined && value !== "");
  if (!entries.length) return <p className="muted">No extra fields.</p>;
  return (
    <dl className="kv">
      {entries.slice(0, 16).map(([key, value]) => (
        <Fragment key={key}>
          <dt>{formatFieldKey(key)}</dt>
          <dd>{plainValue(value, key)}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

export function ExpectedSteps({
  steps,
}: {
  steps: Array<{ id: string; label: string; bot?: string }>;
}) {
  return (
    <div className="card process-card">
      <p>After you run this, this column lists each agent in order and what it decided.</p>
      <ol className="plain-list expected-steps">
        {steps.map((step) => (
          <li key={step.id}>{step.label}</li>
        ))}
      </ol>
    </div>
  );
}

export const WORKFLOW_PREVIEWS: Record<string, Array<{ id: string; label: string }>> = {
  inbox: [
    { id: "received", label: "Document Intake reads the email and attachment." },
    { id: "classified", label: "Document Intake identifies whether this is an invoice, quote, receipt, statement, or purchase order." },
    { id: "fields", label: "Accounts Payable checks whether the company actually owes money." },
  ],
  ap: [
    { id: "facts", label: "Accounts Payable gathers the invoice, purchase order, and delivery record." },
    { id: "match", label: "It checks whether they agree and whether this is a second copy." },
    { id: "concur", label: "Payables Control independently rechecks an uncertain bill." },
  ],
  ar: [
    { id: "apply", label: "Cash Application tries to match the customer payment to open invoices." },
    { id: "verify", label: "Cash Control rechecks an uncertain match instead of guessing." },
  ],
  cash: [
    { id: "candidates", label: "Cash Reconciliation lists possible bank-to-ledger matches." },
    { id: "decide", label: "It matches only where evidence supports it." },
    { id: "verify", label: "Cash Control rechecks unresolved differences." },
  ],
  stripe: [
    { id: "unpack", label: "Stripe intake unpacks the payout into charges, refunds, fees, and disputes." },
    { id: "bank", label: "Cash Reconciliation ties the explained payout to the bank deposit." },
  ],
  close: [
    { id: "accrual", label: "Close estimates expenses that belong in the month before the bill arrives." },
    { id: "lock", label: "Books Control decides whether the month is actually ready to lock." },
  ],
  forecast: [
    { id: "sources", label: "Reporting collects expected collections, vendor payments, and payroll." },
    { id: "decide", label: "It projects cash on hand for each of the next 13 weeks." },
  ],
  audit: [
    { id: "sample", label: "Audit samples invoices, payments, journals, and approvals." },
    { id: "findings", label: "It writes findings with source evidence." },
  ],
  memory: [
    { id: "memory", label: "Close retrieves the prior-period Harbor Electric decision." },
    { id: "evidence", label: "It re-checks September's bills and contract before reusing that precedent." },
  ],
};

function plainValue(value: unknown, key?: string): ReactNode {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") {
    if (key === "confidence") {
      const pct = value <= 1 ? Math.round(value * 100) : Math.round(value);
      return `${pct}%`;
    }
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.length
      ? value.map((item) => (item && typeof item === "object" ? "See explanation above" : plainValue(item, key))).join(", ")
      : "—";
  }
  if (typeof value === "object" && value) return "See explanation above";
  const text = String(value ?? "—");
  if (looksLikeId(text) || text.startsWith("po_1Maximor") || text.startsWith("BANK-po_1Maximor")) return formatRecordId(text);
  if (key === "period" || /^\d{4}-\d{2}$/.test(text)) return formatPeriod(text);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return formatDateTime(text);
  return formatStatus(value);
}
