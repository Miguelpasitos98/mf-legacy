/** Public GitHub face index. Never assign an ambiguous name to a player. */
const URL = 'https://api.github.com/repos/Miguelpasitos98/My-Legacy/contents/Faces%20UT?ref=main';
let cache = null;
let expiresAt = 0;
export const faceKey = (name) => String(name || '').normalize('NFKC').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i').replace(/ø/g, 'o')
  .toLocaleLowerCase('en').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
export async function getGithubFaces({refresh=false}={}) {
  if (!refresh && cache && Date.now() < expiresAt) return cache;
  const response = await fetch(URL, { headers: { Accept: 'application/vnd.github+json' } });
  if (!response.ok) throw new Error(`GitHub devolvió HTTP ${response.status}. No se han cambiado fotografías.`);
  const files = await response.json();
  if (!Array.isArray(files)) throw new Error('La carpeta de GitHub no devolvió una lista de imágenes.');
  const map = new Map();
  for (const file of files) {
    if (file.type !== 'file' || !/\.(png|jpe?g|webp)$/i.test(file.name) || !file.download_url) continue;
    const key = faceKey(file.name.replace(/\.(png|jpe?g|webp)$/i, ''));
    if (!key) continue;
    const existing = map.get(key) || [];
    existing.push({ filename: file.name, url: file.download_url });
    map.set(key, existing);
  }
  cache = map;
  expiresAt = Date.now() + 15 * 60 * 1000;
  return map;
}
export function matchGithubFace(player, faces) {
  const matches = faces.get(faceKey(player?.name)) || [];
  return matches.length === 1 ? { status: 'matched', ...matches[0] } :
    { status: matches.length ? 'ambiguous' : 'missing' };
}
