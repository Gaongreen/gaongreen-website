// GaonGreen RLS / storage ISOLATION CHECKS - for an AUTHORIZED STAGING project with two FICTIONAL accounts. Node >= 20, no dependencies (plain fetch).
// STATUS: DRAFT. Has NOT been run against a real Supabase project by its author. Request shapes follow Supabase PostgREST/Auth/Storage REST conventions and must be
// confirmed on the first staging run. A PASS here means "these specific checks passed on that project at that time" - not "RLS is secure".
//
// Required env:  STAGING_URL  STAGING_KEY (publishable key of STAGING)  A_EMAIL A_PASSWORD B_EMAIL B_PASSWORD  ALLOW_STAGING=yes
// Optional env:  CHECK_MIME=yes (after the allow-list is applied)  CHECK_LIMITS=yes  PRODUCTION_HOSTS (comma list, extra hosts to refuse)  OUT (result json path)  BUCKET (default evidence-locker)
// Exit codes: 0 all checks passed, 1 at least one check failed, 2 refused to run (guard) or setup failed.
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
const hdr=(tok,extra)=>({apikey:KEY,Authorization:'Bearer '+(tok||KEY),'Content-Type':'application/json',...extra});
const call=async(method,path,{tok,body,headers,raw}={})=>{const r=await fetch(root+path,{method,headers:hdr(tok,headers),body:raw??(body===undefined?undefined:JSON.stringify(body))});const text=await r.text();let json;try{json=JSON.parse(text)}catch{}return{status:r.status,json,text}};
const signIn=async(email,password)=>{const r=await call('POST','/auth/v1/token?grant_type=password',{body:{email,password}});if(r.status!==200||!r.json?.access_token)refuse(`sign-in failed for ${email} (HTTP ${r.status}). Create the fictional staging accounts first.`);const uid=r.json.user?.id||JSON.parse(Buffer.from(r.json.access_token.split('.')[1],'base64url').toString()).sub;return{tok:r.json.access_token,uid}};
const A=await signIn(env.A_EMAIL,env.A_PASSWORD),B=await signIn(env.B_EMAIL,env.B_PASSWORD);
if(A.uid===B.uid)refuse('A and B resolved to the same user id');
console.log(`Running against STAGING host ${base.host} with fictional accounts. A=${A.uid.slice(0,8)}.. B=${B.uid.slice(0,8)}..`);
const MARK='gg-rls-test';
const rows=a=>Array.isArray(a)?a:[];
const denied=r=>r.status===401||r.status===403||(r.json&&(r.json.code==='42501'||/row-level security|permission denied|not authorized|unauthorized/i.test(r.text)));
const nothing=r=>(r.status>=200&&r.status<300&&rows(r.json).length===0)||denied(r);
// table specs: owner column + payload shaped like the pages write
const TABLES=[
 {t:'company_profiles',o:'owner_id',data:{company_name:MARK,country:'KR',industry:'test',currency:'KRW',expenses:[]},key:'owner_id'},
 {t:'kissb_drafts',o:'user_id',data:{payload:{[MARK]:true}},key:'user_id'},
 {t:'kre100_drafts',o:'owner_id',data:{draft_data:{[MARK]:true}},key:'owner_id'},
 {t:'epr_drafts',o:'owner_id',data:{draft_data:{[MARK]:true}},key:'owner_id'},
 {t:'supplier_esg_drafts',o:'owner_id',data:{draft_data:{[MARK]:true}},key:'owner_id'},
 {t:'qr_esg_drafts',o:'user_id',data:{draft:{[MARK]:true}},key:'user_id'},
 {t:'evidence_documents',o:'user_id',data:{company:MARK,title:MARK,category:'corporate',year:2026,review_status:'pending',notes:'',filename:'gg-rls-test.txt',size_bytes:1},key:'id',needsId:true},
];
const rest=(t)=>'/rest/v1/'+t;
for(const S of TABLES){const {t,o}=S;const idA=crypto.randomUUID();const mine=(u)=>({...S.data,[o]:u.uid,...(S.needsId?{id:crypto.randomUUID(),storage_path:u.uid+'/x/'+MARK}:{})});
 const ins=await call('POST',rest(t)+(S.needsId?'':`?on_conflict=${S.key}`),{tok:A.tok,body:mine(A),headers:{Prefer:'return=representation,resolution=merge-duplicates'}});
 const created=ins.status>=200&&ins.status<300&&rows(ins.json).length===1;
 rec(`${t}.T0`,'positive control: A can insert and read back its own row',created&&rows((await call('GET',rest(t)+`?${o}=eq.${A.uid}&select=*`,{tok:A.tok})).json).length>=1,`insert HTTP ${ins.status} ${ins.text.slice(0,120)}`);
 if(!created){rec(`${t}.SKIP`,'remaining checks for this table are not meaningful without T0',false,'T0 failed - schema/policy mismatch or column names differ');continue}
 const aRow=rows(ins.json)[0];const aId=aRow.id??null;
 const anonSel=await call('GET',rest(t)+`?${o}=eq.${A.uid}&select=*`,{});rec(`${t}.T1`,'anon (no login) cannot read A\'s row',nothing(anonSel),`HTTP ${anonSel.status} ${anonSel.text.slice(0,100)}`);
 const anonIns=await call('POST',rest(t),{body:mine(A),headers:{Prefer:'return=minimal'}});rec(`${t}.T2`,'anon cannot insert',denied(anonIns)||anonIns.status>=400,`HTTP ${anonIns.status}`);
 const bSel=await call('GET',rest(t)+`?${o}=eq.${A.uid}&select=*`,{tok:B.tok});rec(`${t}.T3`,'B cannot read A\'s row by owner filter',nothing(bSel),`HTTP ${bSel.status} rows=${rows(bSel.json).length}`);
 const bAll=await call('GET',rest(t)+'?select=*',{tok:B.tok});rec(`${t}.T4`,'B\'s unfiltered read returns only B-owned rows',bAll.status<300&&rows(bAll.json).every(r=>r[o]===B.uid),`HTTP ${bAll.status} foreign rows=${rows(bAll.json).filter(r=>r[o]!==B.uid).length}`);
 const bPatch=await call('PATCH',rest(t)+`?${o}=eq.${A.uid}`,{tok:B.tok,body:{...(S.data.company_name?{company_name:'HIJACKED'}:{}),...(S.data.title?{title:'HIJACKED'}:{}),...(S.data.payload?{payload:{hijacked:true}}:{}),...(S.data.draft_data?{draft_data:{hijacked:true}}:{}),...(S.data.draft?{draft:{hijacked:true}}:{})},headers:{Prefer:'return=representation'}});
 const aAfter=await call('GET',rest(t)+`?${o}=eq.${A.uid}&select=*`,{tok:A.tok});const intact=rows(aAfter.json).length>=1&&!/HIJACKED|hijacked/.test(aAfter.text);
 rec(`${t}.T5`,'B cannot modify A\'s row (0 rows affected) and A\'s data is unchanged',nothing(bPatch)&&intact,`patch HTTP ${bPatch.status} affected=${rows(bPatch.json).length} intact=${intact}`);
 const bDel=await call('DELETE',rest(t)+`?${o}=eq.${A.uid}`,{tok:B.tok,headers:{Prefer:'return=representation'}});const aAfter2=await call('GET',rest(t)+`?${o}=eq.${A.uid}&select=*`,{tok:A.tok});
 rec(`${t}.T6`,'B cannot delete A\'s row and the row still exists for A',nothing(bDel)&&rows(aAfter2.json).length>=1,`delete HTTP ${bDel.status} affected=${rows(bDel.json).length} stillThere=${rows(aAfter2.json).length}`);
 const bForge=await call('POST',rest(t),{tok:B.tok,body:{...mine(A),...(S.needsId?{id:crypto.randomUUID()}:{})},headers:{Prefer:'return=representation'}});rec(`${t}.T7`,'B cannot insert a row owned by A',denied(bForge)||bForge.status>=400,`HTTP ${bForge.status} ${bForge.text.slice(0,100)}`);
 const aForge=await call('POST',rest(t)+(S.needsId?'':`?on_conflict=${S.key}`),{tok:A.tok,body:{...mine(B),...(S.needsId?{id:crypto.randomUUID()}:{})},headers:{Prefer:'return=representation,resolution=merge-duplicates'}});rec(`${t}.T8`,'A cannot insert or upsert a row owned by B',denied(aForge)||aForge.status>=400,`HTTP ${aForge.status} ${aForge.text.slice(0,100)}`);
 // cleanup: each user deletes only their own test rows
 await call('DELETE',rest(t)+`?${o}=eq.${A.uid}`,{tok:A.tok});await call('DELETE',rest(t)+`?${o}=eq.${B.uid}`,{tok:B.tok});
}
// ---- Storage (private bucket, path convention <uid>/<docid>/<file>)
const pathA=`${A.uid}/${crypto.randomUUID()}/${MARK}.txt`,pathB=`${B.uid}/${crypto.randomUUID()}/${MARK}.txt`,payload='GaonGreen fictional rls test file';
const up=(tok,p)=>call('POST',`/storage/v1/object/${BUCKET}/${p}`,{tok,raw:payload,headers:{'Content-Type':'text/plain','x-upsert':'false'}});
const dlo=(tok,p)=>call('GET',`/storage/v1/object/authenticated/${BUCKET}/${p}`,{tok});
const upA=await up(A.tok,pathA);const aGet=await dlo(A.tok,pathA);
rec('storage.T0','positive control: A can upload to its own prefix and download it back',upA.status<300&&aGet.status===200&&aGet.text===payload,`upload ${upA.status} download ${aGet.status}`);
if(upA.status<300){
 const bGet=await dlo(B.tok,pathA);rec('storage.T1','B cannot download A\'s object',bGet.status!==200&&bGet.text!==payload,`HTTP ${bGet.status}`);
 const anonGet=await call('GET',`/storage/v1/object/${BUCKET}/${pathA}`,{});const pubGet=await call('GET',`/storage/v1/object/public/${BUCKET}/${pathA}`,{});rec('storage.T2','anon cannot fetch A\'s object (authenticated route or public route)',anonGet.text!==payload&&pubGet.text!==payload&&anonGet.status!==200&&pubGet.status!==200,`anon ${anonGet.status} public ${pubGet.status}`);
 const bList=await call('POST',`/storage/v1/object/list/${BUCKET}`,{tok:B.tok,body:{prefix:A.uid+'/',limit:100}});rec('storage.T3','B cannot list objects under A\'s prefix',nothing(bList)||(bList.status<300&&rows(bList.json).length===0),`HTTP ${bList.status} items=${rows(bList.json).length}`);
 const bUp=await up(B.tok,`${A.uid}/${crypto.randomUUID()}/${MARK}-planted.txt`);rec('storage.T4','B cannot upload into A\'s prefix',bUp.status>=400||denied(bUp),`HTTP ${bUp.status} ${bUp.text.slice(0,90)}`);
 const bDel=await call('DELETE',`/storage/v1/object/${BUCKET}`,{tok:B.tok,body:{prefixes:[pathA]}});const aStill=await dlo(A.tok,pathA);rec('storage.T5','B cannot delete A\'s object; A can still download it',aStill.status===200&&aStill.text===payload,`delete HTTP ${bDel.status} A-download-after ${aStill.status}`);
 const bUpOwn=await up(B.tok,pathB);rec('storage.T6','positive control: B can upload to B\'s own prefix',bUpOwn.status<300,`HTTP ${bUpOwn.status}`);
 const aGetB=await dlo(A.tok,pathB);rec('storage.T7','A cannot download B\'s object (symmetry)',aGetB.status!==200&&aGetB.text!==payload,`HTTP ${aGetB.status}`);
}
await call('DELETE',`/storage/v1/object/${BUCKET}`,{tok:A.tok,body:{prefixes:[pathA]}});await call('DELETE',`/storage/v1/object/${BUCKET}`,{tok:B.tok,body:{prefixes:[pathB]}});
// ---- Optional server-side upload rules (off by default). CHECK_MIME=yes only AFTER the proposed allow-list (supabase/proposed/) has been applied to staging; CHECK_LIMITS=yes any time.
const upT=(tok,p,type,raw)=>call('POST',`/storage/v1/object/${BUCKET}/${p}`,{tok,raw,headers:{'Content-Type':type,'x-upsert':'false'}});
if(env.CHECK_MIME==='yes'){
 const OK=['application/pdf','image/png','image/jpeg','image/webp','text/csv','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain'];
 const BAD=['text/html','image/svg+xml','application/javascript','application/x-msdownload','application/octet-stream'];const made=[];
 const okBad=[];for(const ty of OK){const pth=`${B.uid}/${crypto.randomUUID()}/${MARK}-m.bin`;const r=await upT(B.tok,pth,ty,'x');if(r.status<300)made.push(pth);else okBad.push(ty+':'+r.status)}
 rec('storage.M1','every type the app uploads ('+OK.length+') is ACCEPTED by the server allow-list',!okBad.length,okBad.join(' '));
 const badBad=[];for(const ty of BAD){const pth=`${B.uid}/${crypto.randomUUID()}/${MARK}-m.bin`;const r=await upT(B.tok,pth,ty,'x');if(r.status<300){made.push(pth);badBad.push(ty+':accepted')}}
 rec('storage.M2','disallowed types ('+BAD.join(', ')+') are REJECTED',!badBad.length,badBad.join(' '));
 if(made.length)await call('DELETE',`/storage/v1/object/${BUCKET}`,{tok:B.tok,body:{prefixes:made}});
}
if(env.CHECK_LIMITS==='yes'){
 const pth=`${B.uid}/${crypto.randomUUID()}/${MARK}-big.txt`;const r=await upT(B.tok,pth,'text/plain','x'.repeat(10*1024*1024+1));
 rec('storage.L1','an object of 10 MB + 1 byte is REJECTED server-side',r.status>=400,`HTTP ${r.status}`);if(r.status<300)await call('DELETE',`/storage/v1/object/${BUCKET}`,{tok:B.tok,body:{prefixes:[pth]}});
}
// ---- Token tampering: swap the subject of A's JWT to B's id but keep A's signature
{const [h,p,s]=A.tok.split('.');const pl=JSON.parse(Buffer.from(p,'base64url').toString());pl.sub=B.uid;const forged=[h,Buffer.from(JSON.stringify(pl)).toString('base64url'),s].join('.');
 const r=await call('GET',rest('company_profiles')+'?select=*',{tok:forged});rec('auth.T1','a JWT with a tampered subject (A\'s signature, B\'s id) is rejected',r.status===401||r.status===403||(r.json&&r.json.code==='PGRST301')||/jwt|signature/i.test(r.text),`HTTP ${r.status} ${r.text.slice(0,100)}`)}
const fails=results.filter(r=>r.status==='FAIL').length;
const report={ranAt:new Date().toISOString(),target:base.host,note:'DRAFT suite; checks only what is listed; not a proof of security',total:results.length,failed:fails,results};
let outErr=null;if(env.OUT){try{fs.writeFileSync(env.OUT,JSON.stringify(report,null,1))}catch(e){outErr=e}}
console.log(`\n${results.length-fails}/${results.length} passed against ${base.host}`);
// exit codes: 0 all passed, 1 a check failed (isolation gap), 2 refused by a guard, 3 results could not be written (NOT an isolation result)
if(outErr){console.error('RESULT-FILE-ERROR: could not write OUT ('+(outErr.code||outErr.name)+'); check outcome was '+(fails?'FAILED':'PASSED')+' but is unrecorded');process.exit(3)}
process.exit(fails?1:0);
