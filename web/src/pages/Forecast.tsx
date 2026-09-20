import { useEffect, useState } from "react";
import { usd } from "../api";
import { demoApi } from "../demoClient";
import { useWorkflow } from "../hooks";
import { ErrorBox, RunBar } from "../layout/Shell";
import { BeforeAfterDiff, DemoLayout, OutputHeadline, ProcessPanel, SourceArtifactViewer } from "../components/Demo";
import { Definition, StoryCard, TraceIds, WhatsHappening } from "../components/Explain";
import { ExpectedSteps, WORKFLOW_PREVIEWS } from "../components/Presentation";
import { formatWeekDate } from "../copy";
import { savedGet } from "../data/savedDemo";

export default function Forecast() {
  const [data, setData] = useState<any>(() => savedGet("/api/forecast"));
  const [week, setWeek] = useState<any>(() => savedGet("/api/forecast")?.weeks?.[0] || null);
  const { running, result, error, source, run } = useWorkflow();

  useEffect(() => {
    demoApi.loadForecast().then(setData).catch(() => setData(savedGet("/api/forecast")));
  }, [result]);

  const weeks = result?.result?.snapshot?.weeks || data?.weeks || [];
  const beforeWeeks = result?.result?.io?.before?.weeks || data?.inputs?.weeks || data?.weeks || [];
  const inner = result?.result;
  const gm = data?.inputs?.gross_margin;
  const opening = data?.opening_cash ?? beforeWeeks[0]?.beginning_cash ?? weeks[0]?.beginning_cash ?? 510000;
  const booksEnding = data?.projected_ending_cash ?? beforeWeeks[beforeWeeks.length - 1]?.ending_cash;
  const refreshedEnding = inner?.io?.outputs?.ending_cash;
  const ending = refreshedEnding ?? booksEnding ?? weeks[weeks.length - 1]?.ending_cash;

  const beforeByWeek = Object.fromEntries((beforeWeeks || []).map((item: any) => [item.week_start, item.ending_cash]));
  const afterByWeek = Object.fromEntries((weeks || []).map((item: any) => [item.week_start, item.ending_cash]));
  const changed = Object.keys(afterByWeek).filter((key) => Number(beforeByWeek[key]) !== Number(afterByWeek[key]));

  return (
    <DemoLayout
      eyebrow="Treasury"
      title="How much cash will be in the bank?"
      task="A cash forecast estimates how much money the company expects to have in the bank each week. Maximor projects 13 weeks ahead using expected customer payments, vendor payments, payroll, and other cash movements."
      source={source}
      happening={
        <WhatsHappening
          happening={
            refreshedEnding != null && booksEnding != null && Number(refreshedEnding) !== Number(booksEnding)
              ? `The forecast already on the books starts at ${usd(opening)} and ends the 13-week window at ${usd(booksEnding)}. Refreshing from current collections and open bills currently projects ${usd(refreshedEnding)} because many vendor bills are still held, not paid.`
              : `Starting with ${usd(opening)} in cash, Maximor currently expects the company to end the 13-week period with ${usd(ending)}.`
          }
          figureOut="Which weekly cash balances change when collections, vendor payments, or new events hit the forecast?"
          why="Leadership needs an early view of whether cash is tightening — without reading 13 spreadsheet rows unaided."
        />
      }
      runBar={
        <>
          <RunBar label="Refresh forecast" running={running} onRun={() => run(() => demoApi.runForecast())} />
          <ErrorBox error={error} />
        </>
      }
      input={
        <div className="stack">
          <StoryCard title="What a 13-week cash forecast is">
            <Definition term="13-week cash forecast" />
            <p>The original forecast already on the books is the starting point. New events — such as a late customer payment or an extra vendor bill — can move later weeks.</p>
          </StoryCard>
          <div className="card">
            <h2>Original forecast</h2>
            <SourceArtifactViewer artifact={data?.inputs?.original_forecast} />
          </div>
          <div className="card">
            <h2>New events that can change the forecast</h2>
            {(data?.inputs?.new_events || []).map((item: any, idx: number) => (
              <SourceArtifactViewer key={item.artifact_id || item.title || idx} artifact={item} />
            ))}
          </div>
          <div className="card">
            <h2>Gross margin comparison</h2>
            <p className="muted">Gross margin is the share of sales left after direct costs. August was {gm?.august != null ? `${Math.round(gm.august * 1000) / 10}%` : "64%"}; September is {gm?.september != null ? `${Math.round(gm.september * 1000) / 10}%` : "61%"}.</p>
            {(gm?.drivers || []).map((item: any, idx: number) => (
              <SourceArtifactViewer key={item.artifact_id || item.title || idx} artifact={item} compact />
            ))}
          </div>
        </div>
      }
      process={inner?.stages?.length ? <ProcessPanel stages={inner?.stages} handoffs={inner?.handoffs} summary={inner?.summary} /> : <ExpectedSteps steps={WORKFLOW_PREVIEWS.forecast} />}
      output={
        <div className="stack">
          <div className="card">
            <OutputHeadline
              label={refreshedEnding != null && booksEnding != null && Number(refreshedEnding) !== Number(booksEnding) ? "Refreshed 13-week ending cash" : "Projected cash at week 13"}
              value={usd(ending)}
              tone="info"
            />
            <p>
              {refreshedEnding != null && booksEnding != null && Number(refreshedEnding) !== Number(booksEnding) ? (
                <>
                  The forecast already on the books ends at {usd(booksEnding)}. Refreshing from current open items currently projects {usd(refreshedEnding)}. The original plan assumed a large vendor payment run; many of those bills are still held, so the rebuilt outlook keeps more cash.
                </>
              ) : (
                <>
                  Starting with {usd(opening)}, Maximor currently expects to end the 13-week window with {usd(ending)}. The largest expected cash outflows are payroll and vendor payments. Customer collections are the main inflow.
                </>
              )}
            </p>
            <h2>{changed.length ? "Weeks whose ending cash changed" : "Week-ending cash comparison"}</h2>
            {changed.length === 0 ? (
              <p className="muted">
                {inner
                  ? "The refreshed forecast did not change any weekly ending-cash values."
                  : "The weekly outlook currently on the books is shown below. Refresh to rebuild it from current collections and open bills."}
              </p>
            ) : (
              <>
                {changed.map((key) => {
                  const delta = Number(afterByWeek[key]) - Number(beforeByWeek[key]);
                  return (
                    <p key={key}>
                      {formatWeekDate(key)} {delta < 0 ? "decreased" : "increased"} by {usd(Math.abs(delta))}
                      {delta < 0 ? " after additional cash went out or a collection slipped." : " after additional cash came in."}
                    </p>
                  );
                })}
                <BeforeAfterDiff
                  before={Object.fromEntries(changed.map((key) => [key, beforeByWeek[key]]))}
                  after={Object.fromEntries(changed.map((key) => [key, afterByWeek[key]]))}
                  onlyChanged
                  unchangedMessage="The refreshed forecast did not change any weekly ending-cash values."
                  labelFor={formatWeekDate}
                />
              </>
            )}
          </div>
          <div className="card">
            <h2>Weekly cash outlook</h2>
            <p className="muted">Week by week, here is how cash is expected to move from customer collections, vendor payments, and other activity.</p>
            {weeks.length === 0 ? (
              <p className="muted">No weekly cash outlook is available yet.</p>
            ) : (
            <div className="table-scroll">
              <table className="data">
                <thead>
                  <tr>
                    <th>Week ending</th>
                    <th className="right">Start</th>
                    <th className="right">From customers</th>
                    <th className="right">To vendors</th>
                    <th className="right">End</th>
                  </tr>
                </thead>
                <tbody>
                  {weeks.map((item: any) => (
                    <tr key={item.week_start} className={week?.week_start === item.week_start ? "selected" : ""} onClick={() => setWeek(item)}>
                      <td>{formatWeekDate(item.week_end || item.week_start)}</td>
                      <td className="num right">{usd(item.beginning_cash)}</td>
                      <td className="num right">{usd(item.ar_collections)}</td>
                      <td className="num right">{usd(item.ap_payments)}</td>
                      <td className="num right">{usd(item.ending_cash)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
            {week ? <TraceIds ids={[week.week_start]} label="Selected week" /> : null}
          </div>
        </div>
      }
    />
  );
}
