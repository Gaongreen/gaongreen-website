// OFFLINE ONLY. Tests the RLS SUITE ITSELF against a local loopback mock (127.0.0.1): it must PASS everything on a correctly isolated mock
// and FAIL the expected checks on each deliberately leaky mock. This validates test logic only. It is NOT an RLS verification of any real Supabase project.
// The real-staging run is a separate, manual step: tests/rls/rls-isolation.mjs (see docs/RLS_STAGING_RUNBOOK.md). This file never contacts a non-loopback host.
const fs=require('fs'),os=require('os'),path=require('path'),T=require('./lib/t.js'),M=require('./rls/mock-supabase.js'),P=require('./lib/proc.js');const t=T.make();
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'rls-harness-'));
const SECRETS=['pa','pb'];
// Minimal child env: nothing from the caller's environment (no real STAGING_*, keys or hosts can leak in).
const childEnv=(m,out,extra)=>({PATH:process.env.PATH,ALLOW_STAGING:'yes',STAGING_URL:m.url,STAGING_KEY:'sb_publishable_mock',A_EMAIL:'a@example.com',A_PASSWORD:'pa',B_EMAIL:'b@example.com',B_PASSWORD:'pb',OUT:out,...extra});
const runSuite=async(mode,extra)=>{const m=await M.start(mode);
 if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(m.url)){m.close();throw new Error('refusing: mock URL is not loopback: '+m.url)}
 const out=path.join(tmp,'rls-'+mode+(extra?'-x':'')+'.json');
 const r=await P.run('node',['tests/rls/rls-isolation.mjs'],{env:childEnv(m,out,extra),secrets:SECRETS,timeoutMs:90000});m.close();
 let j=null,readErr=null;try{j=JSON.parse(fs.readFileSync(out,'utf8'))}catch(e){readErr=e.code||e.message}
 const results=j?j.results:[];
 return{...r,mode,results,readErr,failedIds:results.filter(x=>x.status==='FAIL').map(x=>x.id),
  diag:P.describe(r)+(readErr?` resultFile=UNREADABLE(${readErr})`:` resultFile=ok checks=${results.length}`)}};
// A run only counts if the suite really executed and produced a result file; otherwise report WHY instead of an empty list.
const valid=r=>!r.spawnError&&!r.signal&&!r.timedOut&&!r.readErr&&r.results.length>0;
const has=(r,suffix)=>r.failedIds.some(i=>i.endsWith(suffix));
(async()=>{
 const iso=await runSuite('isolated');
 await t.check('H1','Correctly isolated mock: every check passes (exit 0), with >= 60 checks executed',async()=>({ok:valid(iso)&&iso.status===0&&iso.failedIds.length===0&&iso.results.length>=60,expected:'valid run, exit 0, 0 failed, >=60 checks',actual:`${iso.diag} failed=${JSON.stringify(iso.failedIds).slice(0,160)}`}));
 const ls=await runSuite('leaky-select');await t.check('H2','Mock where SELECT ignores ownership: suite exits 1 and flags the read checks (T3/T4 or T1)',async()=>({ok:valid(ls)&&ls.status===1&&(has(ls,'.T3')||has(ls,'.T4')||has(ls,'.T1')),expected:'valid run, exit 1 with read failures',actual:`${ls.diag} failed=${JSON.stringify(ls.failedIds).slice(0,140)}`}));
 const lw=await runSuite('leaky-write');await t.check('H3','Mock where UPDATE/DELETE ignore ownership: suite exits 1 and flags T5 and T6',async()=>({ok:valid(lw)&&lw.status===1&&has(lw,'.T5')&&has(lw,'.T6'),expected:'valid run, T5+T6 failed',actual:`${lw.diag} failed=${JSON.stringify(lw.failedIds).slice(0,140)}`}));
 const li=await runSuite('leaky-insert');await t.check('H4','Mock where INSERT accepts foreign owner: suite exits 1 and flags T7/T8',async()=>({ok:valid(li)&&li.status===1&&(has(li,'.T7')||has(li,'.T8')),expected:'valid run, T7/T8 failed',actual:`${li.diag} failed=${JSON.stringify(li.failedIds).slice(0,140)}`}));
 const lst=await runSuite('leaky-storage');await t.check('H5','Mock where storage ignores ownership: suite exits 1 and flags storage T1, T3, T4 and T5',async()=>({ok:valid(lst)&&lst.status===1&&['storage.T1','storage.T3','storage.T4','storage.T5'].every(i=>lst.failedIds.includes(i)),expected:'valid run, storage T1,T3,T4,T5 failed',actual:`${lst.diag} failed=${JSON.stringify(lst.failedIds.filter(i=>i.startsWith('storage'))).slice(0,140)}`}));
 const wj=await runSuite('weak-jwt');await t.check('H6','Mock that does not verify JWT signatures: suite exits 1 and flags auth.T1',async()=>({ok:valid(wj)&&wj.status===1&&wj.failedIds.includes('auth.T1'),expected:'valid run, auth.T1 failed',actual:`${wj.diag} failed=${JSON.stringify(wj.failedIds).slice(0,140)}`}));
 const X={CHECK_MIME:'yes',CHECK_LIMITS:'yes'};
 const noAl=await runSuite('isolated',X);await t.check('H7','Optional upload-rule checks against a mock WITHOUT an allow-list/limit: storage.M2 and storage.L1 FAIL (the suite notices the gap), M1 passes',async()=>({ok:valid(noAl)&&noAl.status===1&&noAl.failedIds.includes('storage.M2')&&noAl.failedIds.includes('storage.L1')&&!noAl.failedIds.includes('storage.M1'),expected:'M2+L1 failed, M1 ok',actual:`${noAl.diag} failed=${JSON.stringify(noAl.failedIds).slice(0,140)}`}));
 const al=await runSuite('allowlist',X);await t.check('H8','Optional upload-rule checks against a mock WITH the allow-list and 10 MB limit: everything passes (exit 0) including M1, M2, L1',async()=>({ok:valid(al)&&al.status===0&&al.failedIds.length===0&&['storage.M1','storage.M2','storage.L1'].every(i=>al.results.some(x=>x.id===i&&x.status==='PASS')),expected:'exit 0, M1/M2/L1 PASS',actual:`${al.diag} failed=${JSON.stringify(al.failedIds).slice(0,140)}`}));
 fs.writeFileSync(process.argv[2]||'rls-harness.json',JSON.stringify({run:new Date().toISOString(),build:'RLS suite vs LOCAL LOOPBACK MOCK ONLY - not a real Supabase project',results:t.res},null,1));
 try{fs.rmSync(tmp,{recursive:true,force:true})}catch{}
 process.exit(t.res.some(r=>r.status!=='PASS')?1:0)})();
