import { useEffect, useState } from "react";
import { statusTone } from "../api";
import { demoApi } from "../demoClient";
import { useWorkflow } from "../hooks";
import { ErrorBox, Pill, RunBar } from "../layout/Shell";
import { DemoLayout, OutputHeadline, ProcessPanel, SourceArtifactViewer } from "../components/Demo";
import { Definition, ResultBlock, StoryCard, TraceIds, WhatsHappening } from "../components/Explain";
import { ExpectedSteps, WORKFLOW_PREVIEWS } from "../components/Presentation";
import { formatControlResult, formatStatus } from "../copy";
import { savedGet } from "../data/savedDemo";

function explainFinding(item: any) {
  const blob = `${item.title || ""} ${item.summary || ""} ${item.detail || ""} ${item.control_id || ""} ${item.control_name || ""} ${(item.record_ids || []).join(" ")}`.toLowerCase();
  if (blob.includes("self") || blob.includes("same user") || blob.includes("apr-inv-self")) {
    return {
      found: "This invoice was requested, prepared, reviewed, and approved by the same user.",
      why: "That breaks the company's separation-of-duties control, which expects different people or roles to prepare and approve a transaction.",
      result: "The audit agent recorded a control failure on this approval path.",
    };
  }
  if (blob.includes("duplicate invoice") || blob.includes("inv-006") || (blob.includes("duplicate") && blob.includes("invoice"))) {
    return {
      found: "These two invoices appear to request payment for the same vendor bill.",
      why: "Paying both would mean paying the vendor twice for one shipment.",
      result: "The duplicate pair is flagged so payables can hold the extra bill.",
    };
  }
  if (blob.includes("duplicate vendor") || blob.includes("vend-001")) {
    return {
      found: "Two vendor records look like the same supplier stored twice.",
      why: "Duplicate vendor masters make it easier to pay the wrong party or hide a second payment channel.",
      result: "The auditor flagged the vendor pair for master-data review.",
    };
  }
  if (blob.includes("round")) {
    return {
      found: item.summary || "One or more payments were unusually round amounts.",
      why: "Round-number payments can be legitimate, but the audit policy marks them for extra testing when other support is weak.",
      result: "The payments remain on the exception list until supporting invoices are confirmed.",
    };
  }
  if (blob.includes("missing") || blob.includes("support")) {
    return {
      found: "Maximor found a payment but could not find the expected invoice or supporting record that justifies it.",
      why: "Cash should not leave the company without a bill, receiving record, or other support.",
      result: "The payment is flagged as missing support.",
    };
  }
  if (blob.includes("post-close") || blob.includes("post close")) {
    return {
      found: "A journal entry was posted after the month was supposed to be locked.",
      why: "Post-close entries can change financial statements after they were treated as finished.",
      result: "The auditor flagged the post-close journal.",
    };
  }
  return {
    found: item.summary || item.detail || item.title || "A control test did not pass.",
    why: formatSummary(item.severity_rationale || item.reason_code) || "The sampled records did not meet the control's expected pattern.",
    result: formatControlResult(item.severity || item.result || item.status),
  };
}

export default function Audit() {
  const [data, setData] = useState<any>(() => savedGet("/api/audit"));
  const { running, result, error, source, run } = useWorkflow();

  useEffect(() => {
    demoApi.loadAudit().then(setData).catch(() => setData(savedGet("/api/audit")));
  }, [result]);

  const inner = result?.result;
  const findings = inner?.io?.outputs?.findings || inner?.run?.findings || inner?.payload?.run?.findings || [];
  const featured = data?.inputs?.featured || {};
  const self = data?.inputs?.self_approval_ids || featured.self_approval?.record || {};

  return (
    <DemoLayout
      eyebrow="Assurance"
      title="Independent control tests"
      task="Maximor's audit agents independently inspect transactions and accounting records for signs that company controls were broken or records do not agree."
      source={source}
      happening={
        <WhatsHappening
          happening="This is not the team that pays bills or closes the month. The Audit Agent samples invoices, payments, journals, vendors, and approvals after the fact and re-performs the company's controls."
          figureOut="Did anyone approve their own invoice, submit the same vendor bill twice, pay a round amount with weak support, or post after close?"
          why="Planted issues in the demo population prove the auditor can catch real control failures rather than rubber-stamp the books."
        />
      }
      runBar={
        <>
          <RunBar label="Run independent audit" running={running} onRun={() => run(() => demoApi.runAudit())} />
          <ErrorBox error={error} />
        </>
      }
      input={
        <div className="stack">
          <StoryCard title="Self-approval">
            <Definition term="Audit evidence" />
            <p>This invoice was requested, prepared, reviewed, and approved by the same user.</p>
            <p>That breaks the company's separation-of-duties control, which expects different people or roles to prepare and approve a transaction.</p>
            <TraceIds ids={[self.requester_id, self.approver_id, featured.self_approval?.artifact_id]} />
            <SourceArtifactViewer artifact={featured.self_approval} />
          </StoryCard>
          <StoryCard title="Duplicate vendor bill">
            <p>These two invoices appear to request payment for the same vendor bill.</p>
            <SourceArtifactViewer artifact={featured.duplicate_invoice_a} compact />
            <SourceArtifactViewer artifact={featured.duplicate_invoice_b} compact />
          </StoryCard>
          <div className="card">
            <h2>Duplicate vendor records</h2>
            <p className="muted">Two supplier records look like the same company stored twice.</p>
            <SourceArtifactViewer artifact={featured.duplicate_vendor_a} compact />
            <SourceArtifactViewer artifact={featured.duplicate_vendor_b} compact />
          </div>
          <div className="card">
            <h2>Round-number payment and post-close journal</h2>
            <p className="muted">Round-number payments can be legitimate, but they are tested extra when support is thin. Journals posted after close are tested because they can change finished statements.</p>
            <SourceArtifactViewer artifact={featured.post_close_journal} compact />
            <SourceArtifactViewer artifact={featured.round_payment} compact />
          </div>
        </div>
      }
      process={inner?.stages?.length ? <ProcessPanel stages={inner?.stages} handoffs={inner?.handoffs} summary={inner?.summary} /> : <ExpectedSteps steps={WORKFLOW_PREVIEWS.audit} />}
      output={
        <div className="card">
          <OutputHeadline label="Findings written" value={findings.length ? `${findings.length} control issues` : "Not run yet"} />
          {findings.length === 0 ? (
            <p className="muted">{data?.note || "Run audit to re-perform controls against this population."}</p>
          ) : (
            findings.map((item: any, idx: number) => {
              const copy = explainFinding(item);
              return (
                <div key={item.finding_id || idx} className="card" style={{ marginBottom: 8 }}>
                  <div className="split">
                    <strong>{item.control_name ? formatStatus(item.control_name) : item.title || "Control finding"}</strong>
                    <Pill tone={statusTone(item.severity || item.result)}>{formatStatus(item.severity || item.result)}</Pill>
                  </div>
                  <ResultBlock found={copy.found} why={copy.why} result={copy.result} />
                  <TraceIds ids={item.record_ids || item.evidence_ids || item.source_ids} />
                </div>
              );
            })
          )}
        </div>
      }
    />
  );
}
