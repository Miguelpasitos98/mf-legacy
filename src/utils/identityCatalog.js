export const IDENTITY_LABELS={identidad_confirmada:'Identidad confirmada',alta_confianza:'Alta confianza',probable:'Coincidencia probable',revision_necesaria:'Revisión necesaria',conflicto:'Conflicto',sin_candidato:'Sin candidato',sin_fm26:'Sin UID FM26',automatic_existing:'Vínculo previo automático',approval_pending:'Aprobada; sincronización pendiente'};
const MANUAL=new Set(['manual','manual_confirmada','verified','confirmed','manual_verified','confirmed_manual','confirmada']);
export function identityView(player,matches=[],links=[],catalog=[]){
 const uid=String(player.fm26_uid||''),own=links.filter(l=>l.player_id===player.id),found=matches.filter(m=>m.fm26_uid===uid);
 const candidate=found.length===1?found[0]:null,link=own.length===1?own[0]:null;
 const fid=String(link?.fotmob_player_id||''),backlinks=links.filter(l=>String(l.fotmob_player_id||'')===fid&&fid);
 const conflict=own.length>1||found.length>1||backlinks.some(l=>l.player_id!==player.id)||Boolean(link?.fm26_uid&&uid&&link.fm26_uid!==uid);
 const verified=Boolean(!conflict&&link&&MANUAL.has(link.verification));
 const proposed=candidate?.proposed_fotmob_id||'';
 const source=catalog.find(c=>c.fotmob_id===(fid||proposed));
 const status=conflict?'conflicto':verified?'identidad_confirmada':link?'automatic_existing':candidate?.status==='identidad_confirmada'?'approval_pending':candidate?.status||(!uid?'sin_fm26':'sin_candidato');
 return {player,candidate,link,source,fotmob_id:fid,proposed_fotmob_id:proposed,status,verified,identity_conflict:conflict,source_missing:Boolean(fid&&!source),label:IDENTITY_LABELS[status]||status};
}
export function escapeIdentitySearch(value){return String(value||'').trim().slice(0,100).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}


