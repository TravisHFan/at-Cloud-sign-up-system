/// <reference types="vite/client" />
/// <reference types="@testing-library/jest-dom" />

import * as matchers from "@testing-library/jest-dom/matchers";

declare module "vitest" {
  interface Assertion<T = any>
    extends jest.Matchers<void, T>,
      matchers.TestingLibraryMatchers<T, void> {}
  interface AsymmetricMatchersContaining extends jest.Expect {}
}
