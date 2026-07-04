"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const initialToast = { visible: false, message: "", type: "info" };

export default function SkillsHome() {
  const [skills, setSkills] = useState([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState(initialToast);

  useEffect(() => {
    fetchSkills();
  }, []);

  useEffect(() => {
    if (!toast.visible) return;
    const timer = window.setTimeout(() => setToast(initialToast), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const fetchSkills = async (search = "", filterValue = filter) => {
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (search) queryParams.set("q", search);
      if (filterValue && filterValue !== "all") queryParams.set("filter", filterValue);
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

  const createSkill = async () => {
    const skillName = window.prompt("New skill ID (letters, numbers, hyphens, underscores):");
    if (!skillName) return;
      const description = "New skill";

    try {
      const res = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillName, description }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to create skill");
      setToast({ visible: true, message: `Created ${data.skillName}`, type: "success" });
      setQuery("");
      fetchSkills("", filter);
    } catch (error) {
      setToast({ visible: true, message: error.message, type: "error" });
    }
  };

  const searchSkills = (value) => {
    setQuery(value);
    fetchSkills(value, filter);
  };

  const updateFilter = (value) => {
    setFilter(value);
    fetchSkills(query, value);
  };

  const importedCount = skills.filter((skill) => skill.importedTo).length;

  return (
    <div className="conductor-shell conductor-full-width">
      <main className="conductor-main conductor-main-full">
        <div className="page-header conductor-header">
          <div>
            <p className="eyebrow">Skill IDE</p>
            <h1>Find, validate, and stage skills in one polished view.</h1>
            <p className="page-copy">Search skills, open workspaces, and review import readiness.</p>
          </div>
          <button className="button primary" onClick={createSkill}>
            Create skill
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
            <p>Hidden markdown</p>
            <strong>Yes</strong>
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
          <button className="button secondary" onClick={() => fetchSkills(query, filter)} disabled={isLoading}>
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
                  </div>
                  <span className="skill-chip">Open</span>
                </div>
                <div className="skill-card-footer">
                  <span className="skill-pill">{skill.importedTo ? "Imported" : "Ready to import"}</span>
                  <span className="skill-pill secondary">Hidden markdown</span>
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
