"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type State<T> = { result: T | null; loading: boolean; error: boolean };

/**
 * Hook fetching data client-side yang terpusat: loading/error/hasil + reload.
 * Nanti mudah diganti ke SWR/React Query atau RSC saat backend/API siap —
 * komponen view tidak perlu berubah.
 */
export function useAsyncData<T>(fetcher: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<State<T>>({
    result: null,
    loading: true,
    error: false,
  });
  const [tick, setTick] = useState(0);
  const fetcherRef = useRef(fetcher);

  // Simpan fetcher terbaru tanpa memasukkannya ke deps effect fetch.
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sinkronisasi state fetch (loading) memang perlu di sini
    setState((s) => ({ ...s, loading: true, error: false }));
    fetcherRef
      .current()
      .then((result) => {
        if (!cancelled) setState({ result, loading: false, error: false });
      })
      .catch(() => {
        if (!cancelled) setState({ result: null, loading: false, error: true });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  return { ...state, reload };
}
