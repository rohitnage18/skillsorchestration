import Link from "next/link";
import { auth, signOut } from "../auth.js";
import "./globals.css";

export const metadata = {
  title: "Conductor Studio",
  description: "A polished Next.js skill management studio for your team.",
};

export default async function RootLayout({ children }) {
  const session = await auth();

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
              <Link href="/registry">Registry</Link>
              <Link href="/workflows">Workflows</Link>
              {session?.user?.role === "ADMIN" ? <Link href="/admin">Admin</Link> : null}
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
