"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const initialToast = { visible: false, message: "", type: "info" };

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

  const createSkill = async () => {
    const skillName = window.prompt("New skill ID (letters, numbers, hyphens, underscores):");
    if (!skillName) return;
    const description = "New skill";

    try {
      const res = await fetch("/api/skills", {
        method: "POST",
        headers: getRequestHeaders(),
        body: JSON.stringify({ skillName, description }),
      });
      const data = await res.json();
      if (res.status === 403) {
        await requestSkillCreate(skillName, description);
        setToast({ visible: true, message: `Approval requested for ${skillName}`, type: "success" });
        return;
      }
      if (!res.ok) throw new Error(data.error || "Unable to create skill");
      setToast({ visible: true, message: `Created ${data.skillName}`, type: "success" });
      setQuery("");
      fetchSkills("", filter, tag);
      fetchInsights();
    } catch (error) {
      setToast({ visible: true, message: error.message, type: "error" });
    }
  };

  const requestSkillCreate = async (skillName, description) => {
    const res = await fetch("/api/skill-change-requests", {
      method: "POST",
      headers: getRequestHeaders(),
      body: JSON.stringify({ type: "SKILL_CREATE", skillName, description }),
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
          <button className="button primary" onClick={createSkill}>
            Request new skill
          </button>
        </div>

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
