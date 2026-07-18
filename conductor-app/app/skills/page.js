"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const initialToast = { visible: false, message: "", type: "info" };
const initialSimilarityState = { loading: false, topMatches: [], hasHighSimilarity: false, checked: false };
const initialWizardState = {
  skillName: "",
  description: "",
  role: "",
  owner: "",
  reviewer: "",
  qualityStatus: "draft",
  triggerDescription: "",
  confirmHighSimilarity: false,
  tags: "",
  referenceOneTitle: "",
  referenceOneSummary: "",
  referenceTwoTitle: "",
  referenceTwoSummary: "",
};

function getRequestHeaders() {
  return {
    "Content-Type": "application/json",
  };
}

export default function SkillsHome() {
  const [skills, setSkills] = useState([]);
  const [insights, setInsights] = useState(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [tag, setTag] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizard, setWizard] = useState(initialWizardState);
  const [similarity, setSimilarity] = useState(initialSimilarityState);
  const [toast, setToast] = useState(initialToast);

  useEffect(() => {
    fetchSkills();
    fetchInsights();
  }, []);

  useEffect(() => {
    if (!toast.visible) return;
    const timer = window.setTimeout(() => setToast(initialToast), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!wizardOpen) {
      setSimilarity(initialSimilarityState);
      return;
    }

    const hasCandidateText =
      wizard.skillName.trim() ||
      wizard.description.trim() ||
      wizard.triggerDescription.trim() ||
      wizard.tags.trim() ||
      wizard.referenceOneTitle.trim() ||
      wizard.referenceTwoTitle.trim();

    if (!hasCandidateText) {
      setSimilarity(initialSimilarityState);
      return;
    }

    const timer = window.setTimeout(() => {
      fetchSimilarity();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [
    wizardOpen,
    wizard.skillName,
    wizard.description,
    wizard.triggerDescription,
    wizard.tags,
    wizard.referenceOneTitle,
    wizard.referenceTwoTitle,
  ]);

  const fetchSkills = async (search = "", filterValue = filter, tagValue = tag) => {
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (search) queryParams.set("q", search);
      if (filterValue && filterValue !== "all") queryParams.set("filter", filterValue);
      if (tagValue) queryParams.set("tag", tagValue);
      const res = await fetch(`/api/skills?${queryParams.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to load skills");
      setSkills(data);
    } catch (error) {
      setToast({ visible: true, message: error.message, type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchInsights = async () => {
    try {
      const res = await fetch("/api/skills?view=insights");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to load skill insights");
      setInsights(data);
    } catch (error) {
      setToast({ visible: true, message: error.message, type: "error" });
    }
  };

  const updateWizardField = (field, value) => {
    setWizard((current) => ({ ...current, [field]: value }));
  };

  const resetWizard = () => {
    setWizard(initialWizardState);
    setSimilarity(initialSimilarityState);
    setWizardOpen(false);
  };

  const fetchSimilarity = async () => {
    setSimilarity((current) => ({ ...current, loading: true }));
    try {
      const queryParams = new URLSearchParams({
        view: "similarity",
        skillName: wizard.skillName.trim(),
        description: wizard.description.trim(),
        triggerDescription: wizard.triggerDescription.trim(),
        tags: wizard.tags.trim(),
        references: [wizard.referenceOneTitle.trim(), wizard.referenceTwoTitle.trim()].filter(Boolean).join(","),
      });
      const res = await fetch(`/api/skills?${queryParams.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Unable to compare similar skills");
      }
      setSimilarity({
        loading: false,
        topMatches: data.topMatches || [],
        hasHighSimilarity: Boolean(data.hasHighSimilarity),
        checked: true,
      });
    } catch (error) {
      setSimilarity(initialSimilarityState);
      setToast({ visible: true, message: error.message, type: "error" });
    }
  };

  const createSkill = async () => {
    const skillName = wizard.skillName.trim();
    const description = wizard.description.trim() || "New skill";
    const tags = wizard.tags
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
    const starterReferences = [
      {
        title: wizard.referenceOneTitle.trim(),
        summary: wizard.referenceOneSummary.trim(),
      },
      {
        title: wizard.referenceTwoTitle.trim(),
        summary: wizard.referenceTwoSummary.trim(),
      },
    ].filter((reference) => reference.title);

    if (!skillName) {
      setToast({ visible: true, message: "Skill ID is required.", type: "error" });
      return;
    }

    setIsCreating(true);
    try {
      const res = await fetch("/api/skills", {
        method: "POST",
        headers: getRequestHeaders(),
        body: JSON.stringify({
          skillName,
          description,
          role: wizard.role,
          owner: wizard.owner,
          reviewer: wizard.reviewer,
          qualityStatus: wizard.qualityStatus,
          triggerDescription: wizard.triggerDescription,
          confirmDuplicate: wizard.confirmHighSimilarity,
          tags,
          starterReferences,
        }),
      });
      const data = await res.json();
      if (res.status === 403) {
        await requestSkillCreate({
          skillName,
          description,
          role: wizard.role,
          owner: wizard.owner,
          reviewer: wizard.reviewer,
          qualityStatus: wizard.qualityStatus,
          triggerDescription: wizard.triggerDescription,
          confirmDuplicate: wizard.confirmHighSimilarity,
          tags,
          starterReferences,
        });
        setToast({ visible: true, message: `Approval requested for ${skillName}`, type: "success" });
        resetWizard();
        return;
      }
      if (!res.ok) throw new Error(data.error || "Unable to create skill");
      setToast({ visible: true, message: `Created ${data.skillName}`, type: "success" });
      setQuery("");
      resetWizard();
      fetchSkills("", filter, tag);
      fetchInsights();
    } catch (error) {
      setToast({ visible: true, message: error.message, type: "error" });
    } finally {
      setIsCreating(false);
    }
  };

  const requestSkillCreate = async (payload) => {
    const res = await fetch("/api/skill-change-requests", {
      method: "POST",
      headers: getRequestHeaders(),
      body: JSON.stringify({ type: "SKILL_CREATE", ...payload }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Unable to request skill creation");
    return data;
  };

  const searchSkills = (value) => {
    setQuery(value);
    fetchSkills(value, filter, tag);
  };

  const updateFilter = (value) => {
    setFilter(value);
    fetchSkills(query, value, tag);
  };

  const updateTag = (value) => {
    setTag(value);
    fetchSkills(query, filter, value);
  };

  const importedCount = skills.filter((skill) => skill.importedTo).length;
  const topTags = insights?.tagSummary?.slice(0, 8) || [];

  return (
    <div className="conductor-shell conductor-full-width">
      <main className="conductor-main conductor-main-full">
        <div className="page-header conductor-header">
          <div>
            <p className="eyebrow">Skills</p>
            <h1>Browse approved skills.</h1>
            <p className="page-copy">Open a skill to validate it, inspect health, and request import only when it is ready.</p>
          </div>
          <button className="button primary" onClick={() => setWizardOpen((value) => !value)}>
            {wizardOpen ? "Close wizard" : "Create skill"}
          </button>
        </div>

        {wizardOpen ? (
          <section className="authoring-wizard">
            <div className="authoring-wizard-header">
              <div>
                <p className="eyebrow">Skill authoring wizard</p>
                <h2>Scaffold a reusable skill</h2>
                <p className="page-copy">
                  Define the role, trigger wording, metadata, and starter references in one place.
                </p>
              </div>
              <span className="status-pill neutral">Step 1 of 1</span>
            </div>

            <div className="authoring-wizard-grid">
              <div className="wizard-panel">
                <label className="form-field">
                  <span>Skill ID</span>
                  <input
                    className="search-field"
                    value={wizard.skillName}
                    onChange={(event) => updateWizardField("skillName", event.target.value)}
                    placeholder="ai-ops"
                  />
                </label>
                <label className="form-field">
                  <span>Description</span>
                  <textarea
                    className="editor-textarea wizard-textarea short"
                    value={wizard.description}
                    onChange={(event) => updateWizardField("description", event.target.value)}
                    placeholder="Use this skill for..."
                  />
                </label>
                <label className="form-field">
                  <span>Senior role</span>
                  <input
                    className="search-field"
                    value={wizard.role}
                    onChange={(event) => updateWizardField("role", event.target.value)}
                    placeholder="AI platform engineer"
                  />
                </label>
                <label className="form-field">
                  <span>Trigger description</span>
                  <textarea
                    className="editor-textarea wizard-textarea short"
                    value={wizard.triggerDescription}
                    onChange={(event) => updateWizardField("triggerDescription", event.target.value)}
                    placeholder="Requests about model serving, evaluations, prompt safety..."
                  />
                </label>
                <div className="wizard-inline-grid">
                  <label className="form-field">
                    <span>Owner</span>
                    <input
                      className="search-field"
                      value={wizard.owner}
                      onChange={(event) => updateWizardField("owner", event.target.value)}
                      placeholder="platform-team"
                    />
                  </label>
                  <label className="form-field">
                    <span>Reviewer</span>
                    <input
                      className="search-field"
                      value={wizard.reviewer}
                      onChange={(event) => updateWizardField("reviewer", event.target.value)}
                      placeholder="qa-lead"
                    />
                  </label>
                </div>
                <div className="wizard-inline-grid">
                  <label className="form-field">
                    <span>Quality status</span>
                    <select
                      className="search-field"
                      value={wizard.qualityStatus}
                      onChange={(event) => updateWizardField("qualityStatus", event.target.value)}
                    >
                      <option value="draft">Draft</option>
                      <option value="reviewed">Reviewed</option>
                      <option value="production-ready">Production ready</option>
                    </select>
                  </label>
                  <label className="form-field">
                    <span>Tags</span>
                    <input
                      className="search-field"
                      value={wizard.tags}
                      onChange={(event) => updateWizardField("tags", event.target.value)}
                      placeholder="ai, backend, testing"
                    />
                  </label>
                </div>
              </div>

              <div className="wizard-panel">
                <div className="wizard-reference-block">
                  <div className="panel-header">
                    <div>
                      <p className="eyebrow">Starter references</p>
                      <h3>Reference pack</h3>
                    </div>
                  </div>
                  <label className="form-field">
                    <span>Reference 1 title</span>
                    <input
                      className="search-field"
                      value={wizard.referenceOneTitle}
                      onChange={(event) => updateWizardField("referenceOneTitle", event.target.value)}
                      placeholder="deployment-and-rollback"
                    />
                  </label>
                  <label className="form-field">
                    <span>Reference 1 summary</span>
                    <textarea
                      className="editor-textarea wizard-textarea short"
                      value={wizard.referenceOneSummary}
                      onChange={(event) => updateWizardField("referenceOneSummary", event.target.value)}
                      placeholder="Guidance for..."
                    />
                  </label>
                  <label className="form-field">
                    <span>Reference 2 title</span>
                    <input
                      className="search-field"
                      value={wizard.referenceTwoTitle}
                      onChange={(event) => updateWizardField("referenceTwoTitle", event.target.value)}
                      placeholder="evaluation-and-monitoring"
                    />
                  </label>
                  <label className="form-field">
                    <span>Reference 2 summary</span>
                    <textarea
                      className="editor-textarea wizard-textarea short"
                      value={wizard.referenceTwoSummary}
                      onChange={(event) => updateWizardField("referenceTwoSummary", event.target.value)}
                      placeholder="Checks, KPIs, and validation focus..."
                    />
                  </label>
                </div>

                <div className="wizard-helper-card">
                  <p className="eyebrow">What gets scaffolded</p>
                  <ul className="wizard-helper-list">
                    <li>`SKILL.md` with role, trigger wording, workflow, and output expectations</li>
                    <li>`references/*.md` starter files for the titles you provide</li>
                    <li>`skill-state.json` metadata for owner, reviewer, tags, and readiness</li>
                  </ul>
                </div>

                <div className="wizard-helper-card similarity-card">
                  <div className="panel-header">
                    <div>
                      <p className="eyebrow">Duplicate detection</p>
                      <h3>Existing skill similarity</h3>
                    </div>
                    <span className={`status-pill ${similarity.hasHighSimilarity ? "danger" : "neutral"}`}>
                      {similarity.loading
                        ? "Checking"
                        : similarity.hasHighSimilarity
                          ? "High overlap"
                          : similarity.checked
                            ? "Clear enough"
                            : "Waiting"}
                    </span>
                  </div>
                  {similarity.topMatches.length > 0 ? (
                    <div className="similarity-list">
                      {similarity.topMatches.map((match) => (
                        <div className="similarity-item" key={match.skillName}>
                          <div>
                            <strong>{match.skillName}</strong>
                            <p>{match.description}</p>
                            <span>
                              {match.reasons.length > 0 ? match.reasons.join(" | ") : "General overlap detected"}
                            </span>
                          </div>
                          <div className="similarity-score-block">
                            <span className={`status-pill ${match.level === "high" ? "danger" : match.level === "medium" ? "neutral" : "success"}`}>
                              {match.level}
                            </span>
                            <strong>{Math.round(match.score * 100)}%</strong>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="page-copy similarity-empty">
                      {similarity.loading
                        ? "Comparing against the current library..."
                        : "No strong overlap detected yet."}
                    </p>
                  )}
                  {similarity.hasHighSimilarity ? (
                    <label className="similarity-confirm">
                      <input
                        type="checkbox"
                        checked={wizard.confirmHighSimilarity}
                        onChange={(event) => updateWizardField("confirmHighSimilarity", event.target.checked)}
                      />
                      <span>
                        I understand this looks very similar to an existing skill and I still want to create it.
                      </span>
                    </label>
                  ) : null}
                </div>

                <div className="wizard-actions">
                  <button
                    className="button primary"
                    onClick={createSkill}
                    disabled={isCreating || (similarity.hasHighSimilarity && !wizard.confirmHighSimilarity)}
                  >
                    {isCreating ? "Creating..." : "Create scaffold"}
                  </button>
                  <button className="button secondary" onClick={resetWizard} disabled={isCreating}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <div className="top-stat-grid">
          <div className="stat-card">
            <p>Active skills</p>
            <strong>{skills.length}</strong>
          </div>
          <div className="stat-card">
            <p>Imported</p>
            <strong>{importedCount}</strong>
          </div>
          <div className="stat-card">
            <p>Healthy skills</p>
            <strong>{insights?.healthSummary?.passed || 0}</strong>
          </div>
          <div className="stat-card">
            <p>Ready skills</p>
            <strong>{insights?.readySkills || 0}</strong>
          </div>
          <div className="stat-card">
            <p>Stable skills</p>
            <strong>{insights?.stableSkills || 0}</strong>
          </div>
        </div>

        <div className="browser-toolbar conductor-toolbar">
          <input
            value={query}
            onChange={(event) => searchSkills(event.target.value)}
            placeholder="Search active skills"
            className="search-field"
          />
          <select value={filter} onChange={(event) => updateFilter(event.target.value)} className="search-field">
            <option value="all">All skills</option>
            <option value="imported">Imported</option>
          </select>
          <select value={tag} onChange={(event) => updateTag(event.target.value)} className="search-field">
            <option value="">All tags</option>
            {topTags.map((item) => (
              <option key={item.tag} value={item.tag}>
                {item.tag} ({item.count})
              </option>
            ))}
          </select>
          <button className="button secondary" onClick={() => fetchSkills(query, filter, tag)} disabled={isLoading}>
            {isLoading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className="skill-grid conductor-grid">
          {skills.length > 0 ? (
            skills.map((skill) => (
              <Link href={`/skills/${encodeURIComponent(skill.name)}`} key={skill.name} className="skill-card">
                <div className="skill-card-header">
                  <div>
                    <h2>{skill.name}</h2>
                    <p className="skill-meta">{skill.description}</p>
                  </div>
                  <span className="skill-chip">View</span>
                </div>
                <div className="skill-card-footer">
                  <span className="skill-pill">{skill.importedTo ? "Imported" : "Available"}</span>
                  <span className={`skill-pill ${skill.healthStatus === "passed" ? "secondary" : ""}`}>
                    {skill.healthStatus}
                  </span>
                  <span className="skill-pill">{skill.qualityStatus}</span>
                  <span className="skill-pill">{skill.owner ? `Owner: ${skill.owner}` : "Owner: unassigned"}</span>
                  <span className="skill-pill">{`Freshness: ${skill.freshnessStatus}`}</span>
                  <span className="skill-pill">{`Grade ${skill.scorecard.grade}`}</span>
                  <span className="skill-pill">{skill.scorecard.stability}</span>
                  {skill.tags.slice(0, 3).map((item) => (
                    <span key={`${skill.name}-${item}`} className="skill-pill">
                      {item}
                    </span>
                  ))}
                </div>
              </Link>
            ))
          ) : (
            <div className="empty-state-card">
              <h2>No skills found</h2>
              <p>Use the button above to create a new skill or refresh the workspace.</p>
            </div>
          )}
        </div>
      </main>

      <div className={`toast ${toast.visible ? "visible" : ""} ${toast.type}`}>
        {toast.message}
      </div>
    </div>
  );
}
