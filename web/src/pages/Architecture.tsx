import { useEffect, useState } from "react";
import { demoApi } from "../demoClient";
import { PageHead } from "../layout/Shell";
import { ArchitectureDiagram } from "../components/ArchitectureDiagram";
import { AgentDirectory, AgentPanel } from "../components/AgentPanel";
import { AGENTS, AGENTS_BY_SLUG, ROUTINES } from "../data/agents";
import { formatAgent, formatCadence, humanizeToken } from "../copy";

export default function Architecture() {
  const [data, setData] = useState<any>(null);
  const [open, setOpen] = useState<string>("ap");

  useEffect(() => {
    demoApi.loadArchitecture().then(setData).catch(() => setData(null));
  }, []);

  const agent = AGENTS_BY_SLUG[open as keyof typeof AGENTS_BY_SLUG] || AGENTS[0];
  const live = (data?.bots || []).find((bot: any) => bot.slug === agent.slug);

  return (
    <div>
      <PageHead
        eyebrow="How the team works"
        title="How the finance team is actually organized"
        lede="Standing agents share one company picture. Related jobs live as profiles on those agents. Control agents recheck uncertain work. Audit samples after the fact. This page is drawn from the live office roster, not from an older, larger agent list."
      />
      <ArchitectureDiagram selected={open} onSelect={setOpen} />
      <div className="grid-2" style={{ marginTop: 18 }}>
        <div className="card">
          <h2>The team</h2>
          <AgentDirectory selected={open} onSelect={setOpen} />
        </div>
        <div className="card">
          <AgentPanel agent={agent} live={live} />
        </div>
      </div>
      <div className="card" style={{ marginTop: 14 }}>
        <h2>Scheduled office routines</h2>
        <p className="muted">These are recurring jobs on the calendar. They are not extra agents.</p>
        {(data?.routines?.length ? data.routines : ROUTINES).map((row: any) => (
          <div className="split" key={row.id || row.name} style={{ marginBottom: 8 }}>
            <div>
              <div>{row.title || humanizeToken(row.id) || row.name}</div>
              <div className="muted">{formatCadence(row.cadence)} · {formatAgent(row.bot)}</div>
            </div>
          </div>
        ))}
      </div>
      <p className="muted">Older, narrower finance roles still exist as jobs inside these agents. They are not separate standing agents.</p>
    </div>
  );
}
