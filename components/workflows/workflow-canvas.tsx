"use client";

import * as React from "react";
import Script from "next/script";
import { deriveWfModel, type Workflow } from "@/lib/wf/derive";

interface WfEngine {
  render: (
    host: HTMLElement,
    viewport: HTMLElement,
    model: unknown,
    opts: { mode: string },
  ) => { fit: () => void };
}
declare global {
  interface Window {
    WF?: WfEngine;
  }
}

export function WorkflowCanvas({
  workflow,
  height = 420,
}: {
  workflow: Workflow;
  height?: number;
}) {
  const hostRef = React.useRef<HTMLDivElement>(null);
  const viewportRef = React.useRef<HTMLDivElement>(null);
  // Already-loaded case (e.g. navigating back) is covered by the lazy initial value;
  // first load is covered by <Script onReady>.
  const [ready, setReady] = React.useState(() => typeof window !== "undefined" && !!window.WF);

  React.useEffect(() => {
    if (!ready || !window.WF || !hostRef.current || !viewportRef.current) return;
    const viewport = viewportRef.current;
    const model = deriveWfModel(workflow);
    const handle = window.WF.render(hostRef.current, viewport, model, { mode: "contain" });
    // The viewport may still be animating in (dialog), so its size is 0 at first
    // render — re-fit on the next frame and whenever the viewport resizes.
    const refit = () => handle?.fit?.();
    const raf = requestAnimationFrame(refit);
    const ro = new ResizeObserver(refit);
    ro.observe(viewport);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [ready, workflow]);

  return (
    <>
      <Script src="/wf-engine.js" strategy="afterInteractive" onReady={() => setReady(true)} />
      <div
        ref={viewportRef}
        className="relative w-full overflow-hidden rounded-lg border border-border bg-muted/20"
        style={{ height }}
      >
        <div ref={hostRef} className="wf-canvas" />
      </div>
    </>
  );
}
