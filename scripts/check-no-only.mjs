#!/usr/bin/env node
import { execSync } from "node:child_process";

try {
  const cmd = 'grep -R -nE "\\.only\\s*\\(" backend/tests frontend/src || true';
  const out = execSync(cmd, { stdio: ["ignore", "pipe", "pipe"] })
    .toString()
    .trim();
  if (out) {
    console.error("Found focused tests (.only):");
    console.error(out);
    process.exit(3);
  }
  console.log("No focused tests detected.");
} catch (e) {
  console.error("Error while scanning for .only:", e?.message || e);
  process.exit(2);
}
