// OFFLINE ONLY. Tests the CLEANUP SAFETY of tests/rls/rls-isolation.mjs against the local loopback mock (127.0.0.1). Never contacts a non-loopback host.
// Proves: pre-existing data is never written, overwritten or deleted (byte-identical after the run); only THIS run's marker is deleted;
// earlier runs' rows are left untouched; a lost insert response, a network outage and SIGTERM still end with no test data left;
// a silently failing delete is REPORTED (not assumed); results and logs carry no seeded content or passwords;
// a storage upload whose response is lost is still removed (C11); real data that appears AFTER pre-flight is never overwritten (C12);
// no HTTP response, a 5xx, or a refusal that discloses the content is never a PASS (C14-C16); the suite sends no upsert at all (C17).
const fs=require('fs'),os=require('os'),path=require('path'),crypto=require('crypto'),{spawn}=require('child_process');
const T=require('./lib/t.js'),M=require('./rls/mock-supabase.js');const t=T.make();
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'rls-cleanup-'));
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',C='33333333-3333-4333-8333-333333333333';
const TABLES={company_profiles:'owner_id',kissb_drafts:'user_id',kre100_drafts:'owner_id',epr_drafts:'owner_id',supplier_esg_drafts:'owner_id',qr_esg_drafts:'user_id',evidence_documents:'user_id'};
const realRow=(t,o,uid,tag)=>t==='company_profiles'?{[o]:uid,company_name:'Example Exporter '+tag,country:'KR',industry:'Manufacturing',currency:'USD',expenses:[]}
 :t==='kissb_drafts'?{[o]:uid,payload:{name:'Example Exporter '+tag,elec:1000}}
 :t==='qr_esg_drafts'?{[o]:uid,draft:{name:'Example Exporter '+tag}}
 :t==='evidence_documents'?{id:'doc-'+tag+'-1',[o]:uid,storage_path:uid+'/doc-'+tag+'-1/v4-test.pdf',company:'Example Exporter '+tag,title:'Bill Oct '+tag,category:'corporate',year:2026,review_status:'pending',notes:'',filename:'v4-test.pdf',size_bytes:7}
 :{[o]:uid,draft_data:{name:'Example Exporter '+tag,value:250}};
const seedFor=(owners,only)=>{const tables={},objects={};for(const [t,o] of Object.entries(TABLES)){if(only&&!only.includes(t))continue;tables[t]=owners.map(([uid,tag])=>realRow(t,o,uid,tag))}
 for(const [uid,tag] of owners)objects['evidence-locker/'+uid+'/doc-'+tag+'-1/v4-test.pdf']='%PDF-'+tag;return{tables,objects}};
const sha=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
// the seeded rows/objects must be present and byte-identical; anything else left over = test data not cleaned
const compare=(seed,after)=>{const extra=[],changed=[];for(const t of new Set([...Object.keys(seed.tables),...Object.keys(after.tables)])){const s=seed.tables[t]||[],a=after.tables[t]||[];
  for(const r of s)if(!a.some(x=>JSON.stringify(x)===JSON.stringify(r)))changed.push(t);for(const r of a)if(!s.some(x=>JSON.stringify(x)===JSON.stringify(r)))extra.push(t)}
 for(const k of Object.keys(seed.objects))if(after.objects[k]!==seed.objects[k])changed.push('obj');for(const k of Object.keys(after.objects))if(!(k in seed.objects))extra.push('obj');
 const seededAfter={tables:Object.fromEntries(Object.entries(after.tables).map(([t,rs])=>[t,rs.filter(r=>(seed.tables[t]||[]).some(x=>JSON.stringify(x)===JSON.stringify(r)))]).filter(([t])=>t in seed.tables)),objects:Object.fromEntries(Object.entries(after.objects).filter(([k])=>k in seed.objects))};
 return{identical:!changed.length&&sha(seededAfter)===sha(seed),changed,leftovers:extra,seedSha:sha(seed).slice(0,16),afterSha:sha(seededAfter).slice(0,16)}};
