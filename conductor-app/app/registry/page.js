"use client";

import { useEffect, useMemo, useState } from "react";

const defaultHttpInput = `{
  "message": "Hello from Conductor"
}`;

const defaultInputSchema = `{
  "type": "object",
  "additionalProperties": true
}`;

const initialForm = {
  name: "",
  slug: "",
  type: "SERVER_FUNCTION",
  endpointUrl: "",
  method: "POST",
  functionKey: "echo.v1",
  inputSchema: defaultInputSchema,
  outputSchema: defaultInputSchema,
};

function parseJson(value, fallback = {}) {
  try {
    return JSON.parse(value || "{}");
  } catch {
    return fallback;
  }
}

export default function RegistryPage() {
  const [skills, setSkills] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [selectedSkillId, setSelectedSkillId] = useState("");
  const [executionInput, setExecutionInput] = useState(defaultHttpInput);
  const [executionResult, setExecutionResult] = useState(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const selectedSkill = useMemo(
    () => skills.find((skill) => skill.id === selectedSkillId || skill.slug === selectedSkillId),
    [skills, selectedSkillId],
  );

  async function loadSkills() {
    const res = await fetch("/api/registry/skills");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Unable to load registry skills");
    setSkills(data);
    if (!selectedSkillId && data[0]) {
      setSelectedSkillId(data[0].id);
    }
  }

  useEffect(() => {
    loadSkills().catch((error) => setMessage(error.message));
  }, []);

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function createSkill(event) {
    event.preventDefault();
    setIsLoading(true);
    setMessage("");

    try {
      const payload = {
        name: form.name,
        slug: form.slug || undefined,
        type: form.type,
        endpointUrl: form.type === "HTTP" ? form.endpointUrl : undefined,
        method: form.type === "HTTP" ? form.method : undefined,
        functionKey: form.type === "SERVER_FUNCTION" ? form.functionKey : undefined,
        inputSchema: parseJson(form.inputSchema, { type: "object" }),
        outputSchema: parseJson(form.outputSchema, { type: "object" }),
      };

      const res = await fetch("/api/registry/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to create skill");

      setForm(initialForm);
      setSelectedSkillId(data.id);
      setMessage(`Created ${data.name}`);
      await loadSkills();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function executeSkill() {
    if (!selectedSkill) return;
    setIsLoading(true);
    setExecutionResult(null);
    setMessage("");

    try {
      const res = await fetch(`/api/registry/skills/${encodeURIComponent(selectedSkill.id)}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: parseJson(executionInput) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Skill execution failed");
      setExecutionResult(data);
      setMessage("Skill executed successfully");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="conductor-shell conductor-full-width">
      <main className="conductor-main conductor-main-full">
        <div className="page-header conductor-header">
          <div>
            <p className="eyebrow">Skill Registry</p>
            <h1>Create reusable HTTP and server-side skills.</h1>
            <p className="page-copy">Register a skill, test it, then plug it into workflows.</p>
          </div>
          <button className="button secondary" onClick={() => loadSkills()} disabled={isLoading}>
            Refresh
          </button>
        </div>

        <div className="registry-layout">
          <form className="studio-panel" onSubmit={createSkill}>
            <div className="panel-header">
              <div>
                <p className="eyebrow">Create</p>
                <h3>New registry skill</h3>
              </div>
            </div>

            <label className="form-field">
              <span>Name</span>
              <input className="search-field" value={form.name} onChange={(event) => updateForm("name", event.target.value)} required />
            </label>

            <label className="form-field">
              <span>Slug</span>
              <input className="search-field" value={form.slug} onChange={(event) => updateForm("slug", event.target.value)} placeholder="auto-generated if blank" />
            </label>

            <label className="form-field">
              <span>Type</span>
              <select className="search-field" value={form.type} onChange={(event) => updateForm("type", event.target.value)}>
                <option value="SERVER_FUNCTION">Server function</option>
                <option value="HTTP">HTTP endpoint</option>
              </select>
            </label>

            {form.type === "HTTP" ? (
              <>
                <label className="form-field">
                  <span>Endpoint URL</span>
                  <input className="search-field" value={form.endpointUrl} onChange={(event) => updateForm("endpointUrl", event.target.value)} placeholder="https://example.com/api/tool" />
                </label>
                <label className="form-field">
                  <span>Method</span>
                  <select className="search-field" value={form.method} onChange={(event) => updateForm("method", event.target.value)}>
                    <option>GET</option>
                    <option>POST</option>
                    <option>PUT</option>
                    <option>PATCH</option>
                    <option>DELETE</option>
                  </select>
                </label>
              </>
            ) : (
              <label className="form-field">
                <span>Function key</span>
                <input className="search-field" value={form.functionKey} onChange={(event) => updateForm("functionKey", event.target.value)} />
              </label>
            )}

            <label className="form-field">
              <span>Input schema</span>
              <textarea className="code-textarea" value={form.inputSchema} onChange={(event) => updateForm("inputSchema", event.target.value)} rows={5} />
            </label>

            <label className="form-field">
              <span>Output schema</span>
              <textarea className="code-textarea" value={form.outputSchema} onChange={(event) => updateForm("outputSchema", event.target.value)} rows={5} />
            </label>

            <button className="button primary full-width" disabled={isLoading}>
              {isLoading ? "Working..." : "Create registry skill"}
            </button>
          </form>

          <section className="studio-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Test</p>
                <h3>Execute a skill</h3>
              </div>
            </div>

            <label className="form-field">
              <span>Skill</span>
              <select className="search-field" value={selectedSkillId} onChange={(event) => setSelectedSkillId(event.target.value)}>
                <option value="">Select skill</option>
                {skills.map((skill) => (
                  <option key={skill.id} value={skill.id}>
                    {skill.name} · {skill.type}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-field">
              <span>Execution input</span>
              <textarea className="code-textarea" value={executionInput} onChange={(event) => setExecutionInput(event.target.value)} rows={8} />
            </label>

            <button className="button primary full-width" onClick={executeSkill} disabled={!selectedSkill || isLoading}>
              Execute skill
            </button>

            {executionResult ? (
              <pre className="result-pre">{JSON.stringify(executionResult, null, 2)}</pre>
            ) : (
              <div className="empty-state-card">
                <h2>No execution yet</h2>
                <p>Create or select a skill, then run it with JSON input.</p>
              </div>
            )}
          </section>

          <section className="studio-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Registered</p>
                <h3>{skills.length} skills</h3>
              </div>
            </div>
            <div className="compact-list">
              {skills.map((skill) => (
                <button key={skill.id} className="compact-row" onClick={() => setSelectedSkillId(skill.id)}>
                  <span>{skill.name}</span>
                  <strong>{skill.type}</strong>
                </button>
              ))}
            </div>
          </section>
        </div>

        {message ? <div className="toast visible info">{message}</div> : null}
      </main>
    </div>
  );
}
