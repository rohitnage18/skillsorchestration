import { chmod } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const entryPoint = fileURLToPath(new URL("../build/index.js", import.meta.url));
await chmod(entryPoint, 0o755);
