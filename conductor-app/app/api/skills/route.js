import { createSkill, findSimilarSkills, getSkillInsights, listSkills } from "../../../lib/skillStorage.js";
import { getErrorStatus, requirePermission } from "../../../lib/auth.js";
import { sanitizeDescription, sanitizeText, normalizeSkillNameInput } from "../../../lib/inputSafety.js";
import { buildRateLimitKey, enforceRateLimit } from "../../../lib/requestSecurity.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function GET(req) {
  const url = new URL(req.url);
  const q = sanitizeText(url.searchParams.get("q") || "", 100, "Search query");
  const filter = sanitizeText(url.searchParams.get("filter") || "all", 20, "Filter");
  const tag = sanitizeText(url.searchParams.get("tag") || "", 40, "Tag");
  if (url.searchParams.get("view") === "insights") {
    return json(getSkillInsights());
  }
  if (url.searchParams.get("view") === "similarity") {
    const skillName = sanitizeText(url.searchParams.get("skillName") || "", 80, "Skill name");
    const description = sanitizeText(url.searchParams.get("description") || "", 500, "Description");
    const triggerDescription = sanitizeText(
      url.searchParams.get("triggerDescription") || "",
      240,
      "Trigger description"
    );
    const tags = sanitizeText(url.searchParams.get("tags") || "", 240, "Tags")
      .split(",")
      .map((tagValue) => tagValue.trim())
      .filter(Boolean);
    const starterReferences = sanitizeText(url.searchParams.get("references") || "", 240, "References")
      .split(",")
      .map((title) => title.trim())
      .filter(Boolean)
      .map((title) => ({ title, summary: "" }));
    return json(
      findSimilarSkills({
        skillName,
        description,
        triggerDescription,
        tags,
        starterReferences,
      })
    );
  }
  return json(listSkills(q, filter, tag));
}

export async function POST(req) {
  try {
    const user = await requirePermission(req.headers, "skills:manage");
    enforceRateLimit({
      bucket: "skills-create",
      key: buildRateLimitKey(req.headers, "skills-create", user.id),
      limit: 15,
      windowMs: 60_000,
    });
    const body = await req.json();
    const skillName = normalizeSkillNameInput(body.skillName);
    const description = sanitizeDescription(body.description);
    const role = sanitizeText(body.role || "", 120, "Role");
    const owner = sanitizeText(body.owner || "", 120, "Owner");
    const reviewer = sanitizeText(body.reviewer || "", 120, "Reviewer");
    const qualityStatus = ["draft", "reviewed", "production-ready"].includes(body.qualityStatus)
      ? body.qualityStatus
      : "draft";
    const triggerDescription = sanitizeText(body.triggerDescription || "", 240, "Trigger description");
    const tags = Array.isArray(body.tags)
      ? body.tags.map((tag) => sanitizeText(tag, 40, "Tag"))
      : [];
    const starterReferences = Array.isArray(body.starterReferences)
      ? body.starterReferences.map((reference, index) => ({
          title: sanitizeText(reference?.title || `Reference ${index + 1}`, 120, "Reference title"),
          summary: sanitizeText(reference?.summary || "", 240, "Reference summary"),
        }))
      : [];
    const confirmDuplicate = body.confirmDuplicate === true;
    const similarity = findSimilarSkills({
      skillName,
      description,
      triggerDescription,
      tags,
      starterReferences,
    });

    if (similarity.hasHighSimilarity && !confirmDuplicate) {
      return json(
        {
          error: "This new skill is highly similar to an existing skill. Confirm duplicate creation to continue.",
          code: "DUPLICATE_CONFIRMATION_REQUIRED",
          similarity,
        },
        409
      );
    }

    const created = await createSkill(skillName, description, user.id, {
      role,
      owner,
      reviewer,
      qualityStatus,
      triggerDescription,
      tags,
      starterReferences,
    });
    return json({ skillName: created });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create skill";
    const status = message.includes("already exists") ? 409 : 400;
    return json({ error: message }, getErrorStatus(error, status));
  }
}
