import Link from "next/link";
import { getSkillInsights } from "../lib/skillStorage.js";
import { listReleaseSnapshots } from "../lib/operations.js";

export default function Home() {
  const insights = getSkillInsights();
  const latestSnapshot = listReleaseSnapshots(1)[0] || null;
  const systemLanes = [
    {
      title: "Skill operations",
      detail: `${insights.totalSkills} skills tracked with ${insights.readySkills} ready for use.`,
    },
    {
      title: "Quality watch",
      detail: `${insights.healthSummary.failed || 0} failed checks and ${insights.healthSummary.warning || 0} warnings need attention.`,
    },
    {
      title: "Stable set",
      detail: `${insights.stableSkills} skills are currently in the stable lane.`,
    },
  ];

  return (
    <div className="dashboard-shell">
      <section className="dashboard-hero">
        <div className="hero-copy">
          <p className="eyebrow">Conductor Studio</p>
          <h1>Run a governed skill library with a UI that feels like a real operator console.</h1>
          <p className="hero-description">
            Browse approved skills, validate them before use, watch release health, and keep every important decision
            visible to the team.
          </p>

          <div className="hero-actions">
            <Link href="/skills" className="button primary">
              Browse skills
            </Link>
            <Link href="/admin" className="button secondary">
              Open command center
            </Link>
          </div>

          <div className="hero-badges">
            <span className="hero-badge">Role-based access</span>
            <span className="hero-badge">Admin approvals</span>
            <span className="hero-badge">Audit logs</span>
            <span className="hero-badge">Release snapshots</span>
          </div>

          <div className="hero-stat-row">
            <div className="hero-stat">
              <strong>{insights.totalSkills}</strong>
              <span>Skills in library</span>
            </div>
            <div className="hero-stat">
              <strong>{insights.readySkills}</strong>
              <span>Ready for use</span>
            </div>
            <div className="hero-stat">
              <strong>{latestSnapshot ? latestSnapshot.id.slice(0, 10) : "Live"}</strong>
              <span>{latestSnapshot ? "Latest release snapshot" : "No snapshot yet"}</span>
            </div>
          </div>

          <div className="hero-command-strip">
            {systemLanes.map((lane) => (
              <div className="command-lane" key={lane.title}>
                <strong>{lane.title}</strong>
                <span>{lane.detail}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="hero-aside">
          <div className="metric-card feature-card hero-feature-card">
            <div className="metric-icon accent">LIB</div>
            <div>
              <p>Library signal</p>
              <strong>{insights.tagSummary?.[0] ? `${insights.tagSummary[0].tag} is the busiest tag` : "Track skill demand"}</strong>
            </div>
          </div>
          <div className="metric-card feature-card hero-feature-card">
            <div className="metric-icon accent">OPS</div>
            <div>
              <p>Operations</p>
              <strong>{latestSnapshot ? `Snapshot ${latestSnapshot.label}` : "Capture stable known-good states"}</strong>
            </div>
          </div>
          <div className="metric-card feature-card hero-feature-card">
            <div className="metric-icon accent">QA</div>
            <div>
              <p>Quality</p>
              <strong>{`${insights.healthSummary.passed || 0} healthy, ${insights.staleSkills} stale`}</strong>
            </div>
          </div>
        </div>
      </section>

      <aside className="dashboard-right">
        <div className="activity-card pulse-card">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Operator rhythm</p>
              <h3>What happens when teams use the system</h3>
            </div>
            <span className="status-pill success">Protected</span>
          </div>
          <div className="activity-item">
            <p>Skill discovery</p>
            <span>Users browse approved skills and keep one active context pinned.</span>
          </div>
          <div className="activity-item">
            <p>Validation lane</p>
            <span>Run checks, QA passes, and duplicate detection before scaling usage.</span>
          </div>
          <div className="activity-item">
            <p>Operational control</p>
            <span>Approvals, notifications, snapshots, and branch health stay in one command center.</span>
          </div>
        </div>
      </aside>
    </div>
  );
}
