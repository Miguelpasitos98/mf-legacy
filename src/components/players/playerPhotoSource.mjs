/**
 * Resolve GitHub's HTML/blob photo links directly to its image CDN.
 * This removes two redirects per image while leaving every stored Base44
 * photo field untouched. Other sources are passed through as-is.
 */
export function directPlayerImageUrl(value){
 const src=typeof value==="string"?value.trim():"";
 if(!src)return "";
 const match=/^https:\/\/(?:www\.)?github\.com\/([^/?#]+)\/([^/?#]+)\/blob\/([^?#]+?)(?:\?[^#]*)?(?:#.*)?$/i.exec(src);
 if(!match)return src;
 const [,owner,repo,path]=match;
 // GitHub blob paths are branch/ref followed by a file path.
 if(!path.includes("/"))return src;
 return `https://raw.githubusercontent.com/${owner}/${repo}/${path}`;
}
