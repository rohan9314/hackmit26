import { Link } from "react-router-dom";
import { PageHead } from "../layout/Shell";
import { AGENTS_BY_SLUG } from "../data/agents";
import { INVOICE_STORY } from "../data/workflowStory";

export default function Workflow() {
  return (
    <div>
      <PageHead
        eyebrow="One piece of work"
        title="Follow a vendor invoice through the office"
        lede="One transaction is not a single-agent task. The path below is the real handoff graph: email identifies the document, payables checks it, control rechecks it, payments drafts a run, cash and close consume the effect, and audit can inspect the history."
      />
      <ol className="story-timeline">
        {INVOICE_STORY.map((step) => (
          <li key={step.n}>
            <div className="story-n">{String(step.n).padStart(2, "0")}</div>
            <div className="card">
              <div className="eyebrow">{AGENTS_BY_SLUG[step.agent].name}</div>
              <h2 style={{ textTransform: "none", letterSpacing: 0, color: "var(--text)", fontSize: 20 }}>{step.title}</h2>
              <p>{step.body}</p>
              {step.handoff ? <p className="muted">{step.handoff}</p> : null}
            </div>
          </li>
        ))}
      </ol>
      <div className="btn-row">
        <Link className="btn primary" to="/simulations/messy-invoice">
          Run a live invoice simulation
        </Link>
        <Link className="btn" to="/architecture">
          See how the agents work together
        </Link>
      </div>
    </div>
  );
}
