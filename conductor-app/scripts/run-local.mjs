import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";

const mode = process.argv[2];
if (!new Set(["dev", "start"]).has(mode)) {
  console.error("Usage: node scripts/run-local.mjs <dev|start>");
  process.exit(1);
}

const nextCli = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
const env = {
  ...process.env,
  AUTH_URL: mode === "dev" ? "http://localhost:3000" : "https://localhost:3000",
  AUTH_TRUST_HOST: "true",
};

if (mode === "start") {
  env.SKILL_EVENTS_TOKEN ??= "localdevskilltoken1234567890abcdef";
  env.SKILL_EVENTS_HMAC_SECRET ??= "localdevhmackey1234567890abcdef";
}

const child = spawn(process.execPath, [nextCli, mode], {
  env,
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error(`Unable to start the local ${mode} server:`, error);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
