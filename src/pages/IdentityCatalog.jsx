import React,{useEffect,useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {base44} from '@/api/base44Client';
import {useIdentityChanges,useIdentityPage,readIdentityViews,IDENTITY_KEY} from '@/hooks/useIdentityCatalog';
import IdentityCatalogTable from '@/components/players/IdentityCatalogTable';
export default function IdentityCatalog(){
 const [params]=useSearchParams(),playerId=params.get('player_id');
 const [kind,setKind]=useState('players'),[search,setSearch]=useState(''),[debounced,setDebounced]=useState(''),[cursors,setCursors]=useState([null]);
 useIdentityChanges();
 useEffect(()=>{const t=setTimeout(()=>{setDebounced(search);setCursors([null]);},300);return()=>clearTimeout(t);},[search]);
 const page=useIdentityPage({kind,search:debounced,cursor:cursors.at(-1)});
 const selected=useQuery({queryKey:[...IDENTITY_KEY,'selected',playerId],enabled:!!playerId&&kind==='players',retry:false,queryFn:async()=>readIdentityViews([await base44.entities.Player.get(playerId)])});
 const counts=useQuery({queryKey:[...IDENTITY_KEY,'counts'],staleTime:30000,retry:false,queryFn:async()=>{const values=await Promise.all([base44.entities.Player.count(),base44.entities.FotmobCatalogPlayer.count(),base44.entities.Fm26IdentityCandidate.count()]);return values;}});
 const active=playerId&&kind==='players'?selected:page;
 const rows=playerId&&kind==='players'?selected.data||[]:page.data?.rows||[];
 return <div className="min-h-full space-y-6 bg-background p-4 text-foreground sm:p-8"><div><p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">MF LEGACY · FotMob + FM26</p><h1 className="mt-2 text-2xl font-bold sm:text-3xl">Catálogo y correspondencias</h1><p className="mt-2 max-w-3xl text-sm text-muted-foreground">Conversión local sincronizada con cada jugador por UID FM26 y vínculos guardados. Las coincidencias pendientes conservan su evidencia y requieren revisión.</p></div>
  <div className="grid gap-3 sm:grid-cols-3">{['Jugadores MF LEGACY','Catálogo FotMob','Conversiones FM26'].map((label,i)=><div className="rounded-xl border bg-card p-4" key={label}><strong className="text-2xl">{counts.data?.[i]??'…'}</strong><p className="text-sm text-muted-foreground">{label}</p></div>)}</div>
  {counts.error&&<p role="alert" className="text-destructive">{counts.error.message}</p>}
  <div className="flex flex-wrap gap-3"><button className="rounded-md border px-4 py-2" onClick={()=>{setKind('players');setCursors([null]);}}>Por jugador MF LEGACY</button><button className="rounded-md border px-4 py-2" onClick={()=>{setKind('fotmob');setCursors([null]);}}>Catálogo FotMob completo</button><input className="min-w-0 flex-1 rounded-md border bg-background px-3 py-2" aria-label="Buscar nombre o ID" placeholder="Buscar nombre o ID" value={search} onChange={e=>setSearch(e.target.value)}/><button className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50" disabled={active.isFetching} onClick={()=>{active.refetch();counts.refetch();}}>Actualizar</button></div>
  {active.isPending?<p role="status">Cargando correspondencias…</p>:active.error?<p role="alert" className="rounded-lg border p-4 text-destructive">{active.error.message}</p>:<IdentityCatalogTable kind={kind} rows={rows}/>}
  {!(playerId&&kind==='players')&&<div className="flex items-center gap-4"><button className="rounded-md border px-4 py-2 disabled:opacity-50" disabled={cursors.length===1||page.isFetching} onClick={()=>setCursors(c=>c.slice(0,-1))}>Anterior</button><span>Página {cursors.length}</span><button className="rounded-md border px-4 py-2 disabled:opacity-50" disabled={!page.data?.next||page.isFetching} onClick={()=>setCursors(c=>[...c,page.data.next])}>Siguiente</button></div>}
  <p className="text-xs text-muted-foreground">El trabajador del PC envía solo cambios y la tabla escucha actualizaciones en tiempo real. Las estadísticas y los datos personalizados permanecen en sus entidades originales.</p>
 </div>;
}

