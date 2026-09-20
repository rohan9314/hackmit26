import { ReactNode, useState } from "react";
import { Link } from "react-router-dom";
import { usd, statusTone } from "../api";
import { formatDateTime, formatFieldKey, formatHandoff, formatPeriod, formatRecordId, formatRecordType, formatStage, formatStatus, formatSummary, looksLikeId } from "../copy";
import { FieldList } from "./Presentation";
import { ErrorBox, Pill, Stages, SourceBadge } from "../layout/Shell";

export function DemoLayout({
  eyebrow,
  title,
  task,
  happening,
  input,
  output,
  process,
  extra,
  runBar,
  error,
  source,
}: {
  eyebrow: string;
  title: string;
  task: string;
  happening?: ReactNode;
  input: ReactNode;
  output: ReactNode;
  process?: ReactNode;
  extra?: ReactNode;
  runBar?: ReactNode;
  error?: string | null;
  source?: "live" | "saved" | null;
}) {
  return (
    <div className="demo-page">
      <div className="page-head">
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p className="lede">{task}</p>
      </div>
      <ErrorBox error={error} />
      {happening}
      {runBar}
      {source ? (
        <div className="source-row">
          <SourceBadge source={source} />
          {source === "saved" ? <span className="muted">Live agent run unavailable. Showing the saved demonstration result.</span> : null}
        </div>
      ) : null}
      <div className="io-flow" aria-label="What arrived, what the agents did, and what changed">
        <div className="io-col input-col">
          <div className="io-label">What arrived</div>
          {input}
        </div>
        <div className="io-arrow" aria-hidden>
          →
        </div>
        <div className="io-col process-col">
          <div className="io-label">What the agents did</div>
          {process || <p className="muted">Run the workflow to see each agent step in order.</p>}
        </div>
        <div className="io-arrow" aria-hidden>
          →
        </div>
        <div className="io-col output-col">
          <div className="io-label">What changed</div>
          {output}
        </div>
      </div>
      {extra}
    </div>
  );
}

export function ProvenanceLinks({ links }: { links?: any[] }) {
  if (!links?.length) return null;
  return (
    <div className="provenance">
      {links.filter(Boolean).map((link, idx) => {
        const id = String((typeof link === "string" ? link : link.id || link.record_id) || "").trim();
        const kind = typeof link === "string" ? "" : link.kind;
        const href = hrefFor(id, kind);
        return (
          <span key={`${id}-${idx}`}>
            {idx > 0 ? <span className="muted"> → </span> : null}
            {href ? (
              <Link className="mono" to={href}>
                {provenanceLabel(id)}
              </Link>
            ) : (
              <span className="mono">{provenanceLabel(id)}</span>
            )}
          </span>
        );
      })}
    </div>
  );
}

function provenanceLabel(id?: string) {
  return formatRecordId(id) || String(id || "").trim();
}

function hrefFor(id?: string, kind?: string): string | null {
  if (!id) return null;
  if (kind === "email" || String(id).startsWith("MSG-")) return "/inbox";
  if (String(id).startsWith("INV-AR") || kind === "customer_invoice") return "/ar";
  if (String(id).startsWith("INV-") || kind === "invoice" || kind === "purchase_order" || kind === "goods_receipt") return "/ap";
  if (String(id).startsWith("TXN-") || kind === "bank_transaction" || kind === "ledger_entry") return "/cash";
  if (String(id).startsWith("po_") || kind === "stripe_payout") return "/stripe";
  if (String(id).startsWith("JE-") || String(id).startsWith("TASK-") || String(id).startsWith("ACC-")) return "/close";
  if (String(id).startsWith("MEM-") || kind === "decision_memory") return "/memory";
  return null;
}

export function FriendlyRaw({
  friendly,
  raw,
  defaultTab = "friendly",
  friendlyLabel = "Explanation",
  rawLabel = "More fields",
}: {
  friendly: ReactNode;
  raw: unknown;
  defaultTab?: "friendly" | "raw";
  friendlyLabel?: string;
  rawLabel?: string;
}) {
  const [tab, setTab] = useState(defaultTab);
  return (
    <div>
      <div className="tabs">
        <button className={tab === "friendly" ? "tab on" : "tab"} onClick={() => setTab("friendly")}>
          {friendlyLabel}
        </button>
        <button className={tab === "raw" ? "tab on" : "tab"} onClick={() => setTab("raw")}>
          {rawLabel}
        </button>
      </div>
      {tab === "friendly" ? friendly : <FieldList row={raw} />}
    </div>
  );
}

