import React,{useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Link} from 'react-router-dom';
import {base44} from '@/api/base44Client';
import {Dialog,DialogContent as RawContent,DialogHeader,DialogTitle as RawTitle,DialogTrigger} from '@/components/ui/dialog';
import {readIdentityViews,IDENTITY_KEY} from '@/hooks/useIdentityCatalog';
const DialogContent=/** @type {React.ComponentType<any>} */(RawContent),DialogTitle=/** @type {React.ComponentType<any>} */(RawTitle);
export default function PlayerIdentityDialog({playerId}){
 const [open,setOpen]=useState(false);
 const query=useQuery({queryKey:[...IDENTITY_KEY,'player',playerId],enabled:open&&!!playerId,staleTime:0,retry:false,queryFn:async()=>{const player=await base44.entities.Player.get(playerId);return (await readIdentityViews([player]))[0];}});
 const row=query.data;
 return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><button type="button" className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500 transition hover:text-primary">FOTMOB / FM26</button></DialogTrigger><DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl"><DialogHeader className=""><DialogTitle>Identidad sincronizada · {row?.player.name||'Jugador'}</DialogTitle></DialogHeader>
  {query.isPending&&<p role="status">Consultando correspondencia…</p>}{query.error&&<p role="alert" className="text-destructive">{query.error.message}</p>}
  {row&&<div className="space-y-4 text-sm"><p className="font-semibold">{row.label}</p><dl className="grid grid-cols-2 gap-3"><dt>UID FM26</dt><dd>{row.player.fm26_uid||'Pendiente'}</dd><dt>unique_id FM26</dt><dd>{row.player.fm26_unique_id||'Pendiente'}</dd><dt>ID FotMob vinculado</dt><dd>{row.fotmob_id||'Sin vínculo'}</dd><dt>Nombre FotMob</dt><dd>{row.source?.player_name||'Fuente pendiente'}</dd><dt>Verificación del vínculo</dt><dd>{row.link?.verification||'No confirmada'}</dd></dl>
  {row.source_missing&&<p>El vínculo existente se conserva; falta su ficha en el catálogo local.</p>}
  {!row.fotmob_id&&row.proposed_fotmob_id&&<p>Candidato pendiente de revisión: FotMob {row.proposed_fotmob_id}. Puntuación {row.candidate?.confidence}.</p>}
  {!!row.candidate?.candidates?.length&&<details><summary className="cursor-pointer">Candidatos y evidencias</summary><ul className="space-y-2 py-3">{row.candidate.candidates.map(c=><li key={c.fotmob_id}>{c.name} · {c.fotmob_id} · {c.score}<p className="text-xs text-muted-foreground">{c.evidence?.join(' · ')}</p></li>)}</ul></details>}
  <p className="text-xs text-muted-foreground">Última conversión guardada: {row.candidate?.synced_at?new Date(row.candidate.synced_at).toLocaleString('es-ES'):'Pendiente'}. Los candidatos por nombre requieren revisión.</p>
  <Link className="inline-flex rounded-md bg-primary px-4 py-2 text-primary-foreground" to={'/identity-catalog?player_id='+encodeURIComponent(playerId)} onClick={()=>setOpen(false)}>Abrir tabla de correspondencias</Link></div>}
 </DialogContent></Dialog>;
}