const env=(m,out,extra)=>({PATH:process.env.PATH,ALLOW_STAGING:'yes',STAGING_URL:m.url,STAGING_KEY:'sb_publishable_mock',A_EMAIL:'a@example.com',A_PASSWORD:'pa',B_EMAIL:'b@example.com',B_PASSWORD:'pb',OUT:out,RLS_REQUEST_TIMEOUT_MS:'3000',CHECK_MIME:'yes',CHECK_LIMITS:'yes',...extra});
let n=0;
const run=async(mode,opts={},extra,onChild)=>{const writes=[];const m=await M.start(mode,{...opts,onWrite:i=>{writes.push(i);opts.onWrite&&opts.onWrite(i)}});
 if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(m.url)){m.close();throw new Error('refusing: mock URL is not loopback')}
 const out=path.join(tmp,'r'+(++n)+'.json');let so='',se='';
 const status=await new Promise(res=>{const c=spawn('node',['tests/rls/rls-isolation.mjs'],{env:env(m,out,extra),stdio:['ignore','pipe','pipe']});const k=setTimeout(()=>c.kill('SIGKILL'),120000);
  c.stdout.on('data',d=>so+=d);c.stderr.on('data',d=>se+=d);onChild&&onChild(c);c.on('close',(code,sig)=>{clearTimeout(k);res(code===null?sig:code)})});
 const after=m.dump();m.close();let j=null;try{j=JSON.parse(fs.readFileSync(out,'utf8'))}catch{}
 const res=j?j.results:[];const by=s=>res.filter(x=>x.status===s).map(x=>x.id);
 return{status,after,j,res,fails:by('FAIL'),blocked:by('BLOCKED'),cleanup:res.filter(x=>x.id.startsWith('cleanup.')),writes,log:so+se,raw:fs.existsSync(out)?fs.readFileSync(out,'utf8'):''}};
