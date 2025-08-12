---
applyTo: "**"
---

We should use npm test to run our test suite, not the npx vitest.

# Test Suite Principles

## Our ultimate purpose

We aim to build a **comprehensive, industrial-standard test suite**—covering **unit, integration, and end-to-end (E2E)** levels—with **near-100% coverage**. This strong foundation lets us safely remove deprecated or remnant code and confidently build new features. (Unit = smallest pieces; integration = modules working together; E2E = full system paths.)

> Note: Coverage is a tool to reveal untested areas; quality still matters more than the number. Use high coverage **to inform**, not to game.

---

## On dead / remnant code

In a fast-evolving codebase, it’s common to accumulate **orphaned, deprecated, duplicated, or remnant** code blocks as design/logic shifts.  
We will **leverage the test suite and steadily increasing coverage** to pinpoint such **dead code**. After confirming that a segment is truly unused/unreachable, **remove it** to keep the codebase lean and clear. (Coverage data and code review are effective ways to surface dead code.)

---

## Please remember

1. **Study before you test**  
   Before authoring any new tests, thoroughly study the relevant codebase and its intended behavior/design. Then **custom-design tests that reflect the intended design and behavior**—rather than inventing arbitrary cases and fixing them one by one in a tedious loop. Good tests describe behavior and expected outcomes.

2. **Don’t bend production to make tests pass**  
   You must **not** alter the design or production code just to make tests pass. Adjust tests to align with the intended design/behavior—**unless** there’s a genuine error or incompleteness in design or implementation. This is a guiding principle. (Keep production code separate from test concerns.)

3. **Know the scripts you’re running**  
   Read `package.json` to understand the npm scripts so you can use the correct `npm test` command and any project-specific variants (e.g., watch mode, coverage, e2e runners).
