#!/usr/bin/env node
/*
  Simple coverage gate checker.
  Reads coverage/coverage-summary.json produced by vitest (json-summary reporter)
  and compares against thresholds provided via env vars.
*/
import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const summaryPath = path.join(cwd, "coverage", "coverage-summary.json");
if (!fs.existsSync(summaryPath)) {
  console.error(`Coverage summary not found at ${summaryPath}`);
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
// Totals key may be 'total' as in Istanbul summary
const total = data.total || data;

function pct(metric) {
  return total[metric]?.pct ?? 0;
}

const want = {
  lines: Number(process.env.COVERAGE_LINES || 0),
  statements: Number(process.env.COVERAGE_STATEMENTS || 0),
  functions: Number(process.env.COVERAGE_FUNCTIONS || 0),
  branches: Number(process.env.COVERAGE_BRANCHES || 0),
};

const got = {
  lines: pct("lines"),
  statements: pct("statements"),
  functions: pct("functions"),
  branches: pct("branches"),
};

let ok = true;
for (const key of Object.keys(want)) {
  const w = want[key];
  if (!w) continue; // no threshold specified for this metric
  const g = got[key];
  if (g + 1e-9 < w) {
    console.error(`Coverage check failed: ${key} ${g}% < required ${w}%`);
    ok = false;
  }
}

if (!ok) {
  console.error("\nCoverage summary:");
  console.error(JSON.stringify(got, null, 2));
  process.exit(2);
}
console.log("Coverage OK:", JSON.stringify(got));
