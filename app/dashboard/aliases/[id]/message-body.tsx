"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  html: string | null;
  text: string | null;
}

/**
 * Renders email body content.
 * - If HTML is present, renders it in a sandboxed iframe so styles/scripts
 *   are isolated from the host page.
 * - Falls back to plain-text if no HTML is available.
 */
export function MessageBody({ html, text }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight] = useState(200);

  const hasHtml = Boolean(html?.trim());

  // Auto-resize iframe to fit its content
  useEffect(() => {
    if (!hasHtml || !iframeRef.current) return;

    const frame = iframeRef.current;

    function resize() {
      try {
        const doc = frame.contentDocument || frame.contentWindow?.document;
        if (doc?.body) {
          setIframeHeight(doc.body.scrollHeight + 16);
        }
      } catch {
        // cross-origin sandbox — ignore
      }
    }

    frame.addEventListener("load", resize);
    return () => frame.removeEventListener("load", resize);
  }, [hasHtml, html]);

  if (hasHtml) {
    return (
      <iframe
        ref={iframeRef}
        className="message-body-iframe"
        srcDoc={html!}
        sandbox="allow-same-origin"
        title="Email content"
        style={{ height: iframeHeight }}
      />
    );
  }

  const plain = text?.trim() || "(No readable body)";
  return <div className="message-body">{plain}</div>;
}
