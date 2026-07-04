import Link from "next/link";

export default function Home() {
  return (
    <div className="dashboard-shell">
      <section className="dashboard-hero">
        <div className="hero-copy">
          <p className="eyebrow">Conductor Studio</p>
          <h1>Manage skill import workflows with a modern command center.</h1>
          <p className="hero-description">
            A polished interface for discovering, validating, and staging skill workspaces — no raw markdown exposed, no surprise imports, only clear actions.
          </p>

          <div className="hero-actions">
            <Link href="/skills" className="button primary">
              Open Skill IDE
            </Link>
            <button className="button secondary">Import sample workspace</button>
          </div>

          <div className="hero-badges">
            <span className="hero-badge">Safe import staging</span>
            <span className="hero-badge">Guided workspace validation</span>
            <span className="hero-badge">Audit-ready output</span>
          </div>

          <div className="hero-stat-row">
            <div className="hero-stat">
              <strong>28</strong>
              <span>Skills tracked</span>
            </div>
            <div className="hero-stat">
              <strong>9</strong>
              <span>Import-ready workspaces</span>
            </div>
            <div className="hero-stat">
              <strong>4</strong>
              <span>Workflow stages</span>
            </div>
            <div className="hero-stat">
              <strong>100%</strong>
              <span>Markdown hidden</span>
            </div>
          </div>
        </div>

        <div className="hero-aside">
          <div className="metric-card feature-card hero-feature-card">
            <div className="metric-icon accent">✓</div>
            <div>
              <p>Live validation</p>
              <strong>Confidence before import</strong>
            </div>
          </div>
          <div className="metric-card feature-card hero-feature-card">
            <div className="metric-icon accent">⧗</div>
            <div>
              <p>Safe staging</p>
              <strong>Isolated workspace creation</strong>
            </div>
          </div>
          <div className="metric-card feature-card hero-feature-card">
            <div className="metric-icon accent">★</div>
            <div>
              <p>Startup polish</p>
              <strong>Ready for demos and reviews</strong>
            </div>
          </div>
        </div>
      </section>

      <aside className="dashboard-right">
        <div className="activity-card pulse-card">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Team pulse</p>
              <h3>Workflow status at a glance</h3>
            </div>
            <span className="status-pill success">Healthy</span>
          </div>
          <div className="activity-item">
            <p>Recent import</p>
            <span>3 minutes ago</span>
          </div>
          <div className="activity-item">
            <p>Validation checks</p>
            <span>Live and active</span>
          </div>
          <div className="activity-item">
            <p>Workspace staging</p>
            <span>4 pending</span>
          </div>
        </div>
      </aside>
    </div>
  );
}
