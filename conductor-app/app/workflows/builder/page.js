"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

const initialNodes = [
  {
    id: "input",
    type: "input",
    position: { x: 80, y: 160 },
    data: { label: "Workflow Input", workflowType: "input" },
  },
  {
    id: "output",
    type: "output",
    position: { x: 760, y: 160 },
    data: { label: "Workflow Output", workflowType: "output" },
  },
];

const initialEdges = [];

const defaultRunInput = `{
  "message": "Hello visual workflow"
}`;

function parseJson(value) {
  return JSON.parse(value || "{}");
}

function toWorkflowDefinition(nodes, edges) {
  return {
    nodes: nodes.map((node) => ({
      id: node.id,
      type: node.data.workflowType,
      skillId: node.data.skillId,
      position: node.position,
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      mapping: edge.data?.mapping,
    })),
  };
}

function buildDefaultMapping(sourceNode, targetNode) {
  if (sourceNode?.data.workflowType === "input" && targetNode?.data.workflowType === "skill") {
    return { message: "message" };
  }

  return undefined;
}

export default function WorkflowBuilderPage() {
  const [skills, setSkills] = useState([]);
  const [nodes, setNodes] = useState(initialNodes);
  const [edges, setEdges] = useState(initialEdges);
  const [workflowName, setWorkflowName] = useState("Visual workflow");
  const [savedWorkflow, setSavedWorkflow] = useState(null);
  const [runInput, setRunInput] = useState(defaultRunInput);
  const [runResult, setRunResult] = useState(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const definitionPreview = useMemo(() => toWorkflowDefinition(nodes, edges), [nodes, edges]);

  useEffect(() => {
    fetch("/api/registry/skills")
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data.error || "Unable to load skills");
        setSkills(data);
      })
      .catch((error) => setMessage(error.message));
  }, []);

  const onNodesChange = useCallback((changes) => {
    setNodes((currentNodes) => applyNodeChanges(changes, currentNodes));
  }, []);

  const onEdgesChange = useCallback((changes) => {
    setEdges((currentEdges) => applyEdgeChanges(changes, currentEdges));
  }, []);

  const onConnect = useCallback(
    (connection) => {
      setEdges((currentEdges) => {
        const sourceNode = nodes.find((node) => node.id === connection.source);
        const targetNode = nodes.find((node) => node.id === connection.target);
        const edgeId = `${connection.source}-${connection.target}-${Date.now()}`;

        return addEdge(
          {
            ...connection,
            id: edgeId,
            animated: true,
            data: {
              mapping: buildDefaultMapping(sourceNode, targetNode),
            },
          },
          currentEdges,
        );
      });
    },
    [nodes],
  );

  function addSkillNode(skill) {
    const nodeIndex = nodes.filter((node) => node.data.workflowType === "skill").length + 1;
    setNodes((currentNodes) => [
      ...currentNodes,
      {
        id: `skill-${skill.slug}-${Date.now()}`,
        position: { x: 360, y: 80 + nodeIndex * 90 },
        data: {
          label: skill.name,
          workflowType: "skill",
          skillId: skill.id,
        },
      },
    ]);
  }

  async function saveWorkflow() {
    setIsLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: workflowName,
          definition: definitionPreview,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to save workflow");

      setSavedWorkflow(data);
      setMessage(`Saved ${data.name}`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function runWorkflow() {
    if (!savedWorkflow) {
      setMessage("Save the workflow before running it.");
      return;
    }

    setIsLoading(true);
    setRunResult(null);
    setMessage("");

    try {
      const res = await fetch(`/api/workflows/${encodeURIComponent(savedWorkflow.id)}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: parseJson(runInput) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to run workflow");

      setRunResult(data);
      setMessage(`Run ${data.status.toLowerCase()}`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="builder-shell">
      <section className="builder-sidebar studio-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Visual Builder</p>
            <h3>Skills</h3>
          </div>
        </div>

        <label className="form-field">
          <span>Workflow name</span>
          <input className="search-field" value={workflowName} onChange={(event) => setWorkflowName(event.target.value)} />
        </label>

        <div className="compact-list">
          {skills.length > 0 ? (
            skills.map((skill) => (
              <button key={skill.id} className="compact-row" onClick={() => addSkillNode(skill)}>
                <span>{skill.name}</span>
                <strong>Add</strong>
              </button>
            ))
          ) : (
            <div className="empty-state-card">
              <h2>No registry skills</h2>
              <p>Create one in the Registry first.</p>
            </div>
          )}
        </div>

        <div className="builder-actions">
          <button className="button primary full-width" onClick={saveWorkflow} disabled={isLoading}>
            Save workflow
          </button>
          <button className="button secondary full-width" onClick={runWorkflow} disabled={isLoading || !savedWorkflow}>
            Run saved workflow
          </button>
        </div>
      </section>

      <main className="builder-canvas-card">
        <div className="builder-toolbar">
          <div>
            <p className="eyebrow">Canvas</p>
            <h1>Connect input → skills → output</h1>
          </div>
          <span className="status-pill neutral">{savedWorkflow ? "Saved" : "Unsaved"}</span>
        </div>

        <div className="flow-canvas">
          <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} fitView>
            <Background />
            <Controls />
            <MiniMap />
          </ReactFlow>
        </div>
      </main>

      <aside className="builder-sidebar studio-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Run</p>
            <h3>Input and output</h3>
          </div>
        </div>

        <label className="form-field">
          <span>Run input</span>
          <textarea className="code-textarea" value={runInput} onChange={(event) => setRunInput(event.target.value)} rows={8} />
        </label>

        <div className="panel-header">
          <div>
            <p className="eyebrow">Definition</p>
            <h3>Generated JSON</h3>
          </div>
        </div>

        <pre className="result-pre builder-preview">{JSON.stringify(definitionPreview, null, 2)}</pre>

        {runResult ? <pre className="result-pre">{JSON.stringify(runResult, null, 2)}</pre> : null}
      </aside>

      {message ? <div className="toast visible info">{message}</div> : null}
    </div>
  );
}
