import crypto from "crypto";

export const isProduction = process.env.NODE_ENV === "production";
const isProductionBuild =
  process.env.NEXT_PHASE === "phase-production-build" || process.env.npm_lifecycle_event === "build";

const placeholderPattern = /replace-with|changeme|example|your-|password|secret/i;

export function getAuthTrustHost() {
  if (process.env.AUTH_TRUST_HOST !== undefined) {
    return process.env.AUTH_TRUST_HOST === "true";
  }

  return !isProduction;
}

export function allowFirstUserAdmin() {
  return !isProduction || process.env.ALLOW_FIRST_USER_ADMIN === "true";
}

export function validateProductionSecurityEnv() {
  if (!isProduction || isProductionBuild) {
    return;
  }

  assertStrongSecret("AUTH_SECRET", 32);
  assertHttpsUrl("AUTH_URL");
  assertStrongSecret("SKILL_EVENTS_TOKEN", 32);

  if (!process.env.ADMIN_EMAILS?.trim()) {
    throw new Error("ADMIN_EMAILS must be set in production.");
  }

  const hasGoogle = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  const hasGitHub = Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
  if (!hasGoogle && !hasGitHub) {
    throw new Error("At least one OAuth provider must be configured in production.");
  }
}

export function verifyBearerToken(authHeader, expectedToken) {
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
  if (!expectedToken || !token) {
    return false;
  }

  const tokenBuffer = Buffer.from(token);
  const expectedBuffer = Buffer.from(expectedToken);
  if (tokenBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(tokenBuffer, expectedBuffer);
}

function assertStrongSecret(name, minLength) {
  const value = process.env[name];
  if (!value || value.length < minLength || placeholderPattern.test(value)) {
    throw new Error(`${name} must be a non-placeholder secret with at least ${minLength} characters in production.`);
  }
}

function assertHttpsUrl(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} must be set in production.`);
  }

  const url = new URL(value);
  if (url.protocol !== "https:") {
    throw new Error(`${name} must use https:// in production.`);
  }
}
