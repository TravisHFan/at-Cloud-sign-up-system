import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

interface ResolveResponse {
  success: boolean;
  data?: { status: string; slug: string; eventId: string };
  status?: string;
  message?: string;
}

/**
 * Client-side fallback for short link resolution.
 *
 * In production we rely on the backend 302 redirect: GET /s/:key -> /p/:slug.
 * However during local development (or if a proxy / CDN edge rule fails), the
 * raw /s/:key request might be swallowed by the dev server before reaching the
 * backend Express app. This component gives us a graceful SPA path so users can
 * still paste /s/<key> into the browser and arrive at the public event page.
 *
 * Flow:
 *  1. Mount -> call /api/public/short-links/:key (status endpoint JSON)
 *  2. If active -> navigate to /p/:slug (replace history entry)
 *  3. If expired / not_found -> show a friendly message
 *  4. On network / server error -> offer a retry and copyable original path
 */
const ShortLinkRedirect: React.FC = () => {
  const { key } = useParams<{ key: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<
    | { type: "loading" }
    | { type: "error"; message: string }
    | { type: "expired" }
    | { type: "not_found" }
  >({ type: "loading" });

  useEffect(() => {
    if (!key) {
      setState({ type: "error", message: "Missing short link key." });
      return;
    }
    let aborted = false;
    const controller = new AbortController();
    async function run() {
      try {
        const safeKey = key || ""; // key validated above, fallback to empty string just for type
        const res = await fetch(
          `/api/public/short-links/${encodeURIComponent(safeKey)}`,
          {
            signal: controller.signal,
            headers: { Accept: "application/json" },
          }
        );
        const json = (await res.json().catch(() => ({}))) as ResolveResponse;
        if (aborted) return;
        if (res.ok && json?.data?.status === "active" && json.data.slug) {
          // Navigate to public event page; replace so the short link doesn't linger in history.
          navigate(`/p/${json.data.slug}`, { replace: true });
          return;
        }
        if (res.status === 410 || json.status === "expired") {
          setState({ type: "expired" });
          return;
        }
        if (res.status === 404 || json.status === "not_found") {
          setState({ type: "not_found" });
          return;
        }
        setState({
          type: "error",
          message:
            json?.message || `Unexpected response (status ${res.status})`,
        });
      } catch (err) {
        if (aborted) return;
        setState({
          type: "error",
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          message: `Network error resolving short link: ${err}`,
        });
      }
    }
    run();
    return () => {
      aborted = true;
      controller.abort();
    };
  }, [key, navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-4 text-center">
      {state.type === "loading" && (
        <div>
          <div className="mb-2 text-lg font-semibold">Resolving link…</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Key: <code>{key}</code>
          </div>
        </div>
      )}
      {state.type === "expired" && (
        <div className="max-w-md space-y-3">
          <h1 className="text-xl font-semibold">Link Expired</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            The short link you used has expired. Please request a new share link
            from the event page.
          </p>
        </div>
      )}
      {state.type === "not_found" && (
        <div className="max-w-md space-y-3">
          <h1 className="text-xl font-semibold">Link Not Found</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            We couldn&apos;t find a published event for this short link key.
            Double-check the URL or request a fresh share link.
          </p>
        </div>
      )}
      {state.type === "error" && (
        <div className="max-w-md space-y-3">
          <h1 className="text-xl font-semibold">Resolution Error</h1>
          <p className="break-words text-sm text-red-600 dark:text-red-400">
            {state.message}
          </p>
          <button
            onClick={() => setState({ type: "loading" })}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 focus:outline-none focus:ring"
          >
            Retry
          </button>
        </div>
      )}
      <div className="text-xs text-gray-500 dark:text-gray-500">
        Short link client fallback
      </div>
    </div>
  );
};

export default ShortLinkRedirect;
