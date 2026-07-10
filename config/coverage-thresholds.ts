export const coverageThresholds = {
  backend: {
    lines: 90,
    statements: 90,
    functions: 90,
    branches: 85,
  },
  frontend: {
    // Honest full-application baseline. Raise these as route-level browser and
    // component contracts grow; do not exclude untested feature modules merely
    // to manufacture a higher percentage.
    lines: 70,
    statements: 70,
    functions: 49,
    branches: 73,
  },
} as const;
