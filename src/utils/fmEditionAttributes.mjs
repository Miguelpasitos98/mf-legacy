// Read edition-specific Football Manager attributes without overwriting the FM26 editor data.
// The preferred edition is the one with higher CA; ties favor FM26.
import { bestFmRating } from "./playerBestFmRatings.mjs";
import { fm26VisibleAttributes } from "./fmSaveDirectImport.mjs";

const GROUPS = ["mental", "physical", "technical", "goalkeeping"];
export function preferredFmAttributeEdition(player) {
  const ca = bestFmRating(player, "ca");
  if (ca.edition) return ca.edition;
  return bestFmRating(player, "cp").edition || "FM26";
}
export function fm27VisibleAttributes(player) {
  const record = player?.fm27_source_record;
  if (!record || typeof record !== "object") return null;
  const mapped = fm26VisibleAttributes(record);
  const available = GROUPS.some(group => Object.values(mapped[group] || {}).some(value => Number.isFinite(value) && value >= 1 && value <= 20));
  return available ? mapped : null;
}
export function tacticalAttributeSource(player) {
  if (preferredFmAttributeEdition(player) !== "FM27") return { edition: "FM26", stats: player?.stats || {} };
  const stats = fm27VisibleAttributes(player);
  // Never pretend that FM26 numbers are FM27 attributes when the reader lacks FM27 coverage.
  return { edition: "FM27", stats: stats || {} };
}
