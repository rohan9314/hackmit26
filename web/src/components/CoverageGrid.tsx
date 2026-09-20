import { Link } from "react-router-dom";
import { GlossaryTerm } from "./Explain";
import { AGENTS_BY_SLUG } from "../data/agents";
import { CAPABILITIES } from "../data/capabilities";

export function CoverageGrid({ compact = false, intro = true }: { compact?: boolean; intro?: boolean }) {
  return (
    <section className="showcase-section" id="coverage">
      {intro ? (
        <>
          <div className="eyebrow">Office of the CFO</div>
          <h2 className="section-title">Finance functions, not one agent per function</h2>
          <p className="lede">
            <GlossaryTerm term="Accounts payable">Bills the company owes</GlossaryTerm>,{" "}
            <GlossaryTerm term="Accounts receivable">money customers still owe</GlossaryTerm>,{" "}
            <GlossaryTerm term="Reconciliation">matching the bank to the books</GlossaryTerm>,{" "}
            <GlossaryTerm term="Month-end close">finishing the month</GlossaryTerm>, audit, and forecasting still exist. Several agents can share a function, and one agent can cover several related jobs.
          </p>
        </>
      ) : null}
      <div className="grid-2 coverage-grid">
        {CAPABILITIES.map((item) => (
          <div className="card" key={item.id}>
            <h2 style={{ textTransform: "none", letterSpacing: 0, color: "var(--text)", fontSize: 18 }}>{item.title}</h2>
            <p>
              <strong>Finance team. </strong>
              {item.finance}
            </p>
            <p>
              <strong>Maximor. </strong>
              {item.maximor}
            </p>
            {compact ? null : (
              <p className="muted">
                Agents involved: {item.agents.map((slug) => AGENTS_BY_SLUG[slug as keyof typeof AGENTS_BY_SLUG]?.name || slug).join(" · ")}
              </p>
            )}
          </div>
        ))}
      </div>
      {compact ? (
        <p className="muted" style={{ marginTop: 12 }}>
          <Link to="/coverage">See the full coverage map →</Link>
        </p>
      ) : null}
    </section>
  );
}
