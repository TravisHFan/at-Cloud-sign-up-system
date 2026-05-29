export const getHashRouteUrl = (path: string): string => {
  const route = path.startsWith("/") ? path : `/${path}`;
  return `/#${route}`;
};

export const getAbsoluteHashRouteUrl = (
  path: string,
  origin: string = window.location.origin
): string => {
  return `${origin.replace(/\/$/, "")}${getHashRouteUrl(path)}`;
};

const DIRECT_HASH_ROUTE_PATTERNS: RegExp[] = [
  /^\/login\/?$/i,
  /^\/dashboard\/event\/[^/]+\/?$/i,
  /^\/dashboard\/programs\/[^/]+\/?$/i,
  /^\/p\/[^/]+\/?$/i,
  /^\/s\/[^/]+\/?$/i,
];

export const getDirectPathHashRouteReplacement = (location: {
  pathname: string;
  search?: string;
  hash?: string;
}): string | null => {
  if (location.hash || location.pathname === "/") {
    return null;
  }

  const shouldRewrite = DIRECT_HASH_ROUTE_PATTERNS.some((pattern) =>
    pattern.test(location.pathname)
  );

  if (!shouldRewrite) {
    return null;
  }

  return getHashRouteUrl(`${location.pathname}${location.search || ""}`);
};

export const hardNavigateToHashRoute = (path: string): void => {
  window.location.href = getHashRouteUrl(path);
};
