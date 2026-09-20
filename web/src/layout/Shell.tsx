import { NavLink, useLocation } from "react-router-dom";
import { Fragment, ReactNode, useEffect, useState } from "react";
import { statusTone } from "../api";
import { demoApi } from "../demoClient";
import { useHealth } from "../hooks";
import { formatAgent, formatExecution, formatFieldKey, formatPeriod, formatStatus, formatSummary } from "../copy";

const PRIMARY = [
  ["/", "Home"],
  ["/architecture", "How they work"],
  ["/workflow", "One invoice"],
  ["/memory", "Saved decisions"],
  ["/simulations", "Simulations"],
  ["/videos", "Videos"],
  ["/coverage", "What it covers"],
  ["/evaluations", "Evaluation"],
];

const SECONDARY = [
  ["/inbox", "Inbox"],
  ["/ap", "Bills to pay"],
  ["/ar", "Customer invoices"],
  ["/cash", "Bank vs books"],
  ["/stripe", "Stripe"],
  ["/close", "Finish the month"],
  ["/forecast", "Cash outlook"],
  ["/audit", "Control tests"],
  ["/agents", "Team activity"],
];

export function Shell({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<any>(null);
  const [resetting, setResetting] = useState(false);
  const live = useHealth();
  const location = useLocation();

  useEffect(() => {
    demoApi.loadStatus().then(setStatus).catch(() => setStatus(null));
  }, [location.pathname]);

  async function resetBooks() {
    setResetting(true);
    try {
      await demoApi.resetBooks();
      window.location.reload();
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            Maxi<span>mor</span>
          </div>
          <div className="brand-sub">Office of the CFO</div>
        </div>
        <div className="top-meta">
          <span>
            Company <strong>{typeof status?.company === "string" ? status.company : status?.company?.legal_name || status?.company?.company?.legal_name || "Maximor Demo Corp"}</strong>
          </span>
          <span>
            Accounting month <strong>{formatPeriod(status?.period || "2026-09")}</strong>
          </span>
          <span className={`pill ${statusTone(status?.system_status)}`}>{formatStatus(status?.system_status || "operational")}</span>
          <span className={`pill ${status?.autonomy?.live_llm ? "warn" : "ok"}`}>
            {formatExecution(status?.autonomy?.execution || "kernel-deterministic")}
          </span>
          <span className={`pill ${status?.stripe?.mode === "live" ? "warn" : "info"}`}>
            Stripe {formatStatus(status?.stripe?.mode || "simulated")}
          </span>
          <span className={`pill ${live ? "ok" : "warn"}`}>{live ? "Live office" : "Saved demo"}</span>
        </div>
      </header>
      <aside className="sidebar">
        <div>
          <div className="nav-label">Showcase</div>
          {PRIMARY.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
              {label}
            </NavLink>
          ))}
        </div>
        <div>
          <div className="nav-label">Live office</div>
          {SECONDARY.map(([to, label]) => (
            <NavLink key={to} to={to} className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
              {label}
            </NavLink>
          ))}
          <button className="nav-link" style={{ width: "100%", background: "transparent", border: 0, textAlign: "left" }} onClick={resetBooks} disabled={resetting}>
            {resetting ? "Resetting…" : "Reset books"}
          </button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}

export function PageHead({ eyebrow, title, lede }: { eyebrow: string; title: string; lede?: string }) {
  return (
    <div className="page-head">
      <div className="eyebrow">{eyebrow}</div>
      <h1>{title}</h1>
      {lede ? <p className="lede">{lede}</p> : null}
    </div>
  );
}

export function Pill({ children, tone }: { children: ReactNode; tone?: string }) {
  return <span className={`pill ${tone || "neutral"}`}>{children}</span>;
}

export function RunBar({
  label,
  running,
  onRun,
  extra,
}: {
  label: string;
  running: boolean;
  onRun: () => void;
  extra?: ReactNode;
}) {
  return (
    <div className="toolbar">
      <div className="btn-row">
        <button className="btn primary" onClick={onRun} disabled={running}>
          {running ? "Running…" : label}
        </button>
        {extra}
      </div>
      {running ? <Pill tone="warn">Checking the work…</Pill> : null}
    </div>
  );
}

export function Stages({ stages }: { stages?: any[] }) {
  if (!stages?.length) return null;
  return (
    <div className="stages">
      {stages.map((stage) => (
        <div className="stage" key={stage.id || stage.label}>
          <div className={`stage-dot ${stage.status || "completed"}`} />
          <div className="stage-copy">
          <div>
            {formatSummary(stage.label)} {stage.bot ? <Pill>{formatAgent(stage.bot)}</Pill> : null}
          </div>
          {stage.detail ? <div className="muted">{formatSummary(stage.detail)}</div> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ErrorBox({ error }: { error: string | null }) {
  if (!error) return null;
  const unavailable =
    /not found/i.test(error) ||
    /unknown api route/i.test(error) ||
    /did not match a route/i.test(error) ||
    /method not allowed/i.test(error) ||
    /failed to fetch/i.test(error) ||
    /demo api unavailable/i.test(error) ||
    /internal server error/i.test(error) ||
    /timed out/i.test(error) ||
    /timeout/i.test(error) ||
    /aborted/i.test(error);
  return (
    <div className="notice notice-top">
      {unavailable ? "Live agent run unavailable. Showing the saved demonstration result if one is available." : error}
    </div>
  );
}

export function SourceBadge({ source }: { source?: "live" | "saved" | null }) {
  if (!source) return null;
  return <span className={`source-badge ${source}`}>{source === "live" ? "Live run" : "Saved demo result"}</span>;
}

export function JsonBlock({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <div className="muted">None</div>;
  if (typeof value !== "object") return <div>{String(value)}</div>;
  const entries = Object.entries(value as Record<string, unknown>).slice(0, 12);
  if (!entries.length) return <div className="muted">None</div>;
  return (
    <dl className="kv">
      {entries.map(([key, item]) => (
        <Fragment key={key}>
          <dt>{formatFieldKey(key)}</dt>
          <dd>{typeof item === "object" ? "See explanation above" : formatStatus(item)}</dd>
        </Fragment>
      ))}
    </dl>
  );
}
