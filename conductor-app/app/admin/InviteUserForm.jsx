"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function InviteUserForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", message: "" });

  async function submitInvite(event) {
    event.preventDefault();
    setPending(true);
    setFeedback({ type: "", message: "" });

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = Object.fromEntries(
      Array.from(formData.entries()).filter(([, value]) => String(value).trim() !== "")
    );

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to add the user.");
      }

      form.reset();
      setFeedback({ type: "success", message: result.data.email + " is ready to join. Share sign-in instructions directly." });
      router.refresh();
    } catch (error) {
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "Unable to add the user." });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="invite-user-panel">
      <div className="invite-user-heading">
        <div>
          <strong>Invite a teammate</strong>
          <span id="invite-user-note">Create workspace access now. Email delivery is not enabled, so share sign-in instructions separately.</span>
        </div>
        <span className="status-pill neutral">Governed access</span>
      </div>
      <form className="invite-user-form" onSubmit={submitInvite} aria-describedby="invite-user-note">
        <label className="form-field">
          <span>Work email *</span>
          <input className="search-field" type="email" name="email" autoComplete="email" required placeholder="name@company.com" />
        </label>
        <label className="form-field">
          <span>Display name</span>
          <input className="search-field" type="text" name="name" autoComplete="name" placeholder="Avery Morgan" />
        </label>
        <label className="form-field">
          <span>Access level</span>
          <select className="search-field" name="role" defaultValue="USER">
            <option value="USER">Member</option>
            <option value="ADMIN">Administrator</option>
          </select>
        </label>
        <label className="form-field">
          <span>Working branch</span>
          <input className="search-field" type="text" name="preferredBranch" placeholder="users/avery" pattern="(users/)?[A-Za-z0-9._-]+" title="Use a personal branch such as users/avery or avery." />
        </label>
        <input type="hidden" name="status" value="INVITED" />
        <button className="button primary" type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add user"}
        </button>
      </form>
      <p className={"invite-user-feedback " + feedback.type} role="status" aria-live="polite">
        {feedback.message}
      </p>
    </div>
  );
}
