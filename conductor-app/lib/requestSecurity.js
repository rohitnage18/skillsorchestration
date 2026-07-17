const rateLimitBuckets = new Map();
const replayBuckets = new Map();

function nowMs() {
  return Date.now();
}

export function getClientAddress(headers) {
  const forwarded = headers?.get?.("x-forwarded-for") || "";
  const firstForwarded = forwarded.split(",")[0]?.trim();
  if (firstForwarded) {
    return firstForwarded;
  }

  const realIp = headers?.get?.("x-real-ip") || "";
  if (realIp.trim()) {
    return realIp.trim();
  }

  return "unknown";
}

export function buildRateLimitKey(headers, scope = "global", actor = "") {
  const address = getClientAddress(headers);
  return [scope, actor || "", address].filter(Boolean).join(":");
}

export function enforceRateLimit({
  bucket,
  key,
  limit,
  windowMs,
  now = nowMs(),
}) {
  const bucketKey = `${bucket}:${key}`;
  const current = rateLimitBuckets.get(bucketKey);

  if (!current || now >= current.resetAt) {
    rateLimitBuckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
    pruneExpiredEntries(rateLimitBuckets, now);
    return {
      allowed: true,
      remaining: Math.max(0, limit - 1),
      resetAt: now + windowMs,
    };
  }

  if (current.count >= limit) {
    const error = new Error("Too many requests. Please wait and try again.");
    error.status = 429;
    error.retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
    throw error;
  }

  current.count += 1;
  rateLimitBuckets.set(bucketKey, current);
  return {
    allowed: true,
    remaining: Math.max(0, limit - current.count),
    resetAt: current.resetAt,
  };
}

export function assertReplayWindow({
  bucket,
  key,
  ttlMs,
  now = nowMs(),
}) {
  const bucketKey = `${bucket}:${key}`;
  const expiresAt = replayBuckets.get(bucketKey);

  if (expiresAt && expiresAt > now) {
    const error = new Error("Replay detected for external event.");
    error.status = 409;
    throw error;
  }

  replayBuckets.set(bucketKey, now + ttlMs);
  pruneExpiredEntries(replayBuckets, now);
}

function pruneExpiredEntries(store, now) {
  if (store.size < 500) {
    return;
  }

  for (const [key, value] of store.entries()) {
    const expiry = typeof value === "number" ? value : value.resetAt;
    if (expiry <= now) {
      store.delete(key);
    }
  }
}

export function __resetRequestSecurityTestState() {
  rateLimitBuckets.clear();
  replayBuckets.clear();
}
