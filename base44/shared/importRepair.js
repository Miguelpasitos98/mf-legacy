import {allRows,applyVerifiedHistoricals,completionPatch,verifiedIdentity,retryMutation} from "./importReview.js";
const str=x=>String(x??"").trim();
const now=()=>new Date().toISOString();
const publicRun=r=>({id:r.id,mode:r.mode,status:r.status,cursor:r.cursor,total:r.targets.length,counts:r.counts,last_error:r.last_error||""});
async function advanceRun(db,run,report){
  const counts={...run.counts,jobs:run.cursor+1,compatible:run.counts.compatible+(report.applied||0),added:run.counts.added+(report.added_values||0),unchanged:run.counts.unchanged+(report.unchanged_values||0),conflicts:run.counts.conflicts+(report.conflicts?.length||0),errors:run.counts.errors+(report.errors?.length||0)};
  const current=await db.ImportRepairRun.get(run.id);
  return db.ImportRepairRun.update(run.id,{cursor:run.cursor+1,counts,status:run.cursor+1===run.targets.length?"completed":current.status==="paused"?"paused":"ready",last_error:""});
}
// Persistent runs process one job at a time. Sporting writes and candidate
// acknowledgements are idempotent; a crash repeats the current job safely.
export async function repairRequest(db,data,actor){
  const action=data.action;
  if(action==="repair-create"){
    const [stats,jobs]=await Promise.all([allRows(db.PlayerSeasonStats,{}),allRows(db.ImportJob,{})]);
    const ids=Array.isArray(data.player_ids)?new Set(data.player_ids.map(str)):null;
    const players=new Set(stats.map(r=>str(r.player_id)).filter(Boolean));
    const targets=jobs.filter(j=>(!ids||ids.has(str(j.player_id)))&&["review","completed"].includes(j.status))
      .sort((a,b)=>str(a.id).localeCompare(str(b.id))).map(j=>({job_id:j.id,player_id:j.player_id}));
    const missing=[...players].filter(id=>(!ids||ids.has(id))&&!targets.some(t=>t.player_id===id));
    targets.push(...missing.map(player_id=>({player_id})));
    const run=await db.ImportRepairRun.create({mode:"simulation",status:"ready",targets,cursor:0,counts:{jobs:0,compatible:0,added:0,unchanged:0,conflicts:0,errors:0},created_by_actor:actor,started_at:now(),players_scanned:players.size});
    return {ok:true,run:publicRun(run),players_without_jobs:missing};
  }
  if(!/^[a-f0-9]{24}$/i.test(str(data.run_id)))throw Error("ID de reparación inválido.");
  let run=await db.ImportRepairRun.get(data.run_id);
  if(action==="repair-status")return {ok:true,run:publicRun(run),reports:await allRows(db.ImportRepairItem,{run_id:run.id})};
  if(action==="repair-apply"){
    if(run.mode!=="simulation"||run.status!=="completed")throw Error("Primero debe terminar la simulación y su informe.");
    const existing=await allRows(db.ImportRepairRun,{simulation_id:run.id,mode:"apply"});
    if(existing.length>1)throw Error("Ejecuciones duplicadas; revisar.");
    const next=existing[0]||await db.ImportRepairRun.create({mode:"apply",simulation_id:run.id,status:"ready",targets:run.targets,cursor:0,counts:{jobs:0,compatible:0,added:0,unchanged:0,conflicts:0,errors:0},created_by_actor:actor,started_at:now()});
    return {ok:true,run:publicRun(next)};
  }
  if(action==="repair-pause"||action==="repair-resume"){
    if(run.status==="completed")return {ok:true,run:publicRun(run)};
    run=await db.ImportRepairRun.update(run.id,{status:action==="repair-pause"?"paused":"ready"});
    return {ok:true,run:publicRun(run)};
  }
  if(action==="repair-recover"){
    if(run.mode!=="apply"||run.status!=="completed")throw Error("Completa primero la reparación de candidatos descargados.");
    const links=await allRows(db.PlayerFotmobLink,{});
    const players=[...new Set(run.targets.map(t=>t.player_id))];let queued=0;
    for(const player_id of players){
      const playerLinks=links.filter(l=>l.player_id===player_id);
      if(!playerLinks.length)continue;
      const pid=str(playerLinks[0].fotmob_player_id);
      try{await verifiedIdentity(db,{player_id,fotmob_player_id:pid});}catch{continue;}
      const active=await allRows(db.ImportJob,{player_id,status:{$in:["queued","running"]}});
      const key="mfv3:repair:"+run.id+":"+player_id;
      if(active.length||(await allRows(db.ImportJob,{job_key:key})).length)continue;
      await db.ImportJob.create({job_key:key,player_id,fotmob_player_id:pid,sources:["fotmob","understat","fifa","market"],status:"queued",progress:0,requested_at:now(),received_candidates:0,retry_pending:true,phase:"Recuperación global: fuentes independientes",source_results:{}});queued++;
    }
    return {ok:true,queued};
  }
  if(action!=="repair-step")throw Error("Operación de reparación desconocida.");
  if(["paused","completed"].includes(run.status))return {ok:true,run:publicRun(run)};
  const lock=crypto.randomUUID(),until=new Date(Date.now()+240000).toISOString();
  await retryMutation(()=>db.ImportRepairRun.updateMany({id:run.id,$or:[{lock_until:{$exists:false}},{lock_until:null},{lock_until:""},{lock_until:{$lt:now()}}]},{$set:{lock_id:lock,lock_until:until}}));
  if((await db.ImportRepairRun.get(run.id)).lock_id!==lock)throw Error("Otra reparación está procesando este lote.");
  try{
    // Read after acquiring the lease: another step may have advanced while
    // this request was acquiring its lock.
    run=await db.ImportRepairRun.get(run.id);
    if(["paused","completed"].includes(run.status))return {ok:true,run:publicRun(run)};
    const target=run.targets[run.cursor];
    if(!target){run=await db.ImportRepairRun.update(run.id,{status:"completed",finished_at:now()});return {ok:true,run:publicRun(run)};}
    const itemKey=run.id+":"+(target.job_id||target.player_id);
    const saved=await allRows(db.ImportRepairItem,{item_key:itemKey});
    if(saved.length>1)throw Error("Informe duplicado; no se avanza el cursor.");
    // A committed report is the durable checkpoint for this batch. A crash
    // before the cursor commit must retain its original additions/counts.
    if(saved.length){
      run=await advanceRun(db,run,saved[0].report);
      return {ok:true,run:publicRun(run),report:saved[0].report};
    }
    if(!target.job_id){
      const report={applied:0,pending:null,added_values:0,unchanged_values:0,conflicts:[],errors:[{reason:"Sin trabajos previos: requiere recuperación de fuente y vinculación verificada"}],scopes:[]};
      const key=run.id+":"+target.player_id,existing=await allRows(db.ImportRepairItem,{item_key:key});
      if(!existing.length)await db.ImportRepairItem.create({run_id:run.id,item_key:key,player_id:target.player_id,report,checked_at:now()});
      run=await db.ImportRepairRun.update(run.id,{cursor:run.cursor+1,counts:{...run.counts,jobs:run.counts.jobs+1,errors:run.counts.errors+1},status:run.cursor+1===run.targets.length?"completed":"ready"});
      return {ok:true,run:publicRun(run),report};
    }
    const job=await db.ImportJob.get(target.job_id);
    if(job.review_lock_until&&job.review_lock_until>now())throw Error("El trabajo tiene una revisión en curso; reintentar después.");
    // Same job lease is used by manual/automatic review and global repair.
    await retryMutation(()=>db.ImportJob.updateMany({id:job.id,$or:[{review_lock_until:{$exists:false}},{review_lock_until:null},{review_lock_until:""},{review_lock_until:{$lt:now()}}]},{$set:{review_lock_id:lock,review_lock_until:until}}));
    if((await db.ImportJob.get(job.id)).review_lock_id!==lock)throw Error("No se adquirió la revisión del trabajo.");
    let report;
    try{
      report=await applyVerifiedHistoricals(db,job,{dryRun:run.mode==="simulation"});
      if(run.mode==="apply")await db.ImportJob.update(job.id,completionPatch(await db.ImportJob.get(job.id),report.pending));
    }catch(e){report={applied:0,pending:null,added_values:0,unchanged_values:0,conflicts:[],errors:[{reason:e.message}],scopes:[]};}
    finally{if((await db.ImportJob.get(job.id)).review_lock_id===lock)await db.ImportJob.update(job.id,{review_lock_id:"",review_lock_until:""});}
    const key=run.id+":"+job.id;
    const previous=await allRows(db.ImportRepairItem,{item_key:key});
    const record={run_id:run.id,item_key:key,job_id:job.id,player_id:job.player_id,report,checked_at:now()};
    if(previous.length>1)throw Error("Informe duplicado; no se avanza el cursor.");
    if(previous.length)await db.ImportRepairItem.update(previous[0].id,record);else await db.ImportRepairItem.create(record);
    // A pause requested while this job was executing takes effect after it.
    run=await advanceRun(db,run,report);
    return {ok:true,run:publicRun(run),report};
  }catch(error){await db.ImportRepairRun.update(run.id,{last_error:String(error.message||error)});throw error;}
  finally{if((await db.ImportRepairRun.get(run.id)).lock_id===lock)await db.ImportRepairRun.update(run.id,{lock_id:"",lock_until:""});}
}
