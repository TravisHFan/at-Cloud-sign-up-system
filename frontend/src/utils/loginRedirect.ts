export function isSafeInternalRedirectPath(
  value: string | null | undefined,
): value is string {
  return !!value && value.startsWith("/") && !value.startsWith("//");
}

export function getRedirectParam(search: string): string | null {
  try {
    const params = new URLSearchParams(
      search.startsWith("?") ? search : `?${search}`,
    );
    const redirect = params.get("redirect");
    return isSafeInternalRedirectPath(redirect) ? redirect : null;
  } catch {
    return null;
  }
}

export function getPathWithSearch(location: {
  pathname: string;
  search?: string;
}): string {
  return `${location.pathname}${location.search || ""}`;
}

export function buildLoginRedirectUrl(targetPath: string): string {
  if (!isSafeInternalRedirectPath(targetPath)) {
    return "/login";
  }

  return `/login?redirect=${encodeURIComponent(targetPath)}`;
}
