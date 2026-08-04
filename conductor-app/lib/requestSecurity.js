import { createClient } from "redis";

const REDIS_KEY_PREFIX = "conductor:request-security";
const globalRedisState = globalThis;
const memoryRateLimitBuckets = new Map();
const memoryClaimBuckets = new Map();
let requestSecurityTestBackend = null;

function nowMs() {
  return Date.now();
}

function createRateLimitError(retryAfterMs) {
  return Object.assign(new Error("Too many requests. Please wait and try again."), {
    status: 429,
    retryAfter: Math.max(1, Math.ceil(retryAfterMs / 1000)),
  });
}

function createReplayError() {
  return Object.assign(new Error("Replay detected for external event."), { status: 409 });
}

function redisKey(namespace, bucket, key) {
  return `${REDIS_KEY_PREFIX}:${namespace}:${bucket}:${key}`;
}

async function getRedisClient() {
  const url = process.env.REDIS_URL?.trim();
  if (!url) {
    return null;
  }

  if (!globalRedisState.__conductorRedisPromise || globalRedisState.__conductorRedisUrl !== url) {
    const client = createClient({ url });
    client.on("error", (error) => {
      console.error("Redis request-security client error:", error);
    });
    globalRedisState.__conductorRedisUrl = url;
    globalRedisState.__conductorRedisPromise = client.connect().then(() => client).catch((error) => {
      globalRedisState.__conductorRedisPromise = null;
      throw error;
    });
  }

  return globalRedisState.__conductorRedisPromise;
}

const redisBackend = {
  async increment(key, windowMs) {
    const client = await getRedisClient();
    const result = await client.eval(
      `local count = redis.call('INCR', KEYS[1])
       if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
       local ttl = redis.call('PTTL', KEYS[1])
       return { count, ttl }`,
      { keys: [key], arguments: [String(windowMs)] }
    );
    const [count, ttl] = result.map(Number);
    return { count, ttlMs: Math.max(1, ttl) };
  },
  async claim(key, ttlMs) {
    const client = await getRedisClient();
    return (await client.set(key, "1", { NX: true, PX: ttlMs })) === "OK";
  },
};

const memoryBackend = {
  async increment(key, windowMs, now = nowMs()) {
    const current = memoryRateLimitBuckets.get(key);
    if (!current || now >= current.resetAt) {
      memoryRateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs });
      pruneExpiredEntries(memoryRateLimitBuckets, now);
      return { count: 1, ttlMs: windowMs };
    }

    current.count += 1;
    memoryRateLimitBuckets.set(key, current);
    return { count: current.count, ttlMs: Math.max(1, current.resetAt - now) };
  },
  async claim(key, ttlMs, now = nowMs()) {
    const expiresAt = memoryClaimBuckets.get(key);
    if (expiresAt && expiresAt > now) {
      return false;
    }

    memoryClaimBuckets.set(key, now + ttlMs);
    pruneExpiredEntries(memoryClaimBuckets, now);
    return true;
  },
  async reset() {
    memoryRateLimitBuckets.clear();
    memoryClaimBuckets.clear();
  },
};

async function getSecurityBackend() {
  if (requestSecurityTestBackend) {
    return requestSecurityTestBackend;
  }
  return process.env.REDIS_URL?.trim() ? redisBackend : memoryBackend;
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

export async function enforceRateLimit({
  bucket,
  key,
  limit,
  windowMs,
  now = nowMs(),
}) {
  const backend = await getSecurityBackend();
  const result = await backend.increment(redisKey("rate", bucket, key), windowMs, now);

  if (result.count > limit) {
    throw createRateLimitError(result.ttlMs);
  }

  return {
    allowed: true,
    remaining: Math.max(0, limit - result.count),
    resetAt: now + result.ttlMs,
  };
}

export async function claimDedupeWindow({ bucket, key, ttlMs, now = nowMs() }) {
  const backend = await getSecurityBackend();
  return backend.claim(redisKey("claim", bucket, key), ttlMs, now);
}

export async function assertReplayWindow(options) {
  if (!(await claimDedupeWindow(options))) {
    throw createReplayError();
  }
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

export function __setRequestSecurityTestBackend(backend = null) {
  requestSecurityTestBackend = backend;
}

export async function __resetRequestSecurityTestState() {
  requestSecurityTestBackend = null;
  await memoryBackend.reset();
}
