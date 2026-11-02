import {useEffect} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {base44} from '@/api/base44Client';
import {entityRows} from '@/utils/entityRecords';
import {identityView,escapeIdentitySearch} from '@/utils/identityCatalog';
export const IDENTITY_KEY=['identity-catalog'];
export async function readIdentityViews(players){
 const ids=players.map(p=>p.id),uids=players.map(p=>String(p.fm26_uid||'')).filter(Boolean);
 if(!ids.length)return [];
 const [matchResponse,linkResponse]=await Promise.all([uids.length?base44.entities.Fm26IdentityCandidate.filter({fm26_uid:{$in:uids}},undefined,200):[],base44.entities.PlayerFotmobLink.filter({player_id:{$in:ids}},undefined,200)]);
 const matches=entityRows(matchResponse)||[],own=entityRows(linkResponse)||[];
 if(matches.length>=200||own.length>=200)throw Error('Hay demasiadas correspondencias para comprobar la unicidad.');
 const fids=[...new Set([...own.map(l=>l.fotmob_player_id),...matches.map(m=>m.proposed_fotmob_id)].filter(Boolean))];
 const [catalogResponse,backResponse]=fids.length?await Promise.all([base44.entities.FotmobCatalogPlayer.filter({fotmob_id:{$in:fids}},undefined,200),base44.entities.PlayerFotmobLink.filter({fotmob_player_id:{$in:fids}},undefined,200)]):[[],[]];
 const back=entityRows(backResponse)||[],catalog=entityRows(catalogResponse)||[];
 if(back.length>=200||catalog.length>=200)throw Error('El catálogo contiene demasiadas referencias para verificar esta página.');
 const links=[...new Map([...own,...back].map(l=>[l.id,l])).values()];
 return players.map(p=>identityView(p,matches,links,catalog));
}
export function useIdentityChanges(){const client=useQueryClient();useEffect(()=>{let timer;const changed=()=>{clearTimeout(timer);timer=setTimeout(()=>client.invalidateQueries({queryKey:IDENTITY_KEY}),600);};const subs=['Player','PlayerFotmobLink','FotmobCatalogPlayer','Fm26IdentityCandidate'].map(name=>base44.entities[name].subscribe(changed));return()=>{clearTimeout(timer);subs.forEach(unsub=>unsub());};},[client]);}
export function useIdentityPage({kind='players',search='',cursor=null}){
 return useQuery({queryKey:[...IDENTITY_KEY,kind,search,cursor],staleTime:15000,retry:false,queryFn:async()=>{
  const escaped=escapeIdentitySearch(search),entity=kind==='players'?base44.entities.Player:base44.entities.FotmobCatalogPlayer;
  const name=kind==='players'?'name':'player_name';
  const query=escaped?{$or:[{[name]:{$regex:escaped,$options:'i'}},{[kind==='players'?'fm26_uid':'fotmob_id']:search.trim()}]}:{};
  const page=await entity.filter(query,cursor?{cursor,limit:30}:{sort:name,limit:30});
  const players=entityRows(page);if(!players)throw Error('Respuesta de catálogo inválida.');
  return {rows:kind==='players'?await readIdentityViews(players):players,next:page.next_cursor||null};
 }});
}

