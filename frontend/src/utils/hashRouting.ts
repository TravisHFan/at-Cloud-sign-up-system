export const getHashRouteUrl = (path: string): string => {
  const route = path.startsWith("/") ? path : `/${path}`;
  return `/#${route}`;
};

export const hardNavigateToHashRoute = (path: string): void => {
  window.location.href = getHashRouteUrl(path);
};
