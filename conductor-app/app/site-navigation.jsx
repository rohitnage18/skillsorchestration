"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Overview", icon: "overview" },
  { href: "/skills", label: "Skills", icon: "skills" },
  { href: "/registry", label: "Registry", icon: "registry", adminOnly: true },
  { href: "/workflows", label: "Workflows", icon: "workflow", adminOnly: true },
  { href: "/admin", label: "Command center", icon: "admin", adminOnly: true },
];

function NavIcon({ name }) {
  const paths = {
    overview: <><path d="M4 13h6V4H4v9Z" /><path d="M14 20h6v-9h-6v9Z" /><path d="M4 20h6v-3H4v3Z" /><path d="M14 7h6V4h-6v3Z" /></>,
    skills: <><path d="m12 3 8 4.5-8 4.5-8-4.5L12 3Z" /><path d="m4 12 8 4.5 8-4.5" /><path d="m4 16.5 8 4.5 8-4.5" /></>,
    registry: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" /><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" /></>,
    workflow: <><rect x="3" y="4" width="6" height="5" rx="1" /><rect x="15" y="15" width="6" height="5" rx="1" /><path d="M9 6.5h3a5 5 0 0 1 5 5V15" /><path d="m14 12 3 3 3-3" /></>,
    admin: <><path d="M12 3 4.5 6v5c0 4.6 3.2 8.3 7.5 10 4.3-1.7 7.5-5.4 7.5-10V6L12 3Z" /><path d="m9 12 2 2 4-4" /></>,
  };

  return (
    <svg aria-hidden="true" className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}

export default function SiteNavigation({ isAdmin, unreadCount }) {
  const pathname = usePathname();

  return (
    <nav className="site-nav" aria-label="Primary navigation">
      <p className="nav-section-label">Workspace</p>
      {navItems
        .filter((item) => !item.adminOnly || isAdmin)
        .map((item) => {
          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link href={item.href} key={item.href} className={isActive ? "is-active" : undefined} aria-current={isActive ? "page" : undefined} aria-label={item.label}>
              <NavIcon name={item.icon} />
              <span>{item.label}</span>
              {item.href === "/admin" && unreadCount > 0 ? (
                <span className="nav-badge" aria-label={unreadCount + " unread notifications"}>{unreadCount}</span>
              ) : null}
            </Link>
          );
        })}
    </nav>
  );
}