// GaonGreen RLS / storage ISOLATION CHECKS - for an AUTHORIZED STAGING project with two FICTIONAL accounts. Node >= 20, no dependencies (plain fetch).
// STATUS: DRAFT. Has NOT been run against a real Supabase project by its author. Request shapes follow Supabase PostgREST/Auth/Storage REST conventions and must be
// confirmed on the first staging run. A PASS here means "these specific checks passed on that project at that time" - not "RLS is secure".
//
// Required env:  STAGING_URL  STAGING_KEY (publishable key of STAGING)  A_EMAIL A_PASSWORD B_EMAIL B_PASSWORD  ALLOW_STAGING=yes
// Optional env:  CHECK_MIME=yes (after the allow-list is applied)  CHECK_LIMITS=yes  PRODUCTION_HOSTS (comma list, extra hosts to refuse)  OUT (result json path)  BUCKET (default evidence-locker)
// Exit codes: 0 all checks passed, 1 at least one check failed (incl. cleanup), 2 refused to run (guard) or setup failed, 3 result unwritable,
//             5 no check failed but tables were BLOCKED to protect existing data (NOT a pass), 130 interrupted (cleanup ran).
// Data safety: a run marker unique to THIS run is written into every row/object it creates. All 7 tables are read for A and B BEFORE the first write;
// a table holding any row that is not from this run is BLOCKED (never written). Writes are plain INSERTs (never upsert; storage x-upsert:false); attacks and deletes are filtered by owner AND this run's marker.
// Every write is registered in a cleanup ledger BEFORE it is sent (a lost response is still cleaned up); cleanup runs in finally and on SIGINT/SIGTERM,
// deletes only this run's marker, and is VERIFIED by reading back. Rows of other runs are never deleted (they block and are reported).
import fs from 'node:fs';
const env=process.env, refuse=m=>{console.error('REFUSED: '+m);process.exit(2)};
const KNOWN_PRODUCTION=['uyhmbecltrswiljbyass.supabase.co'];            // host found in the production pages; never test against it
if(env.ALLOW_STAGING!=='yes')refuse('set ALLOW_STAGING=yes to confirm STAGING_URL is a staging project you are authorized to test');
let base;try{base=new URL(env.STAGING_URL)}catch{refuse('STAGING_URL missing or invalid')}
if(base.protocol!=='https:'&&!/^(127\.0\.0\.1|localhost)$/.test(base.hostname))refuse('STAGING_URL must be https (or localhost for the harness)');
const prod=new Set([...KNOWN_PRODUCTION,...(env.PRODUCTION_HOSTS||'').split(',').map(s=>s.trim()).filter(Boolean)]);
if(prod.has(base.host))refuse('STAGING_URL host is a known PRODUCTION host: '+base.host);
const KEY=env.STAGING_KEY||'';if(!KEY)refuse('STAGING_KEY missing');
if(/^sb_secret_/.test(KEY))refuse('a SECRET key was supplied; this suite must use the publishable (anon) key only, because secret keys bypass RLS');
try{const p=JSON.parse(Buffer.from(KEY.split('.')[1]||'','base64url').toString());if(p.role&&p.role!=='anon')refuse('JWT key role is "'+p.role+'", not anon (service_role bypasses RLS)')}catch{}
const okDomain=e=>/@(example\.(com|org|net)|[a-z0-9.-]*\.invalid|[a-z0-9.-]*\.test)$/i.test(e||'');
for(const k of ['A_EMAIL','B_EMAIL']){if(!okDomain(env[k]))refuse(k+' must be a FICTIONAL address on a reserved domain (example.com/.org/.net, *.invalid, *.test)')}
if(!env.A_PASSWORD||!env.B_PASSWORD)refuse('A_PASSWORD / B_PASSWORD missing');
if(env.A_EMAIL.toLowerCase()===env.B_EMAIL.toLowerCase())refuse('A and B must be different accounts');
const BUCKET=env.BUCKET||'evidence-locker', root=base.origin;
const results=[];const rec=(id,name,pass,detail)=>{results.push({id,name,status:pass?'PASS':'FAIL',detail});console.log((pass?'PASS ':'FAIL ')+id+' '+name+(pass?'':'  :: '+detail))};
const blocked=(id,name,detail)=>{results.push({id,name,status:'BLOCKED',detail});console.log('BLOCKED '+id+' '+name+'  :: '+detail)};
const hdr=(tok,extra)=>({apikey:KEY,Authorization:'Bearer '+(tok||KEY),'Content-Type':'application/json',...extra});
// Network errors and timeouts become status 0 (never an exception), so the run always reaches its cleanup.
const TIMEOUT_MS=Number(env.RLS_REQUEST_TIMEOUT_MS||20000);
let halted=false,inflight=0;
const call=async(method,path,{tok,body,headers,raw,cleanup}={})=>{if(halted&&!cleanup)return{status:0,json:undefined,text:'not sent: run interrupted'};if(!cleanup)inflight++;try{const r=await fetch(root+path,{method,headers:hdr(tok,headers),body:raw??(body===undefined?undefined:JSON.stringify(body)),signal:AbortSignal.timeout(TIMEOUT_MS)});const text=await r.text();let json;try{json=JSON.parse(text)}catch{}return{status:r.status,json,text}}catch(e){return{status:0,json:undefined,text:'network error: '+String(e&&e.name||'error')}}finally{if(!cleanup)inflight--}};
const signIn=async(email,password)=>{const r=await call('POST','/auth/v1/token?grant_type=password',{body:{email,password}});if(r.status!==200||!r.json?.access_token)refuse(`sign-in failed for ${email} (HTTP ${r.status}). Create the fictional staging accounts first.`);const uid=r.json.user?.id||JSON.parse(Buffer.from(r.json.access_token.split('.')[1],'base64url').toString()).sub;return{tok:r.json.access_token,uid}};
const A=await signIn(env.A_EMAIL,env.A_PASSWORD),B=await signIn(env.B_EMAIL,env.B_PASSWORD);
if(A.uid===B.uid)refuse('A and B resolved to the same user id');
console.log(`Running against STAGING host ${base.host} with fictional accounts. A=${A.uid.slice(0,8)}.. B=${B.uid.slice(0,8)}..`);
// ---- Run marker: unique to THIS run. Only rows/objects carrying it are ever written, attacked or deleted.
const RUN=new Date().toISOString().replace(/[-:.TZ]/g,'').slice(0,14)+'-'+crypto.randomUUID().slice(0,8);
const MARK='gg-rls-test-'+RUN, RK='gg_rls_run';
console.log('run marker: '+MARK);
const rows=a=>Array.isArray(a)?a:[];
const denied=r=>r.status===401||r.status===403||(r.json&&(r.json.code==='42501'||/row-level security|permission denied|not authorized|unauthorized/i.test(r.text)));
const nothing=r=>(r.status>=200&&r.status<300&&rows(r.json).length===0)||denied(r);
const ok2=r=>r.status>=200&&r.status<300, got=r=>r.status>0; // got: an HTTP response arrived (status 0 = network error/timeout, never a pass)
// a cross-account read only PASSES on a real 4xx refusal whose body does not contain the protected content (status 0, 2xx, 3xx and 5xx all FAIL)
const refusedNoLeak=(r,secret)=>r.status>=400&&r.status<500&&!String(r.text||'').includes(secret);
// table specs: owner column + payload shaped like the pages write + the run-marker filter (mk) + a hijack body that keeps the marker
const TABLES=[
 {t:'company_profiles',o:'owner_id',data:{company_name:MARK,country:'KR',industry:'test',currency:'KRW',expenses:[]},key:'owner_id',mk:`company_name=eq.${MARK}`,hijack:{industry:'HIJACKED'}},
 {t:'kissb_drafts',o:'user_id',data:{payload:{[RK]:RUN}},key:'user_id',mk:`payload->>${RK}=eq.${RUN}`,hijack:{payload:{[RK]:RUN,hijacked:true}}},
 {t:'kre100_drafts',o:'owner_id',data:{draft_data:{[RK]:RUN}},key:'owner_id',mk:`draft_data->>${RK}=eq.${RUN}`,hijack:{draft_data:{[RK]:RUN,hijacked:true}}},
 {t:'epr_drafts',o:'owner_id',data:{draft_data:{[RK]:RUN}},key:'owner_id',mk:`draft_data->>${RK}=eq.${RUN}`,hijack:{draft_data:{[RK]:RUN,hijacked:true}}},
 {t:'supplier_esg_drafts',o:'owner_id',data:{draft_data:{[RK]:RUN}},key:'owner_id',mk:`draft_data->>${RK}=eq.${RUN}`,hijack:{draft_data:{[RK]:RUN,hijacked:true}}},
 {t:'qr_esg_drafts',o:'user_id',data:{draft:{[RK]:RUN}},key:'user_id',mk:`draft->>${RK}=eq.${RUN}`,hijack:{draft:{[RK]:RUN,hijacked:true}}},
 {t:'evidence_documents',o:'user_id',data:{company:MARK,title:MARK,category:'corporate',year:2026,review_status:'pending',notes:'',filename:'gg-rls-test.txt',size_bytes:1},key:'id',needsId:true,mk:`title=eq.${MARK}`,hijack:{notes:'HIJACKED'}},
];
const rest=(t)=>'/rest/v1/'+t;
const isThisRun=(S,r)=>S.data.company_name?r.company_name===MARK:S.data.title?r.title===MARK:[r.payload,r.draft_data,r.draft].some(x=>x&&typeof x==='object'&&x[RK]===RUN);
const looksLikeTestRow=r=>/gg-rls-test|gg_rls_run/.test(JSON.stringify(r));
// ---- Cleanup ledger: an entry is registered BEFORE the write it covers, so a write whose response was lost is still removed.
const OWN={A,B},ledger=new Map();
const noteRows=(S,who)=>ledger.set('row:'+S.t+':'+who,{kind:'row',S,who});
const noteObjs=(label,paths)=>ledger.set('obj:'+label,{kind:'obj',label,paths});
const ownerOf=p=>p.split('/')[0]===A.uid?A:B;
const retry=async(fn,n=3)=>{let r;for(let i=0;i<n;i++){r=await fn();if(r.status>0&&r.status<500)return r;await new Promise(s=>setTimeout(s,400*(i+1)))}return r};
let cleaning=null;
const cleanup=()=>cleaning||(cleaning=(async()=>{halted=true;for(let w=0;inflight>0&&w<TIMEOUT_MS+2000;w+=50)await new Promise(s=>setTimeout(s,50));
 for(const e of ledger.values()){
 if(e.kind==='row'){const U=OWN[e.who];const q=`${rest(e.S.t)}?${e.S.o}=eq.${U.uid}&${e.S.mk}`;
  const d=await retry(()=>call('DELETE',q,{tok:U.tok,headers:{Prefer:'return=representation'},cleanup:true}));
  const left=await retry(()=>call('GET',q+'&select='+e.S.o,{tok:U.tok,cleanup:true}));
  const ok=d.status>=200&&d.status<300&&left.status>=200&&left.status<300&&rows(left.json).length===0;
  rec(`cleanup.${e.S.t}.${e.who}`,`this run's ${e.S.t} rows owned by ${e.who} are deleted and verified absent`,ok,`delete HTTP ${d.status} removed=${rows(d.json).length}; verify HTTP ${left.status} remaining=${rows(left.json).length}`)}
 else{const del=[],still=[];for(const p of e.paths){for(const U of [ownerOf(p),A,B].filter((x,i,a)=>a.indexOf(x)===i)){const d=await retry(()=>call('DELETE',`/storage/v1/object/${BUCKET}`,{tok:U.tok,body:{prefixes:[p]},cleanup:true}));del.push(d.status)}
   const g=await retry(()=>call('GET',`/storage/v1/object/authenticated/${BUCKET}/${p}`,{tok:ownerOf(p).tok,cleanup:true}));if(!(g.status===400||g.status===404))still.push(g.status)}
  rec(`cleanup.storage.${e.label}`,`this run's test object(s) "${e.label}" are deleted and verified absent`,still.length===0,`objects=${e.paths.length} delete HTTP ${[...new Set(del)].join('/')}; verify not-found for all=${still.length===0}${still.length?' (HTTP '+still.join(',')+')':''}`)}}})());
