import { z } from "zod";

export const MAX_SKILL_NAME_LENGTH = 80;
export const MAX_DESCRIPTION_LENGTH = 500;
export const MAX_SKILL_FILE_BYTES = 250_000;
export const MAX_EVENT_JSON_BYTES = 50_000;
export const MAX_METADATA_DEPTH = 5;

const skillNamePattern = /^[a-z0-9][a-z0-9_-]{0,79}$/;
const referenceFilePattern = /^references\/[A-Za-z0-9][A-Za-z0-9._-]{0,119}\.md$/;

export function inputError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export function normalizeSkillNameInput(value) {
  const normalized = String(value ?? "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();

  if (!skillNamePattern.test(normalized)) {
    throw inputError(
      "Skill name must be 1-80 characters and use only letters, numbers, hyphens, or underscores."
    );
  }

  return normalized;
}

export function sanitizeDescription(value) {
  return sanitizeText(value ?? "New skill", MAX_DESCRIPTION_LENGTH, "Description");
}

export function sanitizeText(value, maxLength, label = "Text") {
  const text = String(value ?? "").replace(/\0/g, "").trim();
  if (text.length > maxLength) {
    throw inputError(`${label} must be ${maxLength} characters or fewer.`);
  }
  return text;
}

export function normalizeEditableSkillPath(value) {
  const normalizedPath = String(value ?? "").trim().replace(/\\/g, "/");
  const isSkillFile = normalizedPath === "SKILL.md";
  const isReferenceFile =
    referenceFilePattern.test(normalizedPath) &&
    !normalizedPath.includes("..") &&
    normalizedPath.split("/").length === 2;

  if (!isSkillFile && !isReferenceFile) {
    throw inputError("Only SKILL.md and references/*.md files can be edited.");
  }

  return normalizedPath;
}

export function assertSkillFileContent(value) {
  const content = String(value ?? "");
  const bytes = Buffer.byteLength(content, "utf-8");
  if (bytes > MAX_SKILL_FILE_BYTES) {
    throw inputError(`Skill file content must be ${MAX_SKILL_FILE_BYTES} bytes or fewer.`);
  }
  return content;
}

export function assertJsonByteSize(value, maxBytes = MAX_EVENT_JSON_BYTES, label = "Payload") {
  const bytes = Buffer.byteLength(JSON.stringify(value ?? {}), "utf-8");
  if (bytes > maxBytes) {
    throw inputError(`${label} must be ${maxBytes} bytes or fewer.`);
  }
  return value;
}

export function assertSafeJsonValue(value, label = "Metadata", depth = 0) {
  if (depth > MAX_METADATA_DEPTH) {
    throw inputError(`${label} is nested too deeply.`);
  }

  if (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    if (value.length > 50) {
      throw inputError(`${label} arrays can contain at most 50 items.`);
    }
    return value.map((item) => assertSafeJsonValue(item, label, depth + 1));
  }

  if (typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length > 50) {
      throw inputError(`${label} objects can contain at most 50 keys.`);
    }

    return Object.fromEntries(
      entries.map(([key, item]) => {
        const safeKey = sanitizeText(key, 80, `${label} key`);
        return [safeKey, assertSafeJsonValue(item, label, depth + 1)];
      })
    );
  }

  throw inputError(`${label} contains an unsupported value.`);
}

export const skillNameSchema = z
  .string()
  .trim()
  .min(1)
  .transform((value) => normalizeSkillNameInput(value));

export const descriptionSchema = z
  .string()
  .optional()
  .transform((value) => sanitizeDescription(value));

export const editableSkillPathSchema = z
  .string()
  .trim()
  .min(1)
  .transform((value) => normalizeEditableSkillPath(value));

export const skillFileContentSchema = z
  .string()
  .transform((value) => assertSkillFileContent(value));
