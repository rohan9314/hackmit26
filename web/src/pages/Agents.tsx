import { useEffect, useState } from "react";
import { statusTone } from "../api";
import { demoApi } from "../demoClient";
import { PageHead, Pill, SourceBadge } from "../layout/Shell";
import { AgentDirectory, AgentPanel } from "../components/AgentPanel";
import { AGENTS, AGENTS_BY_SLUG } from "../data/agents";
import { formatHandoff, formatStatus, formatSummary, formatWorkflow } from "../copy";
import { savedGet } from "../data/savedDemo";

export default function Agents() {
  const [data, setData] = useState<any>(() => savedGet("/api/agents"));
  const [open, setOpen] = useState<string>("ap");

  useEffect(() => {
    demoApi.loadAgents().then(setData).catch(() => setData(savedGet("/api/agents")));
  }, []);

  const agent = AGENTS_BY_SLUG[open as keyof typeof AGENTS_BY_SLUG] || AGENTS[0];
  const live = (data?.bots || []).find((item: any) => item.slug === open);
  const savedActivity = savedGet("/api/agents")?.activity || [];
  const liveActivity = data?.activity || [];
  const activity = liveActivity.length ? liveActivity : savedActivity;
  const activitySource = liveActivity.length ? "live" : "saved";

  return (
    <div>
      <PageHead
        eyebrow="Office of the CFO"
        title="The finance team"
        lede="A coordinated set of finance agents sharing context, memory, evidence, and decisions. Each agent can take several related jobs. Control agents recheck uncertain work instead of asking a person to intervene."
      />
      <div className="grid-2">
        <div className="card">
          <h2>The team</h2>
          <AgentDirectory selected={open} onSelect={setOpen} />
        </div>
        <div className="stack">
          <div className="card">
            <AgentPanel agent={agent} live={live} />
          </div>
          <div className="card">
            <h2>What the agents just did</h2>
            {activitySource === "saved" ? <SourceBadge source="saved" /> : null}
            {activity.length === 0 ? (
              <p className="muted">No recent agent activity is available yet. Run a finance workflow to see who handed work to whom.</p>
            ) : (
              activity.map((row: any, idx: number) => (
              <div key={idx} style={{ marginBottom: 12 }}>
                <div className="split">
                  <strong>{formatWorkflow(row.workflow)}</strong>
                  <Pill tone={statusTone(row.status)}>{formatStatus(row.status)}</Pill>
                </div>
                <p>{formatHandoff(row.bots, row.workflow)}</p>
                {row.summary ? <p className="muted">{formatSummary(row.summary)}</p> : null}
              </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
