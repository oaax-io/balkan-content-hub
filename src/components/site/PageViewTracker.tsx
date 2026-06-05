import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { trackPageView } from "@/lib/analytics.functions";

const SESSION_KEY = "bk_sid";
const SESSION_TS_KEY = "bk_sid_ts";
const SESSION_TTL = 30 * 60 * 1000; // 30 min

function getSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    const now = Date.now();
    const ts = Number(localStorage.getItem(SESSION_TS_KEY) || 0);
    let sid = localStorage.getItem(SESSION_KEY) || "";
    if (!sid || now - ts > SESSION_TTL) {
      sid = crypto.randomUUID();
      localStorage.setItem(SESSION_KEY, sid);
    }
    localStorage.setItem(SESSION_TS_KEY, String(now));
    return sid;
  } catch {
    return "";
  }
}

function getDevice(): "mobile" | "tablet" | "desktop" | "unknown" {
  if (typeof window === "undefined") return "unknown";
  const w = window.innerWidth;
  if (w < 640) return "mobile";
  if (w < 1024) return "tablet";
  return "desktop";
}

export function PageViewTracker() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const track = useServerFn(trackPageView);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (/^\/(admin|auth)(\/|$)/.test(path)) return;
    const sid = getSessionId();
    const ref = document.referrer && !document.referrer.includes(window.location.host) ? document.referrer : "";
    track({ data: { path, referrer: ref, session_id: sid, device: getDevice() } }).catch(() => {});
  }, [path, track]);

  return null;
}
