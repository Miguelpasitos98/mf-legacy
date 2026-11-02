/** Heuristic diagnostics for the editor; CA is a Football Manager valuation, not match performance. */
export const validCA = value => {
  if(value === "" || value == null)return null;
  const n=Number(value);
  return Number.isFinite(n) && n>=1 && n<=200 ? n : null;
};
export const zoneAt = (x,y) => y>=84?"GK":y>=64?"DEF":y>=38?"MID":"ATT";
const positionZone = {GK:"GK",DFC:"DEF",CB:"DEF",DC:"ATT",ST:"ATT",CF:"ATT",LD:"DEF",LI:"DEF",RB:"DEF",LB:"DEF",CRD:"DEF",CRI:"DEF",RWB:"DEF",LWB:"DEF",CDM:"MID",DM:"MID",CM:"MID",CAM:"MID",AM:"MID",MC:"MID",EI:"ATT",ED:"ATT",LW:"ATT",RW:"ATT",LM:"MID",RM:"MID"};
const positions = player => [player?.position,player?.secondary_position].filter(Boolean).map(p=>String(p).toUpperCase().trim());
export function positionFit(player,x,y){
  const zone=zoneAt(x,y);
  const ps=positions(player);
  if(!ps.length)return null;
  const exact = ps.some((p,i) => {
    const expected=positionZone[p];
    if(expected !== zone) return false;
    if(["LI","LB","CRI","LWB","EI","LW","LM"].includes(p) && x>65)return false;
    if(["LD","RB","CRD","RWB","ED","RW","RM"].includes(p) && x<35)return false;
    return i===0;
  });
  if(exact)return 1;
  if(ps.some(p => positionZone[p]===zone))return 0.85;
  if(ps.some(p => ["DEF","MID"].includes(zone) && ["DEF","MID"].includes(positionZone[p]) || ["MID","ATT"].includes(zone) && ["MID","ATT"].includes(positionZone[p])))return 0.6;
  return 0.25;
}
export function analyzeLineup(placements, roster){
  const lookup=new Map(roster.map(r=>[String(r.player_id),r.player]));
  const selected=placements.filter(p=>p.player_id && lookup.has(String(p.player_id)));
  const scores=selected.map(p=>validCA(lookup.get(String(p.player_id))?.ca)).filter(n=>n!==null);
  const quality=scores.length?Math.round(scores.reduce((a,b)=>a+b,0)/scores.length*10)/10:null;
  const zoneCount={GK:0,DEF:0,MID:0,ATT:0};
  const fits=[];
  const widths={DEF:[],MID:[],ATT:[]};
  for(const p of selected){
    const z=zoneAt(p.x,p.y);zoneCount[z]++;
    if(widths[z]) widths[z].push(p.x);
    const f=positionFit(lookup.get(String(p.player_id)),p.x,p.y);
    if(f!==null)fits.push(f);
  }
  const covered=["GK","DEF","MID","ATT"].filter(z=>zoneCount[z]>0).length;
  const distribution=selected.length?Math.max(0,1-Math.max(0,zoneCount.DEF-5,zoneCount.MID-6,zoneCount.ATT-4)*0.18):0;
  const lateral=[...Object.values(widths)].filter(xs=>xs.length>=2).map(xs=>Math.min(1,(Math.max(...xs)-Math.min(...xs))/48));
  const widthScore=lateral.length?lateral.reduce((a,b)=>a+b,0)/lateral.length:0;
  const fitScore=fits.length?fits.reduce((a,b)=>a+b,0)/fits.length:0.5;
  const coverage=(covered/4)*0.65 + Math.min(1,selected.length/11)*0.35;
  const balance=Math.round(100*(0.4*coverage+0.35*fitScore+0.15*widthScore+0.1*distribution));
  const warnings=[];
  if(zoneCount.GK===0)warnings.push("Falta portero");
  if(zoneCount.DEF<3)warnings.push("Defensa poco cubierta");
  if(zoneCount.MID<2)warnings.push("Centro del campo poco cubierto");
  if(zoneCount.ATT<1)warnings.push("Falta presencia ofensiva");
  if(fits.length && fitScore<0.65)warnings.push("Varios jugadores fuera de su zona habitual");
  return {balance,quality,knownCA:scores.length,total:selected.length,zoneCount,fitScore:Math.round(fitScore*100),warnings};
}
export function referenceTeams(memberships,players,excludedTeamId){
  const byId=new Map(players.map(p=>[String(p.id),validCA(p.ca)]));
  const grouped=new Map();
  for(const m of memberships){
    const id=String(m.team_id||"");
    if(!id||id===String(excludedTeamId))continue;
    const value=byId.get(String(m.player_id));
    if(value===null || value===undefined)continue;
    if(!grouped.has(id))grouped.set(id,new Map());
    grouped.get(id).set(String(m.player_id),value);
  }
  return [...grouped.values()].map(m=>[...m.values()].sort((a,b)=>b-a).slice(0,11)).filter(v=>v.length>=8).map(v=>v.reduce((a,b)=>a+b,0)/v.length);
}
