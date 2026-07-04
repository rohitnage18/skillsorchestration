"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

function sampleWorkflow(skillId = "replace-with-skill-id") {
  return JSON.stringify(
    {
      nodes: [
        { id: "input", type: "input" },
        { id: "run-skill", type: "skill", skillId },
        { id: "output", type: "output" },
      ],
      edges: [
        { id: "input-to-skill", source: "input", target: "run-skill", mapping: { message: "message" } },
        { id: "skill-to-output", source: "run-skill", target: "output" },
      ],
    },
    null,
    2,
  );
}

const defaultExecutionInput = `{
  "message": "Workflow hello"
}`;

function parseJson(value) {
  return JSON.parse(value || "{}");
}

export default function WorkflowsPage() {
  const [skills, setSkills] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [name, setName] = useState("Echo workflow");
  const [definition, setDefinition] = useState(sampleWorkflow());
  const [selectedWorkflowId, setSelectedWorkflowId] = useState("");
  const [executionInput, setExecutionInput] = useState(defaultExecutionInput);
  const [runResult, setRunResult] = useState(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const selectedWorkflow = useMemo(
    () => workflows.find((workflow) => workflow.id === selectedWorkflowId),
    [workflows, selectedWorkflowId],
  );

  async function loadData() {
    const [skillsRes, workflowsRes] = await Promise.all([fetch("/api/registry/skills"), fetch("/api/workflows")]);
    const [skillsData, workflowsData] = await Promise.all([skillsRes.json(), workflowsRes.json()]);

    if (!skillsRes.ok) throw new Error(skillsData.error || "Unable to load skills");
    if (!workflowsRes.ok) throw new Error(workflowsData.error || "Unable to load workflows");

    setSkills(skillsData);
    setWorkflows(workflowsData);
    if (!selectedWorkflowId && workflowsData[0]) {
      setSelectedWorkflowId(workflowsData[0].id);
    }
  }

  useEffect(() => {
    loadData().catch((error) => setMessage(error.message));
  }, []);

  function useFirstSkill() {
    if (!skills[0]) {
      setMessage("Create a registry skill first.");
      return;
    }

    setDefinition(sampleWorkflow(skills[0].id));
  }

  async function createWorkflow(event) {
    event.preventDefault();
    setIsLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          definition: parseJson(definition),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to create workflow");

      setSelectedWorkflowId(data.id);
      setMessage(`Created ${data.name}`);
      await loadData();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function executeWorkflow() {
    if (!selectedWorkflow) return;
    setIsLoading(true);
    setRunResult(null);
    setMessage("");

    try {
      const res = await fetch(`/api/workflows/${encodeURIComponent(selectedWorkflow.id)}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: parseJson(executionInput) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to execute workflow");

      setRunResult(data);
      setMessage(`Workflow run ${data.status.toLowerCase()}`);
      await loadData();
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
            <p className="eyebrow">Workflow Studio</p>
            <h1>Connect registered skills into executable workflows.</h1>
            <p className="page-copy">Start with JSON definitions now; a visual canvas can sit on top of this engine next.</p>
          </div>
          <div className="header-actions">
            <Link className="button primary" href="/workflows/builder">
              Open visual builder
            </Link>
            <button className="button secondary" onClick={loadData} disabled={isLoading}>
              Refresh
            </button>
          </div>
        </div>

        <div className="registry-layout">
          <form className="studio-panel" onSubmit={createWorkflow}>
            <div className="panel-header">
              <div>
                <p className="eyebrow">Create</p>
                <h3>Workflow definition</h3>
              </div>
              <button type="button" className="button secondary" onClick={useFirstSkill}>
                Use first skill
              </button>
            </div>

            <label className="form-field">
              <span>Name</span>
              <input className="search-field" value={name} onChange={(event) => setName(event.target.value)} required />
            </label>

            <label className="form-field">
              <span>Definition JSON</span>
              <textarea className="code-textarea tall" value={definition} onChange={(event) => setDefinition(event.target.value)} />
            </label>

            <button className="button primary full-width" disabled={isLoading}>
              Create workflow
            </button>
          </form>

          <section className="studio-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Run</p>
                <h3>Execute workflow</h3>
              </div>
            </div>

            <label className="form-field">
              <span>Workflow</span>
              <select className="search-field" value={selectedWorkflowId} onChange={(event) => setSelectedWorkflowId(event.target.value)}>
                <option value="">Select workflow</option>
                {workflows.map((workflow) => (
                  <option key={workflow.id} value={workflow.id}>
                    {workflow.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-field">
              <span>Input JSON</span>
              <textarea className="code-textarea" value={executionInput} onChange={(event) => setExecutionInput(event.target.value)} rows={8} />
            </label>

            <button className="button primary full-width" onClick={executeWorkflow} disabled={!selectedWorkflow || isLoading}>
              Execute workflow
            </button>

            {runResult ? (
              <pre className="result-pre">{JSON.stringify(runResult, null, 2)}</pre>
            ) : (
              <div className="empty-state-card">
                <h2>No run yet</h2>
                <p>Select a workflow and execute it with JSON input.</p>
              </div>
            )}
          </section>

          <section className="studio-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Inventory</p>
                <h3>{workflows.length} workflows</h3>
              </div>
            </div>
            <div className="compact-list">
              {workflows.map((workflow) => (
                <button key={workflow.id} className="compact-row" onClick={() => setSelectedWorkflowId(workflow.id)}>
                  <span>{workflow.name}</span>
                  <strong>v{workflow.version}</strong>
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
