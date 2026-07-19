import Link from "next/link";
import { auth, signOut } from "../auth.js";
import { db } from "../lib/db";
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
        <div className="app-shell">
          <header className="site-header">
            <div className="brand-group">
              <div className="brand-logo">CS</div>
              <div>
                <p className="brand-name">Conductor Studio</p>
                <p className="brand-tag">Workspace for skill imports and validation</p>
              </div>
            </div>
            <nav className="site-nav">
              <Link href="/">Home</Link>
              <Link href="/skills">Skills</Link>
              {session?.user?.role === "ADMIN" ? (
                <>
                  <Link href="/registry">Registry</Link>
                  <Link href="/workflows">Workflows</Link>
                  <Link href="/admin" className="nav-link-with-badge">
                    Admin
                    {unreadCount > 0 ? <span className="nav-badge">{unreadCount}</span> : null}
                  </Link>
                </>
              ) : null}
              {session?.user ? (
                <form
                  action={async () => {
                    "use server";
                    await signOut({ redirectTo: "/" });
                  }}
                >
                  <button className="nav-button" type="submit">
                    Sign out
                  </button>
                </form>
              ) : (
                <Link href="/login">Sign in</Link>
              )}
            </nav>
          </header>
          <main className="app-content">{children}</main>
        </div>
      </body>
    </html>
  );
}