const finish=(forced)=>{const fails=results.filter(r=>r.status==='FAIL').length,blk=results.filter(r=>r.status==='BLOCKED').length,cl=results.filter(r=>r.id.startsWith('cleanup.'));
 const report={ranAt:new Date().toISOString(),target:base.host,run:MARK,note:'DRAFT suite; checks only what is listed; not a proof of security',total:results.length,failed:fails,blocked:blk,cleanup:{checks:cl.length,failed:cl.filter(r=>r.status!=='PASS').length},results};
 let outErr=null;if(env.OUT){try{fs.writeFileSync(env.OUT,JSON.stringify(report,null,1))}catch(e){outErr=e}}
 console.log(`\n${results.filter(r=>r.status==='PASS').length}/${results.length} passed, ${fails} failed, ${blk} blocked against ${base.host} (run ${MARK})`);
 if(outErr){console.error('RESULT-FILE-ERROR: could not write OUT ('+(outErr.code||outErr.name)+'); check outcome was '+(fails?'FAILED':blk?'BLOCKED':'PASSED')+' but is unrecorded');process.exit(3)}
 process.exit(forced||(fails?1:blk?5:0))};
let stopping=false;
for(const sig of ['SIGINT','SIGTERM'])process.on(sig,async()=>{if(stopping)return;stopping=true;console.error('INTERRUPTED by '+sig+': cleaning up this run\'s test data only');rec('run.INTERRUPTED','the run was interrupted ('+sig+'); cleanup still ran',false,sig);await cleanup();finish(130)});
try{
// ---- Pre-flight: read ALL 7 tables for A and B BEFORE the first write. A table holding any row that is not from this run is BLOCKED (never written).
const pre={};
for(const S of TABLES){const why=[];for(const [w,U] of [['A',A],['B',B]]){const r=await call('GET',`${rest(S.t)}?${S.o}=eq.${U.uid}&select=*`,{tok:U.tok});
  if(!(r.status>=200&&r.status<300)){why.push(`${w}: pre-flight read failed (HTTP ${r.status}), cannot prove the table is free of real data`);continue}
  const other=rows(r.json).filter(x=>!isThisRun(S,x)),old=other.filter(looksLikeTestRow).length;
  if(other.length)why.push(`${w}: ${other.length} existing row(s) not from this run${old?` (${old} look like an earlier test run; left untouched for manual review)`:''}`)}
 pre[S.t]=why}
for(const S of TABLES){const {t,o,mk}=S;
 if(pre[t].length){blocked(`${t}.BLOCKED`,'write checks skipped to protect existing data; nothing was written to this table',pre[t].join('; '));continue}
 const mine=(u)=>({...S.data,[o]:u.uid,...(S.needsId?{id:crypto.randomUUID(),storage_path:u.uid+'/'+MARK+'/doc'}:{})});
 noteRows(S,'A');noteRows(S,'B'); // before the first write: covers lost responses and rows forged for either owner
 // plain INSERT, never upsert: if real data appeared after pre-flight the server rejects the insert (unique owner) instead of it being overwritten
 const ins=await call('POST',rest(t),{tok:A.tok,body:mine(A),headers:{Prefer:'return=representation'}});
 const created=ins.status>=200&&ins.status<300&&rows(ins.json).length===1;
 rec(`${t}.T0`,'positive control: A can insert and read back its own row',created&&rows((await call('GET',rest(t)+`?${o}=eq.${A.uid}&${mk}&select=*`,{tok:A.tok})).json).length>=1,`insert HTTP ${ins.status} ${ins.text.slice(0,120)}`);
 if(!created){rec(`${t}.SKIP`,'remaining checks for this table are not meaningful without T0',false,'T0 failed - schema/policy mismatch, column names differ, or the response was lost');continue}
 const anonSel=await call('GET',rest(t)+`?${o}=eq.${A.uid}&select=*`,{});rec(`${t}.T1`,'anon (no login) cannot read A\'s row',nothing(anonSel),`HTTP ${anonSel.status} ${anonSel.text.slice(0,100)}`);
 const anonIns=await call('POST',rest(t),{body:mine(A),headers:{Prefer:'return=minimal'}});rec(`${t}.T2`,'anon cannot insert',denied(anonIns)||anonIns.status>=400,`HTTP ${anonIns.status}`);
 const bSel=await call('GET',rest(t)+`?${o}=eq.${A.uid}&select=*`,{tok:B.tok});rec(`${t}.T3`,'B cannot read A\'s row by owner filter',nothing(bSel),`HTTP ${bSel.status} rows=${rows(bSel.json).length}`);
 const bAll=await call('GET',rest(t)+'?select=*',{tok:B.tok});rec(`${t}.T4`,'B\'s unfiltered read returns only B-owned rows',bAll.status<300&&rows(bAll.json).every(r=>r[o]===B.uid)&&ok2(bAll),`HTTP ${bAll.status} foreign rows=${rows(bAll.json).filter(r=>r[o]!==B.uid).length}`);
 // attacks are filtered by owner AND this run's marker: even on a broken backend they can only touch this run's test row
 const bPatch=await call('PATCH',rest(t)+`?${o}=eq.${A.uid}&${mk}`,{tok:B.tok,body:S.hijack,headers:{Prefer:'return=representation'}});
 const aAfter=await call('GET',rest(t)+`?${o}=eq.${A.uid}&${mk}&select=*`,{tok:A.tok});const intact=rows(aAfter.json).length>=1&&!/HIJACKED|hijacked/.test(aAfter.text);
 rec(`${t}.T5`,'B cannot modify A\'s row (0 rows affected) and A\'s data is unchanged',nothing(bPatch)&&intact,`patch HTTP ${bPatch.status} affected=${rows(bPatch.json).length} intact=${intact}`);
 const bDel=await call('DELETE',rest(t)+`?${o}=eq.${A.uid}&${mk}`,{tok:B.tok,headers:{Prefer:'return=representation'}});const aAfter2=await call('GET',rest(t)+`?${o}=eq.${A.uid}&${mk}&select=*`,{tok:A.tok});
 rec(`${t}.T6`,'B cannot delete A\'s row and the row still exists for A',nothing(bDel)&&rows(aAfter2.json).length>=1,`delete HTTP ${bDel.status} affected=${rows(bDel.json).length} stillThere=${rows(aAfter2.json).length}`);
 const bForge=await call('POST',rest(t),{tok:B.tok,body:{...mine(A),...(S.needsId?{id:crypto.randomUUID()}:{})},headers:{Prefer:'return=representation'}});rec(`${t}.T7`,'B cannot insert a row owned by A',denied(bForge)||bForge.status>=400,`HTTP ${bForge.status} ${bForge.text.slice(0,100)}`);
 const aForge=await call('POST',rest(t),{tok:A.tok,body:{...mine(B),...(S.needsId?{id:crypto.randomUUID()}:{})},headers:{Prefer:'return=representation'}});rec(`${t}.T8`,'A cannot insert a row owned by B (plain insert: can never overwrite)',denied(aForge)||aForge.status>=400,`HTTP ${aForge.status} ${aForge.text.slice(0,100)}`);
}
// ---- Storage (private bucket). Test objects live ONLY under <uid>/<run marker>/ and are deleted by exact path.
const pathA=`${A.uid}/${MARK}/a.txt`,pathB=`${B.uid}/${MARK}/b.txt`,planted=`${A.uid}/${MARK}/planted-by-b.txt`,payload='GaonGreen fictional rls test file';
const up=(tok,p)=>call('POST',`/storage/v1/object/${BUCKET}/${p}`,{tok,raw:payload,headers:{'Content-Type':'text/plain','x-upsert':'false'}});
const dlo=(tok,p)=>call('GET',`/storage/v1/object/authenticated/${BUCKET}/${p}`,{tok});
noteObjs('A.main',[pathA]);const upA=await up(A.tok,pathA);const aGet=await dlo(A.tok,pathA);
rec('storage.T0','positive control: A can upload to its own prefix and download it back',ok2(upA)&&aGet.status===200&&aGet.text===payload,`upload ${upA.status} download ${aGet.status}`);
if(ok2(upA)){
 const bGet=await dlo(B.tok,pathA);rec('storage.T1','B cannot download A\'s object (real 4xx refusal, content not disclosed)',refusedNoLeak(bGet,payload),`HTTP ${bGet.status}`);
 const anonGet=await call('GET',`/storage/v1/object/${BUCKET}/${pathA}`,{});const pubGet=await call('GET',`/storage/v1/object/public/${BUCKET}/${pathA}`,{});rec('storage.T2','anon cannot fetch A\'s object on the authenticated or the public route (real 4xx refusals, content not disclosed)',refusedNoLeak(anonGet,payload)&&refusedNoLeak(pubGet,payload),`anon ${anonGet.status} public ${pubGet.status}`);
 const bList=await call('POST',`/storage/v1/object/list/${BUCKET}`,{tok:B.tok,body:{prefix:A.uid+'/',limit:100}});rec('storage.T3','B cannot list objects under A\'s prefix',nothing(bList)||(ok2(bList)&&rows(bList.json).length===0),`HTTP ${bList.status} items=${rows(bList.json).length}`);
 noteObjs('A.planted-by-B',[planted]);const bUp=await up(B.tok,planted);rec('storage.T4','B cannot upload into A\'s prefix',bUp.status>=400||denied(bUp),`HTTP ${bUp.status} ${bUp.text.slice(0,90)}`);
 const bDel=await call('DELETE',`/storage/v1/object/${BUCKET}`,{tok:B.tok,body:{prefixes:[pathA]}});const aStill=await dlo(A.tok,pathA);rec('storage.T5','B cannot delete A\'s object; A can still download it',aStill.status===200&&aStill.text===payload,`delete HTTP ${bDel.status} A-download-after ${aStill.status}`);
 noteObjs('B.main',[pathB]);const bUpOwn=await up(B.tok,pathB);rec('storage.T6','positive control: B can upload to B\'s own prefix',ok2(bUpOwn),`HTTP ${bUpOwn.status}`);
 const aGetB=await dlo(A.tok,pathB);rec('storage.T7','A cannot download B\'s object (symmetry; real 4xx refusal, content not disclosed)',refusedNoLeak(aGetB,payload),`HTTP ${aGetB.status}`);
}
// ---- Optional server-side upload rules (off by default). CHECK_MIME=yes only AFTER the proposed allow-list (supabase/proposed/) has been applied to staging; CHECK_LIMITS=yes any time.
const upT=(tok,p,type,raw)=>call('POST',`/storage/v1/object/${BUCKET}/${p}`,{tok,raw,headers:{'Content-Type':type,'x-upsert':'false'}});
if(env.CHECK_MIME==='yes'){
 const OK=['application/pdf','image/png','image/jpeg','image/webp','text/csv','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain'];
 const BAD=['text/html','image/svg+xml','application/javascript','application/x-msdownload','application/octet-stream'];
 const mp=[...OK,...BAD].map((_,i)=>`${B.uid}/${MARK}/m-${i}.bin`);noteObjs('B.mime',mp);
 const okBad=[];for(const [i,ty] of OK.entries()){const r=await upT(B.tok,mp[i],ty,'x');if(!ok2(r))okBad.push(ty+':'+(r.status||'no response'))}
 rec('storage.M1','every type the app uploads ('+OK.length+') is ACCEPTED by the server allow-list',!okBad.length,okBad.join(' '));
 const badBad=[];for(const [i,ty] of BAD.entries()){const r=await upT(B.tok,mp[OK.length+i],ty,'x');if(!(r.status>=400))badBad.push(ty+':'+(ok2(r)?'accepted':'no response'))}
 rec('storage.M2','disallowed types ('+BAD.join(', ')+') are REJECTED',!badBad.length,badBad.join(' '));
}
if(env.CHECK_LIMITS==='yes'){
 const pth=`${B.uid}/${MARK}/big.txt`;noteObjs('B.big',[pth]);const r=await upT(B.tok,pth,'text/plain','x'.repeat(10*1024*1024+1));
 rec('storage.L1','an object of 10 MB + 1 byte is REJECTED server-side',r.status>=400,`HTTP ${r.status}`);
}
// ---- Token tampering: swap the subject of A's JWT to B's id but keep A's signature (read only)
{const [h,p,s]=A.tok.split('.');const pl=JSON.parse(Buffer.from(p,'base64url').toString());pl.sub=B.uid;const forged=[h,Buffer.from(JSON.stringify(pl)).toString('base64url'),s].join('.');
 const r=await call('GET',rest('company_profiles')+'?select=*',{tok:forged});rec('auth.T1','a JWT with a tampered subject (A\'s signature, B\'s id) is rejected',r.status===401||r.status===403||(r.json&&r.json.code==='PGRST301')||/jwt|signature/i.test(r.text),`HTTP ${r.status} ${r.text.slice(0,100)}`)}
}catch(e){rec('run.ERROR','the suite stopped unexpectedly; cleanup still ran',false,String(e&&e.name||'error'))}
finally{if(!stopping)await cleanup()}
if(!stopping)finish(0);
