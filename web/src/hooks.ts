import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { checkHealth, isApiLive, lastRunSource, subscribeHealth, type RunSource } from "./api";
import { demoApi } from "./demoClient";

export function useHealth() {
  const [live, setLive] = useState(isApiLive());
  const location = useLocation();
  useEffect(() => subscribeHealth(setLive), []);
  useEffect(() => {
    void checkHealth();
    const timer = window.setInterval(() => {
      void checkHealth();
    }, 15000);
    return () => window.clearInterval(timer);
  }, [location.pathname]);
  return live;
}

export function useWorkflow() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<RunSource | null>(null);

  async function run(task: () => Promise<any>) {
    setRunning(true);
    setError(null);
    try {
      const payload = await task();
      setResult(payload);
      setSource(payload?._source || lastRunSource());
      if (payload?._source === "saved") {
        setError(null);
      }
      return payload;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setResult({ ok: false, error: { message } });
      setSource(null);
      return null;
    } finally {
      setRunning(false);
    }
  }

  return { running, result, error, source, run, setResult, demoApi };
}
