"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const initialToast = { visible: false, message: "", type: "info" };
const ACTIVE_SKILL_STORAGE_KEY = "conductor-active-skill";
const CUSTOM_IMPORT_TARGET = "__custom__";

function getRequestHeaders() {
  return {
    "Content-Type": "application/json",
  };
}

export default function SkillEditor({ params }) {
  const router = useRouter();
  const { skillName: encodedSkillName } = use(params);
  const skillName = decodeURIComponent(encodedSkillName);
  const [summary, setSummary] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [qaReport, setQaReport] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [toast, setToast] = useState(initialToast);
  const [importTargetMode, setImportTargetMode] = useState(`${skillName}-imported`);
  const [customImportTarget, setCustomImportTarget] = useState("");

  useEffect(() => {
    fetchSummary();
  }, [skillName]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(ACTIVE_SKILL_STORAGE_KEY, skillName);
  }, [skillName]);

  useEffect(() => {
    if (!toast.visible) return;
    const timer = window.setTimeout(() => setToast(initialToast), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const showToast = (message, type = "info") => {
    setToast({ visible: true, message, type });
  };

  const fetchSummary = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/skills/${encodeURIComponent(skillName)}/summary`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to load skill summary");
      setSummary(data);
      setTestResult(null);
      setQaReport(null);
    } catch (error) {
      showToast(error.message, "error");
      setSummary(null);
    } finally {
      setIsLoading(false);
    }
  };

  const importTargetOptions = Array.from(
    new Set(
      [
        `${skillName}-imported`,
        skillName,
        `${skillName}-workspace`,
        summary?.importedTo || "",
      ].filter(Boolean)
    )
  );

  const resolvedImportTarget =
    importTargetMode === CUSTOM_IMPORT_TARGET ? customImportTarget.trim() : importTargetMode.trim();

  const importSkill = async () => {
    const targetName = resolvedImportTarget;
    if (!targetName) {
      showToast("Choose an import workspace target first.", "error");
      return;
    }

    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: getRequestHeaders(),
        body: JSON.stringify({ skillName, targetName }),
      });
      const data = await res.json();
      if (res.status === 403) {
        await requestSkillImport(skillName, targetName);
        showToast(`Approval requested to import ${skillName}`, "success");
        return;
      }
      if (!res.ok) throw new Error(data.error || "Unable to import skill");
      showToast(`Imported to ${data.path}`, "success");
      setSummary((prev) => ({ ...prev, importedTo: data.path }));
      setImportTargetMode(data.path);
    } catch (error) {
      showToast(error.message, "error");
    }
  };

  const requestSkillImport = async (skillName, targetName) => {
    const res = await fetch("/api/skill-change-requests", {
      method: "POST",
      headers: getRequestHeaders(),
      body: JSON.stringify({ type: "SKILL_IMPORT", skillName, targetName }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Unable to request skill import");
    return data;
  };

  const runTest = async () => {
    setIsTesting(true);
    try {
      const res = await fetch(`/api/skills/${encodeURIComponent(skillName)}/run`, {
        method: "POST",
        headers: getRequestHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Skill test failed");
      setTestResult(data);
      setQaReport(data.qaReport || null);
      await fetchSummary();
      showToast("Skill test complete", "success");
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="conductor-shell">
      <aside className="conductor-left">
        <div className="nav-card summary-card">
          <p className="eyebrow">Skill summary</p>
          <div className="skill-title">{skillName}</div>
          {summary ? (
            <div className="summary-list">
              <div className="summary-item">
                <span>Files</span>
                <strong>{summary.fileCount}</strong>
              </div>
              <div className="summary-item">
                <span>References</span>
                <strong>{summary.referenceCount}</strong>
              </div>
              <div className="summary-item">
                <span>SKILL.md</span>
                <strong>{summary.hasSkillFile ? "Present" : "Missing"}</strong>
              </div>
              <div className="summary-item">
                <span>Imported</span>
                <strong>{summary.importedTo || "Not yet"}</strong>
              </div>
              <div className="summary-item">
                <span>Quality</span>
                <strong>{summary.qualityStatus || "draft"}</strong>
              </div>
              <div className="summary-item">
                <span>Owner</span>
                <strong>{summary.owner || "Unassigned"}</strong>
              </div>
              <div className="summary-item">
                <span>Reviewer</span>
                <strong>{summary.reviewer || "Unassigned"}</strong>
              </div>
              <div className="summary-item">
                <span>Freshness</span>
                <strong>
                  {summary.freshnessStatus}
                  {typeof summary.freshnessAgeDays === "number" ? ` (${summary.freshnessAgeDays}d)` : ""}
                </strong>
              </div>
              <div className="summary-item">
                <span>Score</span>
                <strong>{summary.scorecard ? `${summary.scorecard.score}/100` : "Unknown"}</strong>
              </div>
              <div className="summary-item">
                <span>Grade</span>
                <strong>{summary.scorecard?.grade || "Unknown"}</strong>
              </div>
              <div className="summary-item">
                <span>Stability</span>
                <strong>{summary.scorecard?.stability || "Unknown"}</strong>
              </div>
              <div className="summary-item">
                <span>QA report</span>
                <strong>{summary.latestQaReport ? summary.latestQaReport.recommendation : "Not yet"}</strong>
              </div>
              <div className="summary-item">
                <span>Trigger prompts</span>
                <strong>{summary.triggerSummary ? `${summary.triggerSummary.matchedCount}/${summary.triggerSummary.promptCount}` : "Unknown"}</strong>
              </div>
            </div>
          ) : (
            <div className="empty-state-card">Loading summary...</div>
          )}
        </div>

        <div className="nav-card actions-card">
          <p className="eyebrow">Primary actions</p>
          <div className="action-list">
            <button className="button primary full-width" onClick={runTest} disabled={isLoading || isTesting}>
              {isTesting ? "Testing..." : "Run validation"}
            </button>
            <div className="skill-action-block">
              <label className="form-field">
                <span>Import target</span>
                <select
                  className="search-field"
                  value={importTargetMode}
                  onChange={(event) => setImportTargetMode(event.target.value)}
                  disabled={isLoading}
                >
                  {importTargetOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                  <option value={CUSTOM_IMPORT_TARGET}>Custom workspace…</option>
                </select>
              </label>
              {importTargetMode === CUSTOM_IMPORT_TARGET ? (
                <label className="form-field">
                  <span>Custom workspace name</span>
                  <input
                    className="search-field"
                    value={customImportTarget}
                    onChange={(event) => setCustomImportTarget(event.target.value)}
                    placeholder={`${skillName}-workspace`}
                  />
                </label>
              ) : null}
            </div>
            <button className="button secondary full-width" onClick={importSkill} disabled={isLoading}>
              Request import
            </button>
            <button className="button secondary full-width" onClick={() => router.push("/skills")}>Back to skills</button>
          </div>
        </div>
      </aside>

      <main className="conductor-main">
        <section className="active-skill-bar compact">
          <div>
            <p className="eyebrow">Active skill</p>
            <h2>{skillName}</h2>
            <p className="page-copy">This skill stays pinned here so it is always clear what is currently active.</p>
          </div>
          <div className="active-skill-controls">
            <span className="status-pill success">Active now</span>
            <span className="skill-pill">{summary?.importedTo ? `Imported to ${summary.importedTo}` : "Not imported yet"}</span>
          </div>
        </section>

        <div className="page-header conductor-header">
          <div>
            <p className="eyebrow">Skill detail</p>
            <h1>{skillName}</h1>
            <p className="page-copy">Validate this skill and request import only when needed.</p>
            <p className="page-copy">
              Owner: {summary?.owner || "Unassigned"} | Reviewer: {summary?.reviewer || "Unassigned"}
            </p>
            <p className="page-copy">
              Freshness: {summary?.freshnessStatus || "unknown"}
              {typeof summary?.freshnessAgeDays === "number" ? ` | Age ${summary.freshnessAgeDays} days` : ""}
            </p>
            <p className="page-copy">
              Scorecard: {summary?.scorecard ? `${summary.scorecard.score}/100 | Grade ${summary.scorecard.grade} | ${summary.scorecard.stability}` : "Not available"}
            </p>
            {summary?.tags?.length ? (
              <p className="page-copy">Tags: {summary.tags.join(", ")}</p>
            ) : null}
          </div>
        </div>

        <div className="skill-status-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Validation summary</p>
              <h3>Skill health snapshot</h3>
            </div>
            <span className={`status-pill ${testResult?.status === "passed" ? "success" : testResult?.status === "failed" ? "danger" : "neutral"}`}>
              {testResult ? testResult.status : "Ready"}
            </span>
          </div>

          {testResult ? (
            <>
              <div className="results-grid">
                {testResult.checks.map((check) => (
                  <div key={check.label} className={`result-card ${check.status}`}>
                    <div className="result-card-top">
                      <p>{check.label}</p>
                      <strong>{check.status === "pass" ? "PASS" : check.status === "warn" ? "WARN" : "FAIL"}</strong>
                    </div>
                    <p className="result-detail">{check.detail}</p>
                  </div>
                ))}
              </div>
              {qaReport ? (
                <div className="result-card pass">
                  <div className="result-card-top">
                    <p>QA report generated</p>
                    <strong>{qaReport.recommendation}</strong>
                  </div>
                  <p className="result-detail">
                    {qaReport.findingsCount} findings recorded. Saved to {qaReport.relativePath}.
                  </p>
                </div>
              ) : null}
              {testResult?.triggerValidation ? (
                <div className={`result-card ${testResult.triggerValidation.status === "pass" ? "pass" : testResult.triggerValidation.status === "warn" ? "warn" : "fail"}`}>
                  <div className="result-card-top">
                    <p>Prompt trigger coverage</p>
                    <strong>{`${testResult.triggerValidation.matchedCount}/${testResult.triggerValidation.promptCount}`}</strong>
                  </div>
                  <p className="result-detail">{testResult.triggerValidation.detail}</p>
                  <div className="result-detail">
                    {testResult.triggerValidation.prompts.map((item) => (
                      <p key={item.prompt}>
                        {item.matched ? "MATCH" : "MISS"}: {item.prompt}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <div className="empty-state-card">
              <h2>Ready to validate</h2>
              <p>Run the skill validation to see pass/fail analysis and actionable warnings.</p>
            </div>
          )}
        </div>
      </main>

      <aside className="conductor-right">
        <div className="activity-card pulse-card">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Insights</p>
              <h3>Workspace readiness</h3>
            </div>
            <span className="status-pill success">Stable</span>
          </div>
          <div className="activity-item">
            <p>{testResult ? "Validation completed" : "Validation pending"}</p>
            <span>{testResult ? testResult.message : "Run the validation workflow."}</span>
          </div>
          <div className="activity-item">
            <p>Latest QA report</p>
            <span>
              {summary?.latestQaReport
                ? `${summary.latestQaReport.recommendation} on ${new Date(summary.latestQaReport.createdAt).toLocaleString()}`
                : "No report generated yet"}
            </span>
          </div>
          <div className="activity-item">
            <p>Health summary</p>
            <span>
              {summary?.validationSummary
                ? `${summary.validationSummary.failCount} fails, ${summary.validationSummary.warnCount} warnings`
                : "No validation summary yet"}
            </span>
          </div>
          <div className="activity-item">
            <p>Ownership</p>
            <span>
              {summary?.owner
                ? `${summary.owner}${summary?.reviewer ? ` | Reviewer ${summary.reviewer}` : ""}`
                : "No owner assigned yet"}
            </span>
          </div>
          <div className="activity-item">
            <p>Freshness</p>
            <span>
              {summary?.freshnessStatus
                ? `${summary.freshnessStatus}${typeof summary?.freshnessAgeDays === "number" ? ` | ${summary.freshnessAgeDays} days old` : ""}`
                : "No freshness data yet"}
            </span>
          </div>
          <div className="activity-item">
            <p>Stability</p>
            <span>
              {summary?.scorecard
                ? `${summary.scorecard.stability} | Grade ${summary.scorecard.grade} | ${summary.scorecard.score}/100`
                : "No scorecard yet"}
            </span>
          </div>
          <div className="activity-item">
            <p>Trigger wording</p>
            <span>
              {summary?.triggerSummary
                ? `${summary.triggerSummary.matchedCount} of ${summary.triggerSummary.promptCount} sample prompts matched`
                : "No trigger summary yet"}
            </span>
          </div>
          <div className="activity-item">
            <p>Import status</p>
            <span>{summary?.importedTo ? `Imported: ${summary.importedTo}` : "Not imported"}</span>
          </div>
          <div className="activity-item">
            <p>Recommended next step</p>
            <span>{testResult ? "Request import if this skill is needed." : "Run validation first."}</span>
          </div>
        </div>
      </aside>

      <div className={`toast ${toast.visible ? "visible" : ""} ${toast.type}`}>{toast.message}</div>
    </div>
  );
}
