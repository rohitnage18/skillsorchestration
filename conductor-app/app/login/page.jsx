import { signIn } from "../../auth.js";

const providers = [
  {
    id: "google",
    label: "Continue with Google",
    enabled: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  },
  {
    id: "github",
    label: "Continue with GitHub",
    enabled: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
  },
];

export default function LoginPage() {
  const enabledProviders = providers.filter((provider) => provider.enabled);

  return (
    <section className="auth-panel">
      <p className="eyebrow">Secure access</p>
      <h1>Sign in to Conductor Studio</h1>
      <p className="muted-text">
        Google/GitHub login creates or updates your user record in Prisma. The first user, or any email in
        `ADMIN_EMAILS`, becomes an admin.
      </p>

      <div className="auth-actions">
        {enabledProviders.map((provider) => (
          <form
            key={provider.id}
            action={async () => {
              "use server";
              await signIn(provider.id, { redirectTo: "/admin" });
            }}
          >
            <button className="button primary" type="submit">
              {provider.label}
            </button>
          </form>
        ))}
      </div>

      {enabledProviders.length === 0 ? (
        <div className="empty-state">
          Add Google or GitHub OAuth credentials in `.env`, then restart the app.
        </div>
      ) : null}
    </section>
  );
}
