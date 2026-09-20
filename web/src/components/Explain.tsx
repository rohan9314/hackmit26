import { ReactNode } from "react";
import { formatRecordId, GLOSSARY } from "../copy";
import { FriendlyRaw } from "./Demo";

export function WhatsHappening({
  happening,
  figureOut,
  why,
}: {
  happening: ReactNode;
  figureOut?: ReactNode;
  why?: ReactNode;
}) {
  return (
    <div className="card story-card happening-card">
      <h2>What's happening?</h2>
      <p>{happening}</p>
      {figureOut ? (
        <>
          <h2>What Maximor needs to figure out</h2>
          <p>{figureOut}</p>
        </>
      ) : null}
      {why ? (
        <>
          <h2>Why it matters</h2>
          <p>{why}</p>
        </>
      ) : null}
    </div>
  );
}

export function StoryCard({
  title = "About this scenario",
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className="card story-card">
      <h2>{title}</h2>
      {children}
    </div>
  );
}

export function DecisionExplanation({
  decision,
  reason,
  evidence,
  effect,
}: {
  decision?: ReactNode;
  reason?: ReactNode;
  evidence?: ReactNode;
  effect?: ReactNode;
}) {
  return (
    <div className="result-block">
      {decision ? (
        <section>
          <h2>Decision</h2>
          <p>{decision}</p>
        </section>
      ) : null}
      {reason ? (
        <section>
          <h2>Reason</h2>
          <p>{reason}</p>
        </section>
      ) : null}
      {evidence ? (
        <section>
          <h2>Evidence</h2>
          {evidence}
        </section>
      ) : null}
      {effect ? (
        <section>
          <h2>Effect</h2>
          <p>{effect}</p>
        </section>
      ) : null}
    </div>
  );
}

export function ResultBlock({
  found,
  why,
  evidence,
  result,
}: {
  found?: ReactNode;
  why?: ReactNode;
  evidence?: ReactNode;
  result?: ReactNode;
}) {
  return <DecisionExplanation decision={found} reason={why} evidence={evidence} effect={result} />;
}

export function AgentAction({
  agent,
  did,
  why,
  next,
}: {
  agent: ReactNode;
  did: ReactNode;
  why?: ReactNode;
  next?: ReactNode;
}) {
  return (
    <div className="result-block agent-action">
      <section>
        <h2>Agent</h2>
        <p>{agent}</p>
      </section>
      <section>
        <h2>What it did</h2>
        <p>{did}</p>
      </section>
      {why ? (
        <section>
          <h2>Why</h2>
          <p>{why}</p>
        </section>
      ) : null}
      {next ? (
        <section>
          <h2>Who receives the result next</h2>
          <p>{next}</p>
        </section>
      ) : null}
    </div>
  );
}

export function ExceptionCard({
  problem,
  evidence,
  response,
  effect,
}: {
  problem: ReactNode;
  evidence?: ReactNode;
  response?: ReactNode;
  effect?: ReactNode;
}) {
  return (
    <div className="result-block exception-card">
      <section>
        <h2>Problem</h2>
        <p>{problem}</p>
      </section>
      {evidence ? (
        <section>
          <h2>Evidence</h2>
          {typeof evidence === "string" ? <p>{evidence}</p> : evidence}
        </section>
      ) : null}
      {response ? (
        <section>
          <h2>System response</h2>
          <p>{response}</p>
        </section>
      ) : null}
      {effect ? (
        <section>
          <h2>Financial effect</h2>
          <p>{effect}</p>
        </section>
      ) : null}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  interpretation,
  change,
  driver,
}: {
  label: string;
  value: ReactNode;
  interpretation?: ReactNode;
  change?: ReactNode;
  driver?: ReactNode;
}) {
  return (
    <div className="metric">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      {interpretation ? <div className="metric-note">{interpretation}</div> : null}
      {change ? <div className="metric-note">{change}</div> : null}
      {driver ? <div className="metric-note">{driver}</div> : null}
    </div>
  );
}

export function GlossaryTerm({ term, children }: { term: string; children?: ReactNode }) {
  const definition = GLOSSARY[term];
  if (!definition) return <>{children || term}</>;
  return (
    <abbr className="term" title={definition}>
      {children || term}
    </abbr>
  );
}

function friendlyRecordId(id: string) {
  if (id.startsWith("BANK-po_1Maximor") || id.startsWith("po_1Maximor")) {
    const kind = id.replace(/^BANK-/, "").replace(/^po_1Maximor/, "").toLowerCase();
    const payout =
      kind === "fees"
        ? "Stripe payout with processing fees"
        : kind === "refunds"
          ? "Stripe payout with refunds"
          : kind === "disputes"
            ? "Stripe payout with disputes"
            : "Stripe payout";
    return id.startsWith("BANK-") ? `Bank deposit for ${payout}` : payout;
  }
  return formatRecordId(id);
}

export function TraceIds({ ids, label = "Supporting records" }: { ids?: Array<string | null | undefined>; label?: string }) {
  const clean = (ids || []).map((item) => String(item || "").trim()).filter(Boolean);
  if (!clean.length) return null;
  return (
    <div className="trace-ids">
      <span className="trace-label">{label}</span>
      <span className="mono muted">{clean.map(friendlyRecordId).join(" · ")}</span>
    </div>
  );
}

export function LineageChain({ steps }: { steps?: Array<{ title?: string; detail?: string; record_id?: string; role?: string }> }) {
  if (!steps?.length) return null;
  return (
    <ol className="lineage-chain">
      {steps.map((step, index) => (
        <li key={`${step.record_id || step.title}-${index}`}>
          <div className="lineage-title">{step.title || step.role}</div>
          <div>{step.detail}</div>
          {step.record_id ? <TraceIds ids={[step.record_id]} label="Record" /> : null}
        </li>
      ))}
    </ol>
  );
}

export function DevDetails({ raw, children }: { raw: unknown; children: ReactNode }) {
  return (
    <FriendlyRaw
      raw={raw}
      defaultTab="friendly"
      friendlyLabel="Explanation"
      rawLabel="More fields"
      friendly={children}
    />
  );
}

export function Definition({ term }: { term: string }) {
  const definition = GLOSSARY[term];
  if (!definition) return null;
  return (
    <p className="muted definition">
      <strong>{term}.</strong> {definition}
    </p>
  );
}
