import React, { useEffect, useRef, useState } from "react";
import {directPlayerImageUrl} from "./playerPhotoSource.mjs";

/**
 * Photos may be stored as GitHub blob links that redirect repeatedly.
 * Resolve to the image host and retry temporary failures without issuing
 * CORS HEAD probes for every card (which can be rejected by the provider).
 * Keep original player image fields unchanged.
 */
const MAX_RETRIES=3;
const BACKOFF_MS=[900,2200,4400];

export default function SmartImage({
  src,
  alt = "",
  imgClassName = "",
  fallback = null,
  eager = false,
}) {
  const directSrc=directPlayerImageUrl(src);
  const [status, setStatus] = useState(() => (directSrc ? "loading" : "error"));
  const [reloadKey, setReloadKey] = useState(0);
  const attemptRef = useRef(0);
  const timerRef = useRef(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    attemptRef.current = 0;
    setStatus(directSrc ? "loading" : "error");
    setReloadKey((k) => k + 1);
    return () => {
      cancelledRef.current = true;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [directSrc]);

  const handleLoaded = () => {
    if (cancelledRef.current) return;
    setStatus("loaded");
  };

  const scheduleRetry = () => {
    if (cancelledRef.current) return;
    if (attemptRef.current >= MAX_RETRIES) {
      setStatus("error");
      return;
    }
    const delay = BACKOFF_MS[attemptRef.current] ?? 4400;
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      if (cancelledRef.current) return;
      attemptRef.current += 1;
      setReloadKey((k) => k + 1);
      setStatus("loading");
    }, delay);
  };

  const handleError = () => {
    // A browser image request is authoritative; CORS HEAD probes are not.
    // Retrying the already-resolved image source avoids additional GitHub
    // redirects and the avalanche of 403/429 HEAD responses.
    if (cancelledRef.current || timerRef.current!==null)return;
    scheduleRetry();
  };

  if (!directSrc || status === "error") {
    return fallback;
  }

  return (
    <>
      {status === "loading" && (
        <div
          className="absolute inset-0 animate-pulse bg-slate-100/80"
          aria-hidden="true"
        />
      )}
      <img
        key={reloadKey}
        src={directSrc}
        alt={alt}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        onLoad={handleLoaded}
        onError={handleError}
        className={status === "loaded" ? imgClassName : `${imgClassName} opacity-0`}
      />
    </>
  );
}