// Offline validation (E2) of tests/live-browser-isolation.js: the script is run against the REAL vendored SDK in a pinned build, with staging-host requests forwarded to the loopback MOCK.
// Proves the script's logic works and CAN fail (negative control = guard disabled -> must report the reported bug). Says nothing about real Supabase; the real run is the CI job "live-browser".
const fs=require('fs'),os=require('os'),path=require('path'),{spawn,spawnSync}=require('child_process');const T=require('./lib/t.js'),M=require('./rls/mock-supabase.js');const t=T.make();
const root=process.cwd(),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'lbw-'));
const run=(args,env,script)=>new Promise(res=>{const c=spawn('node',[path.join(root,script||'tests/live-browser-isolation.js'),...args],{cwd:root,env:{...process.env,A_PASSWORD:'',B_PASSWORD:'',A_EMAIL:'',B_EMAIL:'',...env}});let o='',e='';c.stdout.on('data',d=>o+=d);c.stderr.on('data',d=>e+=d);const k=setTimeout(()=>c.kill(),150000);c.on('close',s=>{clearTimeout(k);res({status:s,out:o,err:e})})});
(async()=>{
 const b=spawnSync('node',['tools/build-pinned.js','--vendor','vendor','--target-url','https://gdmejzbycgpuabvutkdk.supabase.co','--target-key','sb_publishable_RV_G9MyL3cRJpl67w6gXUg_BpvFP6x8','--qr','demo/vendor/qrcode-shim.js','--out',path.join(tmp,'pk')],{cwd:root});
 await t.check('B0','pinned staging-target build (real SDK) succeeds',async()=>({ok:b.status===0,expected:0,actual:b.status}));
 fs.cpSync(path.join(tmp,'pk'),path.join(tmp,'noguard'),{recursive:true});fs.writeFileSync(path.join(tmp,'noguard','gg-account-guard.js'),'');
 const PA='mockpass-A-1234',PB='mockpass-B-1234';process.env.MOCK_PW_A=PA;process.env.MOCK_PW_B=PB;const m=await M.start('allowlist');
 const env={GG_LIVE_MODE:'mock',MOCK_URL:m.url,A_EMAIL:'a@example.com',B_EMAIL:'b@example.com',A_PASSWORD:PA,B_PASSWORD:PB,MOCK_PW_A:PA,MOCK_PW_B:PB};
 const r1=await run([path.join(tmp,'r1.json'),path.join(tmp,'pk')],env);const j1=fs.existsSync(path.join(tmp,'r1.json'))?JSON.parse(fs.readFileSync(path.join(tmp,'r1.json'),'utf8')):{results:[]};
 await t.check('B1','with the guard: all 10 real-session checks pass (L0-L7 incl. the reported A->B scenario and the stale tab)',async()=>({ok:r1.status===0&&j1.results.length>=10&&j1.results.every(x=>x.status==='PASS'),expected:'10/10 PASS',actual:j1.results.filter(x=>x.status==='PASS').length+'/'+j1.results.length}));
 await t.check('B2','no password or token appears in the script output or the result file',async()=>{const all=r1.out+r1.err+JSON.stringify(j1);return{ok:!all.includes(PA)&&!all.includes(PB)&&!/eyJ[A-Za-z0-9_-]{10,}/.test(all)&&!/Bearer /.test(all),expected:'clean',actual:'checked'}});
 const r2=await run([path.join(tmp,'r2.json'),path.join(tmp,'noguard')],env);const j2=fs.existsSync(path.join(tmp,'r2.json'))?JSON.parse(fs.readFileSync(path.join(tmp,'r2.json'),'utf8')):{results:[]};
 const f=id=>(j2.results.find(x=>x.id===id)||{}).status;
 await t.check('B3','negative control: with the guard disabled the script FAILS and flags the reported bug (L3b) - it cannot pass vacuously',async()=>({ok:r2.status===1&&f('L3b')==='FAIL'&&f('L4')==='FAIL',expected:'exit 1, L3b+L4 FAIL',actual:JSON.stringify({exit:r2.status,L3b:f('L3b'),L4:f('L4')})}));
 process.env.MOCK_REUSE_MS='2000';m.close();
 const m2=await M.start('allowlist');
 const r6=await run([path.join(tmp,'r6.json'),path.join(tmp,'pk')].map((x,i)=>i?x:x).slice(0,2),{...env,MOCK_URL:m2.url,WAIT_MS:'3000'},'tests/live-browser-session-probe.js');
 const j6=fs.existsSync(path.join(tmp,'r6.json'))?JSON.parse(fs.readFileSync(path.join(tmp,'r6.json'),'utf8')):{results:[]};const g6=id=>(j6.results.find(x=>x.id===id)||{}).status;
 await t.check('B5','session probe (offline, mock): runs to completion; sessionStorage isolation, refresh rotation, server revocation and no-cloud-write assertions pass; observations are recorded',async()=>({ok:r6.status===0&&['P1a','P2a','P2b','P4','P5a','P8'].every(i=>g6(i)==='PASS')&&j6.results.filter(x=>x.status==='INFO').length>=7&&!(r6.out+r6.err+JSON.stringify(j6)).includes('mockpass-A-1234'),expected:'pass',actual:JSON.stringify({exit:r6.status,info:j6.results.filter(x=>x.status==='INFO').length})}));
 m2.close();
 const r3=await run([path.join(tmp,'r3.json'),path.join(tmp,'pk')],{GG_LIVE_MODE:'mock',MOCK_URL:'http://127.0.0.1:1'});
 const r4=await run([path.join(tmp,'r4.json'),path.join(tmp,'pk')],{...env,A_EMAIL:'a@gmail.com'});
 const r5=await run([path.join(tmp,'r5.json'),path.join(tmp,'pk')],{...env,GG_LIVE_MODE:'bogus'});
 await t.check('B4','refusals: missing passwords, a non-example e-mail, and an unknown mode each exit 2 without contacting anything',async()=>({ok:r3.status===2&&r4.status===2&&r5.status===2&&/REFUSED/.test(r3.out+r4.out+r5.out),expected:'2,2,2',actual:[r3.status,r4.status,r5.status].join(',')}));
 if(!process.env.LBW_KEEP)fs.rmSync(tmp,{recursive:true,force:true});
 fs.writeFileSync(process.argv[2]||'live-browser-wrapper.json',JSON.stringify({run:new Date().toISOString(),build:'live-browser-isolation.js validated offline vs loopback mock (E2)',results:t.res},null,1));process.exit(t.res.every(x=>x.status==='PASS')?0:1)})().catch(e=>{console.error(e);process.exit(1)});
