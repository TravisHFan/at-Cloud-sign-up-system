import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function fail(message) {
  failures.push(message);
}

function assertIncludes(relativePath, needle, message) {
  const text = read(relativePath);
  if (!text.includes(needle)) {
    fail(`${relativePath}: ${message}`);
  }
}

function lineNumber(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

function listSourceFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolute = path.join(dir, entry.name);
    const relative = path.relative(root, absolute);

    if (
      entry.isDirectory() &&
      ![
        "dist",
        "coverage",
        "node_modules",
        "__tests__",
        "test",
        "tests",
      ].includes(entry.name)
    ) {
      files.push(...listSourceFiles(absolute));
      continue;
    }

    if (
      entry.isFile() &&
      /\.(ts|tsx)$/.test(entry.name) &&
      !entry.name.includes(".test.") &&
      !relative.includes(`${path.sep}src${path.sep}test${path.sep}`)
    ) {
      files.push(relative);
    }
  }

  return files;
}

function checkHashRouterContract() {
  const main = read("frontend/src/main.tsx");
  if (!main.includes("HashRouter") || !main.includes("<HashRouter>")) {
    fail("frontend/src/main.tsx: deployed frontend must use HashRouter.");
  }

  assertIncludes(
    "frontend/src/services/session.ts",
    'getHashRouteUrl("/login")',
    "session expiry must redirect to the hash login route.",
  );
  assertIncludes(
    "frontend/src/utils/hashRouting.ts",
    'return `/#${route}`;',
    "hash route helper must produce root hash URLs.",
  );
}

function checkInternalHardNavigations() {
  const sourceRoot = path.join(root, "frontend/src");
  const files = listSourceFiles(sourceRoot);
  const patterns = [
    {
      name: "window.location.href",
      regex: /window\.location\.href\s*=\s*(['"`])([^'"`]+)\1/g,
    },
    {
      name: "window.location.assign",
      regex: /window\.location\.assign\(\s*(['"`])([^'"`]+)\1\s*\)/g,
    },
  ];

  for (const relative of files) {
    if (relative === "frontend/src/utils/hashRouting.ts") continue;
    const text = read(relative);

    for (const pattern of patterns) {
      for (const match of text.matchAll(pattern.regex)) {
        const target = match[2];
        const isInternalDirectPath =
          target.startsWith("/") &&
          !target.startsWith("/#") &&
          !target.startsWith("//");

        if (isInternalDirectPath) {
          fail(
            `${relative}:${lineNumber(text, match.index ?? 0)}: ${pattern.name} hard-navigates to "${target}". Use hardNavigateToHashRoute() for internal app routes.`,
          );
        }
      }
    }
  }
}

function checkAvatarAndUploadContracts() {
  const avatarUtils = read("frontend/src/utils/avatarUtils.ts");
  if (avatarUtils.includes("backend.onrender.com")) {
    fail(
      "frontend/src/utils/avatarUtils.ts: do not special-case one backend hostname; staging and production hostnames differ.",
    );
  }
  if (
    !avatarUtils.includes("import.meta.env.PROD") ||
    !avatarUtils.includes("return customAvatar;")
  ) {
    fail(
      "frontend/src/utils/avatarUtils.ts: production builds must preserve absolute avatar URLs.",
    );
  }

  const uploadMiddleware = read("backend/src/middleware/upload.ts");
  if (
    uploadMiddleware.includes('uploadPath += "avatars/"') ||
    uploadMiddleware.includes('uploadPath += "images/"')
  ) {
    fail(
      "backend/src/middleware/upload.ts: upload directories must use normalized paths, not string concatenation.",
    );
  }
  assertIncludes(
    "backend/src/middleware/upload.ts",
    "path.join(getUploadBasePath(), subdirectory)",
    "upload subdirectories must be joined against the normalized base path.",
  );
}

function checkRenderTemplateContract() {
  const renderYaml = read("render.yaml");
  for (const required of [
    "type: rewrite",
    "source: /*",
    "destination: /index.html",
    "key: VITE_API_URL",
    "fromService:",
  ]) {
    if (!renderYaml.includes(required)) {
      fail(`render.yaml: expected frontend static-site contract "${required}".`);
    }
  }
}

checkHashRouterContract();
checkInternalHardNavigations();
checkAvatarAndUploadContracts();
checkRenderTemplateContract();

if (failures.length > 0) {
  console.error("Deployment guardrail check failed:\n");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Deployment guardrail check passed.");
