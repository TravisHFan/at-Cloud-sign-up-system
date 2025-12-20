import { useCallback, useRef, useState } from "react";
import { ensureShortLink, clearShortLinkCaches } from "../services/shortLinks";
import type { ShortLinkRecord, ShortLinkStatus } from "../services/shortLinks";

interface State {
  loading: boolean;
  error?: string;
  record?: ShortLinkRecord;
  status?: ShortLinkStatus;
  copied?: boolean;
}

export function useShortLink(eventId?: string) {
  const [state, setState] = useState<State>({ loading: false });
  const inflight = useRef<Promise<unknown> | null>(null);

  const load = useCallback(async () => {
    if (!eventId) return;
    if (inflight.current) return inflight.current;
    setState((s) => ({ ...s, loading: true, error: undefined }));
    const p = (async () => {
      try {
        const { record, status } = await ensureShortLink(eventId);
        setState({ loading: false, record, status });
      } catch (e) {
        setState({ loading: false, error: (e as Error).message });
      } finally {
        inflight.current = null;
      }
    })();
    inflight.current = p;
    return p;
  }, [eventId]);

  const copy = useCallback(() => {
    if (!state.record) return false;
    try {
      void navigator.clipboard.writeText(state.record.url);
      setState((s) => ({ ...s, copied: true }));
      setTimeout(() => {
        setState((s) => ({ ...s, copied: false }));
      }, 2000);
      return true;
    } catch (e) {
      setState((s) => ({ ...s, error: (e as Error).message }));
      return false;
    }
  }, [state.record]);

  const resetCaches = useCallback(() => {
    clearShortLinkCaches();
    setState({ loading: false });
  }, []);

  return {
    ...state,
    load,
    copy,
    resetCaches,
    hasActive: state.status?.state === "active",
    isExpired: state.status?.state === "expired",
  };
}

export default useShortLink;
