import Link from "next/link";
import "./globals.css";

export const metadata = {
  title: "Conductor Studio",
  description: "A polished Next.js skill management studio for your team.",
};

export default function RootLayout({ children }) {
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
            </nav>
          </header>
          <main className="app-content">{children}</main>
        </div>
      </body>
    </html>
  );
}
