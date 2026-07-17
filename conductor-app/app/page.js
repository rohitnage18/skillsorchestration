import Link from "next/link";

export default function Home() {
  return (
    <div className="dashboard-shell">
      <section className="dashboard-hero">
        <div className="hero-copy">
          <p className="eyebrow">Conductor Studio</p>
          <h1>Use approved skills with clean tracking and admin guardrails.</h1>
          <p className="hero-description">
            Browse the team skill library, validate skills before use, and keep important actions logged for admins.
          </p>

          <div className="hero-actions">
            <Link href="/skills" className="button primary">
              Browse skills
            </Link>
          </div>

          <div className="hero-badges">
            <span className="hero-badge">Role-based access</span>
            <span className="hero-badge">Admin approvals</span>
            <span className="hero-badge">Audit logs</span>
          </div>

          <div className="hero-stat-row">
            <div className="hero-stat">
              <strong>1</strong>
              <span>Shared skill library</span>
            </div>
            <div className="hero-stat">
              <strong>Admin</strong>
              <span>Approval required</span>
            </div>
            <div className="hero-stat">
              <strong>DB</strong>
              <span>Prisma audit logs</span>
            </div>
          </div>
        </div>

        <div className="hero-aside">
          <div className="metric-card feature-card hero-feature-card">
            <div className="metric-icon accent">OK</div>
            <div>
              <p>Validation</p>
              <strong>Check skills before use</strong>
            </div>
          </div>
          <div className="metric-card feature-card hero-feature-card">
            <div className="metric-icon accent">GO</div>
            <div>
              <p>Guardrails</p>
              <strong>Admin approval required</strong>
            </div>
          </div>
          <div className="metric-card feature-card hero-feature-card">
            <div className="metric-icon accent">TOP</div>
            <div>
              <p>Observability</p>
              <strong>Logs and emails for admins</strong>
            </div>
          </div>
        </div>
      </section>

      <aside className="dashboard-right">
        <div className="activity-card pulse-card">
          <div className="panel-header">
            <div>
              <p className="eyebrow">System flow</p>
              <h3>What happens when users act</h3>
            </div>
            <span className="status-pill success">Protected</span>
          </div>
          <div className="activity-item">
            <p>User actions</p>
            <span>Saved to Prisma</span>
          </div>
          <div className="activity-item">
            <p>Email alerts</p>
            <span>Sent for key events</span>
          </div>
          <div className="activity-item">
            <p>Skill changes</p>
            <span>Require admin approval</span>
          </div>
        </div>
      </aside>
    </div>
  );
}
