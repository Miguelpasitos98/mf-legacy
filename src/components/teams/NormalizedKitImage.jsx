import React, {useEffect,useState} from "react";
import {ImageOff} from "lucide-react";
import {normalizeImageUrl} from "./teamUtils";

// Cache results by original URL; never changes the stored Team image.
const processed = new Map();
const pending = new Map();
const MAX_PIXELS = 1600 * 1600;
const TARGET_W = 560, TARGET_H = 700;
function makeNormalized(url) {
  if (processed.has(url)) return Promise.resolve(processed.get(url));
  if (pending.has(url)) return pending.get(url);
  const task = new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        if (!img.naturalWidth || !img.naturalHeight) throw Error("Empty image");
        const ratio = Math.min(1, Math.sqrt(MAX_PIXELS / (img.naturalWidth * img.naturalHeight)));
        const source = document.createElement("canvas");
        source.width = Math.max(1,Math.round(img.naturalWidth * ratio));
        source.height = Math.max(1,Math.round(img.naturalHeight * ratio));
        const ctx = source.getContext("2d",{willReadFrequently:true});
        if (!ctx) throw Error("Canvas unavailable");
        ctx.drawImage(img,0,0,source.width,source.height);
        const pixels = ctx.getImageData(0,0,source.width,source.height);
        let minX = source.width, minY = source.height, maxX = -1, maxY = -1;
        const stride = source.width;
        for (let y=0;y<source.height;y++){
          for(let x=0;x<source.width;x++){
            if(pixels.data[(y*stride+x)*4+3]<24)continue;
            minX=Math.min(minX,x);maxX=Math.max(maxX,x);
            minY=Math.min(minY,y);maxY=Math.max(maxY,y);
          }
        }
        if(maxX<0)throw Error("No visible pixels");
        // Only crop genuinely transparent padded images. Opaque backgrounds
        // cannot be safely segmented without changing the jersey artwork.
        const corners=[0,(source.width-1)*4,((source.height-1)*source.width)*4,(source.width*source.height-1)*4];
        const transparentCorners=corners.filter(i=>pixels.data[i+3]<24).length;
        if(transparentCorners<3)throw Error("Not a transparent PNG");
        const cropW=maxX-minX+1,cropH=maxY-minY+1;
        const out=document.createElement("canvas");
        out.width=TARGET_W;out.height=TARGET_H;
        const draw=out.getContext("2d");
        const scale=Math.min(TARGET_W*0.88/cropW,TARGET_H*0.88/cropH);
        const w=cropW*scale,h=cropH*scale;
        draw.drawImage(source,minX,minY,cropW,cropH,(TARGET_W-w)/2,(TARGET_H-h)/2,w,h);
        resolve(out.toDataURL("image/png"));
      }catch{resolve(url);}
    };
    img.onerror=()=>resolve(url);
    img.src=url;
  }).then(result=>{
    // Bound memory for data URLs; original images remain remote.
    if(processed.size>45)processed.delete(processed.keys().next().value);
    processed.set(url,result);pending.delete(url);return result;
  });
  pending.set(url,task);
  return task;
}
export default function NormalizedKitImage({url,alt,className="",placeholderClassName=""}){
  const src=normalizeImageUrl(url);
  const [rendered,setRendered]=useState(()=>processed.get(src)||src);
  const [broken,setBroken]=useState(false);
  useEffect(()=>{
    let alive=true;
    setRendered(processed.get(src)||src);setBroken(false);
    if(src)makeNormalized(src).then(result=>{if(alive)setRendered(result);});
    return ()=>{alive=false;};
  },[src]);
  if(!src||broken)return <div className={"flex h-full w-full flex-col items-center justify-center gap-2 text-slate-300 "+placeholderClassName}><ImageOff size={26}/><span className="text-xs">Sin imagen</span></div>;
  return <img src={rendered} alt={alt} loading="lazy" className={"h-full w-full object-contain "+className} onError={()=>{if(rendered!==src)setRendered(src);else setBroken(true);}}/>;
}
