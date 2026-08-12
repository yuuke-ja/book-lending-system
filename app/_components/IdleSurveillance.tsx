"use client";

import { useEffect } from "react";
import { signOut } from "next-auth/react";

export default function IdleSurveillance({
  timeoutMinutes,
}: {
  timeoutMinutes: number;
}) {
  useEffect(() => {
    let lastActivityAt = Date.now();
    let lastSavedAt = 0;
    let isSigningOut = false;

    function resetIdleTimer() {
      const now = Date.now();
      lastActivityAt = now;

      if (now - lastSavedAt < 10_000) {
        return;
      }

      localStorage.setItem("idleLastActivity", String(now));
      lastSavedAt = now;
    }

    async function checkIdleTime() {
      const savedAt = Number(localStorage.getItem("idleLastActivity"));
      const latestActivityAt = Math.max(lastActivityAt, savedAt);

      if (
        isSigningOut ||
        Date.now() - latestActivityAt < timeoutMinutes * 60 * 1000
      ) {
        return;
      }

      isSigningOut = true;
      localStorage.removeItem("idleLastActivity");
      await signOut({ redirectTo: "/" });
    }

    resetIdleTimer();

    void checkIdleTime();

    const intervalId = window.setInterval(() => {
      void checkIdleTime();
    }, 10 * 60 * 1000);

    document.addEventListener("scroll", resetIdleTimer, true);
    window.addEventListener("pointerdown", resetIdleTimer);
    window.addEventListener("mousemove", resetIdleTimer);
    window.addEventListener("keydown", resetIdleTimer);
    window.addEventListener("touchstart", resetIdleTimer);

    return () => {
      document.removeEventListener("scroll", resetIdleTimer, true);
      window.removeEventListener("pointerdown", resetIdleTimer);
      window.removeEventListener("mousemove", resetIdleTimer);
      window.removeEventListener("keydown", resetIdleTimer);
      window.removeEventListener("touchstart", resetIdleTimer);
      window.clearInterval(intervalId);
    };
  }, [timeoutMinutes]);

  return null;
}
