// Visual designs of the same official FIFA competition, not additional FM trophy IDs.
// Any historical champions remain linked to the original Football Manager source_id 121092.
export const FIFA_CWC_SOURCE_ID="121092";
export const CLASSIC_CWC_VARIANT="fifa-club-world-cup-classic-2005-2023";
export const MODERN_CWC_VARIANT="fifa-club-world-cup-modern-2025";
export const CLASSIC_CWC_URL="https://media.base44.com/images/public/6a88359fd43f2af862874b12/8ddb16942_FIFA_Club_World_Cup_Classic_2005-2023_CC-BY-SA4.png";
export const CLASSIC_CWC_SOURCE="https://commons.wikimedia.org/wiki/File:FIFA_Club_World_Cup_Football_Trophy_HD_PNG-Photoroom.png";
export const CLASSIC_CWC_CREDIT="ImLaurenz · Wikimedia Commons · CC BY-SA 4.0";
export const FIFA_CWC_VISUAL_VARIANTS=[
 {id:CLASSIC_CWC_VARIANT,source_id:FIFA_CWC_SOURCE_ID,label:"Trofeo clásico",name:"Mundial de Clubes FIFA · Trofeo clásico (2005–2023)",from:2005,to:2023,image_url:CLASSIC_CWC_URL,credit:CLASSIC_CWC_CREDIT,source_url:CLASSIC_CWC_SOURCE},
 {id:MODERN_CWC_VARIANT,source_id:FIFA_CWC_SOURCE_ID,label:"Trofeo actual",name:"Mundial de Clubes FIFA · Trofeo actual (desde 2025)",from:2025,to:null,image_url:"",credit:"Imagen original del catálogo MF LEGACY",source_url:""}
];
export const isFifaClubWorldCup=t=>String(t?.source_id||"")===FIFA_CWC_SOURCE_ID;
export const editionStartYear=season=>{
 const match=String(season??"").match(/\b(?:19|20)\d{2}\b/);
 return match?Number(match[0]):null;
};
export const fifaCwcVariantForSeason=season=>{
 const year=editionStartYear(season);
 if(year>=2005&&year<=2023)return FIFA_CWC_VISUAL_VARIANTS[0];
 if(year>=2025)return FIFA_CWC_VISUAL_VARIANTS[1];
 return null; // 2000 had a separate inaugural design, 2024 had no FIFA CWC edition.
};
export function expandTrophyVisualCards(trophies=[]){
 return trophies.flatMap(t=>!isFifaClubWorldCup(t)?[t]:
  FIFA_CWC_VISUAL_VARIANTS.map(variant=>({...t,visual_variant_id:variant.id,visual_parent_source_id:FIFA_CWC_SOURCE_ID,name:variant.name,organizer:t.organizer||"FIFA",category:t.category||"International",visual_variant_years:variant.to?variant.from+"–"+variant.to:"Desde "+variant.from})));
}
export const fifaCwcVariantImageUrl=(trophy,season)=>{
 if(!isFifaClubWorldCup(trophy))return "";
 if(trophy?.visual_variant_id===CLASSIC_CWC_VARIANT)return CLASSIC_CWC_URL;
 if(trophy?.visual_variant_id===MODERN_CWC_VARIANT)return ""; // Use the existing modern image in the canonical catalogue.
 return fifaCwcVariantForSeason(season)?.id===CLASSIC_CWC_VARIANT?CLASSIC_CWC_URL:"";
};
