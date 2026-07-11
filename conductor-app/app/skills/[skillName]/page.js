"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const initialToast = { visible: false, message: "", type: "info" };

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
  const [isLoading, setIsLoading] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [toast, setToast] = useState(initialToast);

  useEffect(() => {
    fetchSummary();
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
    } catch (error) {
      showToast(error.message, "error");
      setSummary(null);
    } finally {
      setIsLoading(false);
    }
  };

  const importSkill = async () => {
    const targetName = window.prompt("Import workspace name:", `${skillName}-imported`);
    if (!targetName) return;

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
            <button className="button secondary full-width" onClick={importSkill} disabled={isLoading}>
              Request import
            </button>
            <button className="button secondary full-width" onClick={() => router.push("/skills")}>Back to skills</button>
          </div>
        </div>
      </aside>

      <main className="conductor-main">
        <div className="page-header conductor-header">
          <div>
            <p className="eyebrow">Skill detail</p>
            <h1>{skillName}</h1>
            <p className="page-copy">Validate this skill and request import only when needed.</p>
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
