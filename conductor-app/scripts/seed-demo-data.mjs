import { seedDemoWorkspaceData } from "../lib/operations.js";

const result = seedDemoWorkspaceData();

console.log(
  JSON.stringify(
    {
      seededAt: new Date().toISOString(),
      ...result,
    },
    null,
    2
  )
);
