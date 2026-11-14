// Display-only ratings. Keep the underlying FM26 and FM27 values independent.
const valid = value => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 200 ? number : null;
};
export function bestFmRating(player, kind) {
  const fm26 = valid(player?.[kind === "ca" ? "ca" : "cp"]);
  const fm27 = valid(player?.[kind === "ca" ? "fm27_ca" : "fm27_cp"]);
  if (fm26 === null && fm27 === null) return { value:null, edition:null };
  if (fm27 === null || (fm26 !== null && fm26 >= fm27)) return { value:fm26, edition:fm27 === fm26 ? "FM26/FM27" : "FM26" };
  return { value:fm27, edition:"FM27" };
}
