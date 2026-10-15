"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Dataset } from "@/lib/types";

export type SyncState = "loading" | "ok" | "syncing" | "stale" | "error";

export function useDataset() {
  const [data, setData] = useState<Dataset | null>(null);
  const [state, setState] = useState<SyncState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const version = useRef<string | null>(null);
  const busy = useRef(false);

  const load = useCallback(async (force = false) => {
    if (busy.current) return;
    busy.current = true;
    if (version.current) setState("syncing");
    try {
      const qs = new URLSearchParams();
      if (force) qs.set("force", "1");
      if (version.current) qs.set("v", version.current);
      const res = await fetch(`/api/data?${qs}`, { cache: "no-store" });
      if (res.status === 401) {
        window.location.replace("/login");
        return;
      }
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Falha na sincronização.");
      if (!json.unchanged) {
        version.current = json.data.version;
        setData(json.data);
      } else {
        setData((d) => (d ? { ...d, syncedAt: json.syncedAt } : d));
      }
      setError(json.stale ? json.error : null);
      setState(json.stale ? "stale" : "ok");
      setCheckedAt(new Date());
    } catch (e) {
      setError((e as Error).message || "Sem conexão com o servidor.");
      setState(version.current ? "stale" : "error");
    } finally {
      busy.current = false;
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const interval = (data?.refreshSeconds ?? 45) * 1000;
  useEffect(() => {
    const tick = () => document.visibilityState === "visible" && load();
    const id = window.setInterval(tick, interval);
    const onVis = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", onVis);
    };
  }, [interval, load]);

  return { data, state, error, checkedAt, refresh: () => load(true) };
}