const EMPTY={tables:{},objects:{}};
const allEmpty=d=>Object.values(d.tables).every(a=>a.length===0)&&Object.keys(d.objects).length===0;
(async()=>{
 // C1: real data for A and B in all 7 tables -> all 7 BLOCKED, zero table writes, seeded data byte-identical, no test object left
 const s1=seedFor([[A,'A'],[B,'B']]);const r1=await run('allowlist',{seed:s1});const c1=compare(s1,r1.after);
 await t.check('C1','A and B already have data in all 7 tables: pre-flight BLOCKS all 7 (exit 5, no FAIL), zero writes to any table, seeded rows and objects byte-identical, no test object left',async()=>({ok:r1.status===5&&r1.blocked.length===7&&r1.fails.length===0&&r1.writes.filter(w=>w.t).length===0&&c1.identical&&c1.leftovers.length===0,expected:'exit 5, 7 BLOCKED, 0 table writes, identical, 0 leftovers',actual:JSON.stringify({exit:r1.status,blocked:r1.blocked.length,fails:r1.fails,tableWrites:r1.writes.filter(w=>w.t).length,...c1})}));
 // C2: only A's company profile exists -> only company_profiles BLOCKED; the other 6 tables are fully tested and cleaned
 const s2=seedFor([[A,'A']],['company_profiles']);const r2=await run('allowlist',{seed:s2});const c2=compare(s2,r2.after);
 await t.check('C2','only A\'s company profile exists: only company_profiles is BLOCKED, the other 6 tables are tested and cleaned; the profile is byte-identical',async()=>({ok:r2.status===5&&JSON.stringify(r2.blocked)==='["company_profiles.BLOCKED"]'&&r2.fails.length===0&&c2.identical&&c2.leftovers.length===0&&r2.cleanup.length>=12&&r2.cleanup.every(x=>x.status==='PASS'),expected:'1 BLOCKED, rest PASS, identical, 0 leftovers',actual:JSON.stringify({exit:r2.status,blocked:r2.blocked,fails:r2.fails,cleanup:r2.cleanup.length,...c2})}));
 // C3: a leftover row of an EARLIER run (different marker) -> it blocks its table and is NOT deleted
 const old={tables:{kissb_drafts:[{user_id:B,payload:{gg_rls_run:'20260101000000-deadbeef'}}]},objects:{}};const r3=await run('allowlist',{seed:old});const c3=compare(old,r3.after);
 await t.check('C3','a row left by an EARLIER test run is never deleted: its table is BLOCKED (reported as an earlier run) and the row is byte-identical afterwards',async()=>({ok:r3.status===5&&JSON.stringify(r3.blocked)==='["kissb_drafts.BLOCKED"]'&&/earlier test run/.test(JSON.stringify(r3.res.find(x=>x.id==='kissb_drafts.BLOCKED')))&&c3.identical&&c3.leftovers.length===0,expected:'kissb BLOCKED, old row kept',actual:JSON.stringify({exit:r3.status,blocked:r3.blocked,...c3})}));
 // C4: empty backend -> everything passes and nothing is left
 const r4=await run('allowlist',{});
 await t.check('C4','empty backend: exit 0, every cleanup check PASSES (rows for A and B in 7 tables + objects), and the backend is empty afterwards',async()=>({ok:r4.status===0&&r4.fails.length===0&&r4.blocked.length===0&&r4.cleanup.length>=18&&r4.cleanup.every(x=>x.status==='PASS')&&allEmpty(r4.after),expected:'exit 0, cleanup PASS, empty',actual:JSON.stringify({exit:r4.status,fails:r4.fails,cleanup:r4.cleanup.length,empty:allEmpty(r4.after)})}));
 // C5: broken backend (UPDATE/DELETE ignore ownership) + a third user's real rows -> attacks hit only this run's marker; third-party data byte-identical
 const s5=seedFor([[C,'C']]);const r5=await run('leaky-write',{seed:s5});const c5=compare(s5,r5.after);
 await t.check('C5','backend where UPDATE/DELETE ignore ownership, with a third user\'s real data present: T5/T6 are flagged, yet the third user\'s rows are byte-identical (attacks and cleanup are filtered by this run\'s marker) and no test row is left',async()=>({ok:r5.status===1&&r5.fails.some(i=>i.endsWith('.T5'))&&r5.fails.some(i=>i.endsWith('.T6'))&&c5.identical&&c5.leftovers.length===0,expected:'exit 1, T5/T6 FAIL, identical, 0 leftovers',actual:JSON.stringify({exit:r5.status,t5t6:r5.fails.filter(i=>/T[56]$/.test(i)).length,...c5})}));
 // C6: the first insert is APPLIED but its response is lost -> T0 fails for that table, yet the row is found by its marker and deleted
 const r6=await run('allowlist',{dropResponseOnWrite:1});
 await t.check('C6','insert succeeds on the server but the response is lost: the suite reports T0 FAIL for that table, and cleanup still finds the row by its run marker, deletes it and verifies it is gone',async()=>({ok:r6.status===1&&r6.fails.includes('company_profiles.T0')&&r6.writes.some(w=>w.t==='company_profiles')&&(r6.cleanup.find(x=>x.id==='cleanup.company_profiles.A')||{}).status==='PASS'&&allEmpty(r6.after),expected:'T0 FAIL, row written then cleaned, empty',actual:JSON.stringify({exit:r6.status,t0:r6.fails.includes('company_profiles.T0'),written:r6.writes.filter(w=>w.t==='company_profiles').length,cleanupA:(r6.cleanup.find(x=>x.id==='cleanup.company_profiles.A')||{}).status,empty:allEmpty(r6.after)})}));
 // C7: network outage in the middle of the run -> requests fail, but cleanup (with retries) leaves nothing behind
 const r7=await run('allowlist',{outage:{after:30,count:8}});
 await t.check('C7','network outage mid-run (8 requests dropped): affected checks fail, cleanup retries, every cleanup check PASSES and nothing is left',async()=>({ok:r7.status===1&&r7.cleanup.length>0&&r7.cleanup.every(x=>x.status==='PASS')&&allEmpty(r7.after),expected:'exit 1, cleanup PASS, empty',actual:JSON.stringify({exit:r7.status,fails:r7.fails.length,cleanupFail:r7.cleanup.filter(x=>x.status!=='PASS').map(x=>x.id),empty:allEmpty(r7.after)})}));
 // C8: delete silently does nothing -> verification catches it and the run FAILS (never a silent success)
 const r8=await run('allowlist',{denyDelete:true});
 await t.check('C8','a delete that answers 200 but removes nothing is DETECTED: cleanup checks FAIL with remaining>0 and the run exits 1',async()=>({ok:r8.status===1&&r8.cleanup.some(x=>x.status==='FAIL'&&/remaining=[1-9]/.test(x.detail))&&r8.cleanup.some(x=>x.id.startsWith('cleanup.storage')&&x.status==='FAIL'),expected:'cleanup FAIL reported',actual:JSON.stringify({exit:r8.status,cleanupFail:r8.cleanup.filter(x=>x.status==='FAIL').length})}));
 // C9: SIGTERM right after the first write -> cleanup runs in the signal handler, exit 130, nothing left, result file written
 let child=null,sent=false;const r9=await run('allowlist',{onWrite:()=>{if(!sent&&child){sent=true;child.kill('SIGTERM')}}},{},c=>{child=c});
 await t.check('C9','SIGTERM right after the first write: the run stops, cleanup runs, exit 130, run.INTERRUPTED is recorded, every cleanup check PASSES and nothing is left',async()=>({ok:sent&&r9.status===130&&r9.res.some(x=>x.id==='run.INTERRUPTED')&&r9.cleanup.length>0&&r9.cleanup.every(x=>x.status==='PASS')&&allEmpty(r9.after),expected:'exit 130, cleanup PASS, empty',actual:JSON.stringify({sent,exit:r9.status,interrupted:r9.res.some(x=>x.id==='run.INTERRUPTED'),cleanup:r9.cleanup.length,empty:allEmpty(r9.after)})}));
 // C11: a storage upload is STORED but its response is lost -> storage.T0 fails, yet cleanup deletes the object by its exact path and verifies it is gone
 const r11=await run('allowlist',{dropUploadResponse:1});
 await t.check('C11','storage upload stored on the server but its response is lost: storage.T0 FAILS, and cleanup still deletes the object by its exact registered path and verifies it is gone',async()=>({ok:r11.status===1&&r11.fails.includes('storage.T0')&&r11.writes.some(w=>w.object)&&(r11.cleanup.find(x=>x.id==='cleanup.storage.A.main')||{}).status==='PASS'&&allEmpty(r11.after),expected:'T0 FAIL, object cleaned, empty',actual:JSON.stringify({exit:r11.status,t0:r11.fails.includes('storage.T0'),uploaded:r11.writes.filter(w=>w.object).length,cleanupA:(r11.cleanup.find(x=>x.id==='cleanup.storage.A.main')||{}).status,empty:allEmpty(r11.after)})}));
 // C12: real data appears AFTER pre-flight (someone uses the app mid-run) with a unique-owner constraint like production -> the plain INSERT is rejected, the row is never overwritten
 const live12=realRow('company_profiles','owner_id',A,'A');const r12=await run('allowlist',{uniqueOwner:true,injectAfterGets:{n:14,t:'company_profiles',row:live12}});const c12=compare({tables:{company_profiles:[live12]},objects:{}},r12.after);
 await t.check('C12','real company row appears AFTER pre-flight: T0 uses a plain INSERT (no upsert), the server rejects it (409), and the real row is byte-identical afterwards; no test row left',async()=>({ok:r12.status===1&&r12.fails.includes('company_profiles.T0')&&c12.identical&&c12.leftovers.length===0,expected:'T0 FAIL (409), row identical, 0 leftovers',actual:JSON.stringify({exit:r12.status,t0:r12.fails.includes('company_profiles.T0'),detail:((r12.res.find(x=>x.id==='company_profiles.T0')||{}).detail||'').slice(0,40),...c12})}));
 // C13: with the unique-owner constraint on, a clean run still passes (plain inserts are sufficient)
 const r13=await run('allowlist',{uniqueOwner:true});
 await t.check('C13','unique-owner constraint on, empty backend: exit 0, all cleanup PASSES, backend empty (plain inserts are sufficient)',async()=>({ok:r13.status===0&&r13.fails.length===0&&r13.cleanup.every(x=>x.status==='PASS')&&allEmpty(r13.after),expected:'exit 0, empty',actual:JSON.stringify({exit:r13.status,fails:r13.fails,empty:allEmpty(r13.after)})}));

 // C14: no HTTP response must never count as a PASS: the 10 requests after A's first upload get no response at all
 const r14=await run('allowlist',{blackoutAfterUpload:10});const st14=r14.res.filter(x=>/^storage\.T[1-7]$/.test(x.id));
 await t.check('C14','network failure is never a PASS: when the storage checks get NO HTTP response, every one of storage.T1-T7 that ran is FAIL (none PASS), the run exits 1, and cleanup still leaves nothing',async()=>({ok:r14.status===1&&st14.length>=5&&st14.every(x=>x.status==='FAIL')&&r14.cleanup.every(x=>x.status==='PASS')&&allEmpty(r14.after),expected:'all storage.T1-T7 FAIL, empty',actual:JSON.stringify({exit:r14.status,storage:st14.map(x=>x.id+':'+x.status),empty:allEmpty(r14.after)})}));

 // C15/C16: cross-account storage reads must be a real 4xx refusal with no disclosed content; these run the PRODUCTION suite file (tests/rls/rls-isolation.mjs) unchanged
 const cross=r=>r.res.filter(x=>['storage.T1','storage.T2','storage.T7'].includes(x.id));
 const r15=await run('allowlist',{crossStorageStatus:500});const x15=cross(r15);
 await t.check('C15','cross-account reads answered with HTTP 500 (no refusal, no data): storage.T1, T2 and T7 all FAIL - a server error is not proof of isolation',async()=>({ok:x15.length===3&&x15.every(x=>x.status==='FAIL')&&r15.status===1&&allEmpty(r15.after),expected:'T1,T2,T7 FAIL',actual:JSON.stringify({exit:r15.status,checks:x15.map(x=>x.id+':'+x.status)})}));
 const r16=await run('allowlist',{crossStorageEcho:true});const x16=cross(r16);
 await t.check('C16','cross-account reads answered 403 but the body CONTAINS the protected file: storage.T1, T2 and T7 all FAIL (content disclosure is detected, not just the status)',async()=>({ok:x16.length===3&&x16.every(x=>x.status==='FAIL')&&r16.status===1&&allEmpty(r16.after),expected:'T1,T2,T7 FAIL',actual:JSON.stringify({exit:r16.status,checks:x16.map(x=>x.id+':'+x.status)})}));
 // C17: no request the suite sends carries upsert semantics (no on_conflict, no merge-duplicates, no x-upsert:true); proven on the wire, not by reading the source
 const reqs=[];const r17=await run('allowlist',{onRequest:i=>reqs.push(i)});
 const restPosts=reqs.filter(i=>i.method==='POST'&&i.path.startsWith('/rest/v1/')),upsertish=reqs.filter(i=>/on_conflict/.test(i.query)||/merge-duplicates|ignore-duplicates/.test(i.prefer)||/true/i.test(i.xUpsert));
 await t.check('C17','on the wire: the suite sends no upsert at all - 0 requests with on_conflict, merge-duplicates or x-upsert:true (out of all REST inserts and storage uploads), and the run passes',async()=>({ok:r17.status===0&&restPosts.length>=20&&upsertish.length===0,expected:'0 upsert-like requests',actual:JSON.stringify({exit:r17.status,restInserts:restPosts.length,uploads:reqs.filter(i=>i.method==='POST'&&i.path.startsWith('/storage/v1/object/')&&!i.path.includes('/list/')).length,upsertLike:upsertish.length})}));

 // C10: results/logs never carry seeded content or passwords
 const leak=[r1,r2,r3,r5,r12].some(r=>/Example Exporter|Bill Oct|%PDF-/.test(r.raw+r.log))||[r1,r2,r3,r4,r5,r6,r7,r8,r9,r11,r12,r13,r14,r15,r16,r17].some(r=>/"pa"|"pb"|\bpa\b.*password|eyJ[\w-]{10,}\./.test(r.raw+r.log));
 await t.check('C10','result files and logs contain no seeded business content and no passwords or tokens (only counts are reported)',async()=>({ok:!leak,expected:'clean',actual:leak?'leak found':'clean'}));
 fs.writeFileSync(process.argv[2]||'rls-cleanup-harness.json',JSON.stringify({run:new Date().toISOString(),build:'RLS suite cleanup safety vs LOCAL LOOPBACK MOCK ONLY - not a real Supabase project',results:t.res},null,1));
 try{fs.rmSync(tmp,{recursive:true,force:true})}catch{}
 process.exit(t.res.some(r=>r.status!=='PASS')?1:0)})().catch(e=>{console.error(e);process.exit(1)});
