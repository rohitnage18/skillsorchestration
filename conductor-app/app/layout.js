import Link from "next/link";
import { auth, signOut } from "../auth.js";
import { db } from "../lib/db";
import SiteNavigation from "./site-navigation";
import "./globals.css";

export const metadata = {
  title: "Conductor Studio",
  description: "A polished Next.js skill management studio for your team.",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }) {
  let session = null;
  let unreadCount = 0;

  try {
    session = await auth();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const name = error instanceof Error ? error.name : "";
    const isJwtSessionError =
      name.includes("JWTSessionError") ||
      message.includes("JWTSessionError") ||
      message.includes("JWEInvalid") ||
      message.includes("JWTInvalid");

    if (!isJwtSessionError) {
      throw error;
    }

    console.warn("Invalid or stale auth session detected in RootLayout, continuing as signed out.");
  }

  if (session?.user?.id) {
    try {
      unreadCount = await db.notification.count({
        where: {
          userId: session.user.id,
          read: false,
        },
      });
    } catch (error) {
      console.warn("Failed to load unread notifications in RootLayout:", error);
      unreadCount = 0;
    }
  }

  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">Skip to main content</a>
        <div className="app-shell">
          <header className="site-header">
            <div className="brand-group">
              <div className="brand-logo" aria-hidden="true">
                <span>C</span>
                <i />
              </div>
              <div>
                <p className="brand-name">Conductor</p>
                <p className="brand-tag">Skill operations studio</p>
              </div>
            </div>
            <div className="rail-rule" />
            <SiteNavigation isAdmin={session?.user?.role === "ADMIN"} unreadCount={unreadCount} />
            <div className="rail-footer">
              <div className="system-status">
                <span className="status-dot" />
                <div>
                  <strong>Workspace online</strong>
                  <span>All systems nominal</span>
                </div>
              </div>
              {session?.user ? (
                <div className="user-menu">
                  <div className="user-avatar" aria-hidden="true">
                    {(session.user.name || session.user.email || "U").slice(0, 1).toUpperCase()}
                  </div>
                  <div className="user-meta">
                    <strong>{session.user.name || "Workspace member"}</strong>
                    <span>{session.user.role === "ADMIN" ? "Administrator" : "Member"}</span>
                  </div>
                  <form
                    action={async () => {
                      "use server";
                      await signOut({ redirectTo: "/" });
                    }}
                  >
                    <button className="signout-button" type="submit" aria-label="Sign out" title="Sign out">
                      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10 17l5-5-5-5" />
                        <path d="M15 12H3" />
                        <path d="M15 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
                      </svg>
                    </button>
                  </form>
                </div>
              ) : (
                <Link className="rail-signin" href="/login">Sign in to workspace <span aria-hidden="true">-&gt;</span></Link>
              )}
            </div>
          </header>
          <main className="app-content" id="main-content">{children}</main>
        </div>
      </body>
    </html>
  );
}