export function BeforeAfterDiff({
  before,
  after,
  fields,
  onlyChanged = false,
  unchangedMessage,
  labelFor,
}: {
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  fields?: string[];
  onlyChanged?: boolean;
  unchangedMessage?: string;
  labelFor?: (key: string) => string;
}) {
  if (!before && !after) return <p className="muted">No persisted before/after snapshot yet.</p>;
  const keys = fields || Array.from(new Set([...Object.keys(before || {}), ...Object.keys(after || {})]));
  const rows = keys.map((key) => {
    const left = formatValue((before || {})[key], key);
    const right = formatValue((after || {})[key], key);
    return { key, left, right, changed: left !== right };
  });
  const visible = onlyChanged ? rows.filter((row) => row.changed) : rows;
  if (onlyChanged && visible.length === 0) {
    return <p className="muted">{unchangedMessage || "Nothing changed between the earlier and later values."}</p>;
  }
  return (
    <div className="table-scroll">
      <table className="data diff">
        <thead>
          <tr>
            <th>What</th>
            <th>Before</th>
            <th>After</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => (
            <tr key={row.key} className={row.changed ? "changed" : ""}>
              <td>{labelFor ? labelFor(row.key) : formatFieldKey(row.key)}</td>
              <td>{row.left}</td>
              <td>{row.right}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatValue(value: unknown, key?: string): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") {
    if (key === "confidence") {
      const pct = value <= 1 ? Math.round(value * 100) : Math.round(value);
      return `${pct}%`;
    }
    if (key && (key.endsWith("_minor") || key.includes("cents"))) return usd(value / 100);
    if (key && /cash|amount|outstanding|payment|inflow|outflow|payroll|expense/.test(key)) return usd(value);
    return String(value);
  }
  if (typeof value === "object") {
    if (Array.isArray(value)) return value.length ? value.map((item) => formatValue(item, key)).join(", ") : "—";
    const row = value as Record<string, unknown>;
    if (row.decision) return formatStatus(row.decision);
    if (row.status) return formatStatus(row.status);
    return "See explanation above";
  }
  const text = String(value);
  if (looksLikeId(text) || text.startsWith("po_1Maximor") || text.startsWith("BANK-po_1Maximor")) return formatRecordId(text);
  if (/^\d{4}-\d{2}(?:-\d{2})?/.test(text) && (key === "period" || key?.includes("date") || key?.includes("_at") || key?.includes("week"))) {
    return key === "period" || /^\d{4}-\d{2}$/.test(text) ? formatPeriod(text) : formatDateTime(text);
  }
  return formatStatus(value);
}

export function ProcessPanel({ stages, handoffs, summary, preview }: { stages?: any[]; handoffs?: any[]; summary?: string; preview?: ReactNode }) {
  const translated = (stages || []).map((stage) => {
    const copy = formatStage(stage);
    return { ...stage, label: copy.label, detail: copy.detail };
  });
  if (!translated.length && !summary && !handoffs?.length) {
    return (
      <div className="card process-card">
        {preview || <p className="muted">After you run this, this column lists each agent in order and what it decided.</p>}
      </div>
    );
  }
  return (
    <div className="card process-card">
      {summary ? <div className="muted" style={{ marginBottom: 8 }}>{formatSummary(summary)}</div> : null}
      <Stages stages={translated} />
      {handoffs?.length ? (
        <div className="handoff-list">
          <p>{formatHandoff(handoffs)}</p>
        </div>
      ) : null}
    </div>
  );
}

export function OutputHeadline({ label, value, tone }: { label: string; value: ReactNode; tone?: string }) {
  return (
    <div className="output-headline">
      <div className="muted">{label}</div>
      <div>
        <Pill tone={tone || statusTone(String(value))}>{value}</Pill>
      </div>
    </div>
  );
}

export function Kv({ rows }: { rows: Array<[string, ReactNode]> }) {
  return (
    <dl className="kv">
      {rows.map(([key, value]) => (
        <div key={key} className="kv-row">
          <dt>{key}</dt>
          <dd>{value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function SourceArtifactViewer({ artifact, compact = false }: { artifact: any; compact?: boolean }) {
  if (!artifact) return <p className="muted">The original document is not attached to this record.</p>;
  const kind = artifact.kind || artifact.record?.kind;
  const record = artifact.record ?? artifact;
  return (
    <div className={`artifact ${compact ? "compact" : ""}`}>
      <div className="split">
        <strong>{formatSummary(artifact.title) || formatRecordLabel(kind) || "Source record"}</strong>
      </div>
      <div className="muted" style={{ marginBottom: 8 }}>
        {formatRecordLabel(kind)}
      </div>
      <FriendlyRaw
        raw={record}
        friendly={
          <>
            {renderFriendly(kind, artifact, record)}
            <ProvenanceLinks links={artifact.provenance} />
          </>
        }
      />
    </div>
  );
}

function renderFriendly(kind: string, artifact: any, record: any) {
  if (kind === "email" || artifact.email) return <EmailView email={artifact.email || record} attachments={artifact.attachments || artifact.email?.attachments} />;
  if (kind === "document") return <DocumentView filename={artifact.filename || record.filename} contentType={artifact.content_type || record.content_type} text={artifact.text ?? record.text} />;
  if (kind === "invoice") return <InvoiceView invoice={record} emails={artifact.source_emails} />;
  if (kind === "purchase_order") return <PoView po={record} />;
  if (kind === "goods_receipt") return <GrView gr={record} />;
  if (kind === "bank_transaction" || kind === "ledger_entry") {
    return (
      <dl className="kv">
        <dt>Bank transaction</dt>
        <dd>{formatRecordId(record.transaction_id || record.entry_id) || record.transaction_id || record.entry_id}</dd>
        <dt>Date</dt>
        <dd>{record.date}</dd>
        <dt>Amount</dt>
        <dd>{usd(record.amount)}</dd>
        <dt>Description</dt>
        <dd>{record.description}</dd>
        <dt>Who it was with</dt>
        <dd>{record.counterparty}</dd>
        <dt>Bank reference</dt>
        <dd className="mono">{record.reference || "—"}</dd>
      </dl>
    );
  }
  if (kind === "stripe_payout" || kind === "stripe_balance_txn") {
    const cents = record.amount;
    return (
      <dl className="kv">
        <dt>Stripe payout</dt>
        <dd>{String(record.payout_id || record.id || "").startsWith("po_1Maximor") ? "Stripe payout to the bank" : record.payout_id || record.id}</dd>
        <dt>What this line is</dt>
        <dd>{formatStatus(record.type || record.source_event_type) || formatRecordType(kind)}</dd>
        <dt>Amount</dt>
        <dd>{typeof cents === "number" ? usd(cents / 100) : "—"}</dd>
        <dt>Bank deposit</dt>
        <dd>{record.bank_deposit_amount != null ? usd(record.bank_deposit_amount) : record.bank_deposit_id || "—"}</dd>
      </dl>
    );
  }
  if (kind === "journal_entry") return <JournalView row={record} />;
  if (kind === "table") return <TableView columns={artifact.columns} rows={artifact.rows || record} />;
  return <RowView row={record} />;
}

function EmailView({ email, attachments }: { email: any; attachments?: any[] }) {
  if (!email) return null;
  return (
    <div>
      <dl className="kv">
        <dt>From</dt>
        <dd>{email.from}</dd>
        <dt>To</dt>
        <dd>{email.to}</dd>
        <dt>Subject</dt>
        <dd>{email.subject}</dd>
        <dt>Timestamp</dt>
        <dd>{formatDateTime(email.sent_at)}</dd>
      </dl>
      <div className="doc-paper">
        <pre>{email.body}</pre>
      </div>
      {(attachments || email.attachments || []).map((att: any) => (
        <DocumentView
          key={att.artifact_id || att.attachment_id || att.filename}
          filename={att.filename || att.title}
          contentType={att.content_type || att.record?.content_type}
          text={att.text || att.record?.text}
        />
      ))}
    </div>
  );
}

function DocumentView({ filename, contentType, text }: { filename?: string; contentType?: string; text?: string }) {
  const isPdf = (contentType || "").includes("pdf") || String(filename || "").toLowerCase().endsWith(".pdf");
  const isImage = (contentType || "").startsWith("image/");
  return (
    <div className="doc-wrap">
      <div className="split">
        <span>{filename || "Document"}</span>
        <span className="muted">{isPdf ? "PDF" : isImage ? "Image" : "Text"}</span>
      </div>
      {isImage && text?.startsWith("data:") ? <img src={text} alt={filename || "source"} className="doc-image" /> : <div className={`doc-paper ${isPdf ? "pdf" : ""}`}><pre>{text || "(empty)"}</pre></div>}
    </div>
  );
}

function InvoiceView({ invoice, emails }: { invoice: any; emails?: any[] }) {
  if (!invoice) return null;
  return (
    <div>
      {emails?.length ? emails.map((item, idx) => <SourceArtifactViewer key={item.artifact_id || item.title || idx} artifact={item} compact />) : null}
      <dl className="kv">
        <dt>Invoice</dt>
        <dd>{formatRecordId(invoice.invoice_id) || invoice.invoice_id}</dd>
        <dt>Vendor</dt>
        <dd>{invoice.vendor}</dd>
        <dt>Vendor invoice #</dt>
        <dd>{invoice.vendor_invoice_number}</dd>
        <dt>Date</dt>
        <dd>{invoice.invoice_date}</dd>
        <dt>Due</dt>
        <dd>{invoice.due_date}</dd>
        <dt>Amount</dt>
        <dd>{usd(invoice.amount)}</dd>
        <dt>Purchase order</dt>
        <dd>{formatRecordId(invoice.po_id) || invoice.po_id || "—"}</dd>
        <dt>Description</dt>
        <dd>{invoice.description}</dd>
      </dl>
    </div>
  );
}

function PoView({ po }: { po: any }) {
  return (
    <dl className="kv">
      <dt>Purchase order</dt>
      <dd>{formatRecordId(po.po_id) || po.po_id}</dd>
      <dt>Vendor</dt>
      <dd>{po.vendor}</dd>
      <dt>Authorized amount</dt>
      <dd>{usd(po.authorized_amount)}</dd>
      <dt>Status</dt>
      <dd>{formatStatus(po.status)}</dd>
      <dt>Approved by</dt>
      <dd>{po.approver}</dd>
      <dt>What was ordered</dt>
      <dd>{po.description}</dd>
    </dl>
  );
}

function GrView({ gr }: { gr: any }) {
  return (
    <dl className="kv">
      <dt>Delivery record</dt>
      <dd>{formatRecordId(gr.receipt_id) || gr.receipt_id}</dd>
      <dt>Purchase order</dt>
      <dd>{formatRecordId(gr.po_id) || gr.po_id}</dd>
      <dt>Did it arrive?</dt>
      <dd>{gr.received === true || String(gr.received).toLowerCase() === "true" ? "Yes" : gr.received === false ? "No" : formatStatus(gr.received)}</dd>
      <dt>Quantity ordered</dt>
      <dd>{gr.quantity_ordered}</dd>
      <dt>Quantity received</dt>
      <dd>{gr.quantity_received}</dd>
      <dt>Amount received</dt>
      <dd>{usd(gr.amount_received)}</dd>
    </dl>
  );
}

function JournalView({ row }: { row: any }) {
  const amount = row.amount ?? (row.amount_minor != null ? row.amount_minor / 100 : null);
  return (
    <dl className="kv">
      <dt>Journal entry</dt>
      <dd>{formatRecordId(row.entry_id) || row.entry_id}</dd>
      <dt>Expense or asset account</dt>
      <dd>{row.debit_account || row.account}</dd>
      <dt>Offset account</dt>
      <dd>{row.credit_account || "—"}</dd>
      <dt>Amount</dt>
      <dd>{usd(amount)}</dd>
      <dt>Why it was recorded</dt>
      <dd>{row.memo || row.description}</dd>
    </dl>
  );
}

function RowView({ row }: { row: any }) {
  if (!row || typeof row !== "object") return <p className="muted">{String(row)}</p>;
  const skip = new Set(["raw_metadata", "lines", "attachments", "source_path", "content_hash", "checksum", "bytes", "mime", "artifact_id"]);
  const entries = Object.entries(row).filter(([key]) => !skip.has(key) && row[key] !== null && row[key] !== undefined && row[key] !== "");
  return (
    <dl className="kv">
      {entries.slice(0, 14).map(([key, value]) => (
        <div key={key} className="kv-row">
          <dt>{formatFieldKey(key)}</dt>
          <dd>{formatValue(value, key)}</dd>
        </div>
      ))}
    </dl>
  );
}

function TableView({ columns, rows }: { columns?: string[]; rows?: any[] }) {
  if (!rows?.length) return <p className="muted">No rows.</p>;
  const cols = columns?.length ? columns : Object.keys(rows[0] || {});
  return (
    <div className="table-scroll">
      <table className="data">
        <thead>
          <tr>
            {cols.map((col) => (
              <th key={col}>{formatFieldKey(col)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={row.invoice_id || row.week_start || idx}>
              {cols.map((col) => (
                <td key={col} className={typeof row[col] === "number" ? "num right" : ""}>
                  {typeof row[col] === "number" && /cash|amount|expense|authorized|payment|inflow|outflow|payroll/.test(col)
                    ? usd(row[col])
                    : formatValue(row[col], col)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ArtifactStack({ artifacts }: { artifacts?: any[] }) {
  if (!artifacts?.length) return <p className="muted">No original input loaded.</p>;
  return (
    <div className="stack">
      {artifacts.filter(Boolean).map((item, idx) => (
        <div className="card" key={item.artifact_id || idx}>
          <SourceArtifactViewer artifact={item} />
        </div>
      ))}
    </div>
  );
}

function formatRecordLabel(kind?: string) {
  return formatRecordType(kind);
}

export function flattenInputs(value: any): any[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(flattenInputs);
  if (value.artifact_id || value.kind) return [value];
  if (typeof value !== "object") return [];
  const nested: any[] = [];
  for (const item of Object.values(value)) {
    nested.push(...flattenInputs(item));
  }
  return nested;
}
