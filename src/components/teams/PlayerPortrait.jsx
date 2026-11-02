import React, { useEffect, useMemo, useState } from "react";
import { normalizeImageUrl } from "./teamUtils";

// The card image may be unavailable even when a profile photo exists.
// Try each distinct URL in order and never render the browser's broken-image icon.
export const getPlayerPortraitUrls = (player) => {
  const options = [player?.card_photo_url, player?.photo_url, player?.national_card_photo_url];
  return [...new Set(options.map(normalizeImageUrl).filter(Boolean))];
};

export default function PlayerPortrait({ player, className = "", fallback = "?", alt = "" }) {
  const urls = useMemo(
    () => getPlayerPortraitUrls(player),
    [player?.card_photo_url, player?.photo_url, player?.national_card_photo_url]
  );
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [urls.join("|")]);
  const src = urls[index];
  return src ? (
    <img
      key={src}
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => setIndex((current) => current + 1)}
    />
  ) : (
    <span className={`flex items-center justify-center bg-slate-700 text-white text-xs font-bold ${className}`} aria-label="Sin fotografía">
      {fallback}
    </span>
  );
}
