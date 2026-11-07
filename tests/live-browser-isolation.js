// REAL-SESSION browser test for the cross-account local-data fix (reported 2026-11-07).
// Drives headless Chromium against the PINNED build (real vendored supabase-js 2.118.0, retargeted to the STAGING project), signing in through the REAL Login page
// as the two fictional accounts, then checking that browser-local tool data never crosses accounts.
//   GG_LIVE_MODE=staging : requests to the staging Supabase host go to the real staging project (E5). Only that host and 127.0.0.1 are reachable.
//   GG_LIVE_MODE=mock    : requests to the staging host are forwarded to the loopback mock (E2) so this script can be validated offline. Says nothing about real Supabase.
// Usage: node tests/live-browser-isolation.js <out.json> <pinned-dir>      env: A_EMAIL B_EMAIL A_PASSWORD B_PASSWORD [MOCK_URL for mock mode]
// Passwords come ONLY from the environment and are never printed or written. Writes nothing to the cloud: any non-GET request to rest/storage fails the run.
const fs=require('fs'),S=require('./lib/serve.js'),T=require('./lib/t.js');const t=T.make();
const MODE=process.env.GG_LIVE_MODE||'staging',STAGING='https://gdmejzbycgpuabvutkdk.supabase.co',STAGING_HOST='gdmejzbycgpuabvutkdk.supabase.co';
const AE=process.env.A_EMAIL,BE=process.env.B_EMAIL,AP=process.env.A_PASSWORD,BP=process.env.B_PASSWORD;
const out=process.argv[2]||'live-browser-isolation.json',dir=process.argv[3]||'dist-live-pinned';
if(!AE||!BE||!AP||!BP){console.log('REFUSED: A_EMAIL, B_EMAIL, A_PASSWORD, B_PASSWORD must be set in the environment.');process.exit(2)}
if(!/@example\.(test|com)$/.test(AE)||!/@example\.(test|com)$/.test(BE)){console.log('REFUSED: only fictional example.* accounts may be used.');process.exit(2)}
if(MODE!=='staging'&&MODE!=='mock'){console.log('REFUSED: GG_LIVE_MODE must be staging or mock.');process.exit(2)}
if(MODE==='mock'&&!/^http:\/\/127\.0\.0\.1:\d+$/.test(process.env.MOCK_URL||'')){console.log('REFUSED: mock mode needs MOCK_URL=http://127.0.0.1:<port>.');process.exit(2)}
const CO={A:'Fictional A Co (live-iso)',B:'Fictional B Co (live-iso)'};
const KEYS=['gaongreen-company-settings-v1','gaongreen-epr-scorecard-v1','gaongreen-kre100-helper-v1','gaongreen-kissb-draft-v1','gaongreen-evidence-v1','gaongreen-qr-esg-card-v1','gaongreen-supplier-scan-v1','gaongreen-supplier-draft-v1'];
const PAGES=['GaonGreen_Company_Settings_Cloud_Beta.html','GaonGreen_ESG_Dashboard_Cloud_Beta.html','GaonGreen_KISSB_Cloud_Beta.html','GaonGreen_K-RE100_Cloud_Beta.html','GaonGreen_EPR_Cloud_Beta.html'];
const short=s=>String(s||'').slice(0,8);
(async()=>{
 const s=await S.start(dir);const ctx=await s.browser.newContext();const writes=[],blocked=[];
 await ctx.route('**/*',async route=>{const rq=route.request(),u=new URL(rq.url());
  if(S.isAllowedUrl(rq.url(),s.port))return route.continue();
  if(u.protocol==='https:'&&u.host===STAGING_HOST){
   if(rq.method()!=='GET'&&rq.method()!=='HEAD'&&rq.method()!=='OPTIONS'&&!/^\/auth\/v1\//.test(u.pathname))writes.push(rq.method()+' '+u.pathname.slice(0,40));
   if(MODE==='staging')return route.continue();
   const cors={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*','access-control-expose-headers':'*'};
   if(rq.method()==='OPTIONS')return route.fulfill({status:204,headers:cors});
   try{const r=await fetch(process.env.MOCK_URL+u.pathname+u.search,{method:rq.method(),headers:rq.headers(),body:['GET','HEAD'].includes(rq.method())?undefined:rq.postDataBuffer()});
    const body=Buffer.from(await r.arrayBuffer());return route.fulfill({status:r.status,headers:{...cors,'content-type':r.headers.get('content-type')||'application/json'},body})}catch(e){return route.abort()}}
  blocked.push(u.host.slice(0,60));route.abort()});
 const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message.slice(0,120)));
 const go=async(p,f)=>{await p.goto(s.base+f);await p.waitForTimeout(600)};
 const uidOf=p=>p.evaluate(()=>window.ggAccountGuard&&window.ggAccountGuard.sessionUser());
 // Independent identity: the "sub" claim of the real access token, read from the SDK's own stored session. Never returned verbatim.
 const subOf=p=>p.evaluate(()=>{for(const k of Object.keys(localStorage)){if(/^sb-.+-auth-token$/.test(k)){try{const j=JSON.parse(localStorage.getItem(k));const at=j&&(j.access_token||(j.currentSession&&j.currentSession.access_token));if(at)return JSON.parse(atob(at.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).sub}catch(e){}}}return null});
 const tokenKeys=p=>p.evaluate(()=>Object.keys(localStorage).filter(k=>/^sb-.+-auth-token$/.test(k)).length);
 const signIn=async(p,email,pw)=>{await go(p,'GaonGreen_Login.html');
  if(await tokenKeys(p)) {await go(p,'GaonGreen_Login.html?action=signout');await p.waitForTimeout(800)}
  await p.fill('#email',email);await p.fill('#password',pw);await p.click('#form button[type=submit]');
  for(let i=0;i<40;i++){if(await tokenKeys(p))break;await p.waitForTimeout(250)}await p.waitForTimeout(500)};
 const signOut=async p=>{await go(p,'GaonGreen_Login.html?action=signout');for(let i=0;i<40;i++){if(!(await tokenKeys(p)))break;await p.waitForTimeout(250)}await p.waitForTimeout(400)};
 const readAll=p=>p.evaluate(ks=>Object.fromEntries(ks.map(k=>[k,localStorage.getItem(k)])),KEYS);
 const writeAll=(p,name)=>p.evaluate(([ks,n])=>ks.forEach(k=>{if(k!=='gaongreen-company-settings-v1')localStorage.setItem(k,JSON.stringify({owner:n,k}))}),[KEYS,name]);
 const rawKeys=p=>p.evaluate(()=>Object.keys(localStorage).filter(k=>/^gaongreen-/.test(k)&&k!=='gaongreen-language'));
 // L0 environment: real SDK, not a stand-in
 await go(pg,'GaonGreen_Login.html');
 await t.check('L0','the page runs the real vendored SDK (no stand-in) and the guard is loaded',async()=>{const r=await pg.evaluate(()=>({sdk:!!(window.supabase&&window.supabase.createClient),guard:!!window.ggAccountGuard,fixture:/demo|stand-?in|fixture/i.test(String(window.supabase&&window.supabase.version||''))}));return{ok:r.sdk&&r.guard&&!r.fixture,expected:'sdk+guard',actual:JSON.stringify(r)}});
 // L1 sign in as A through the real UI; the guard must see the REAL session user
 await signIn(pg,AE,AP);const subA=await subOf(pg),guardA=await uidOf(pg);
 await t.check('L1','real sign-in as A: ggAccountGuard.sessionUser() equals the "sub" of the real access token (the assumption about the SDK session record holds)',async()=>({ok:!!subA&&/^[0-9a-f-]{36}$/.test(subA)&&guardA===subA,expected:'guard id == token sub',actual:JSON.stringify({sub:short(subA),guard:short(guardA)})}));
 // L2 A saves through the real Company Settings UI (local save only) and writes the other local keys
 await go(pg,PAGES[0]);await pg.fill('#company',CO.A);await pg.click('#save');await pg.waitForTimeout(400);await writeAll(pg,'A');
 const aSaved=await readAll(pg);
 await t.check('L2','A: Company Settings local save via the real UI stores A\'s data and it reads back under A',async()=>{const v=JSON.parse(aSaved['gaongreen-company-settings-v1']||'null');return{ok:!!v&&v.company===CO.A&&KEYS.filter(k=>k!=='gaongreen-company-settings-v1').every(k=>aSaved[k]!==null),expected:'A data present',actual:JSON.stringify({company:v&&v.company,keysPresent:KEYS.filter(k=>aSaved[k]!==null).length})}});
 // L3 THE REPORTED SCENARIO: sign out (nav path), sign in as B, in the same browser profile
 await signOut(pg);const afterOut=await tokenKeys(pg);
 await signIn(pg,BE,BP);const subB=await subOf(pg),guardB=await uidOf(pg);
 await t.check('L3a','real sign-out ends the session; real sign-in as B yields a different user id, seen by the guard',async()=>({ok:afterOut===0&&!!subB&&subB!==subA&&guardB===subB,expected:'signed out, then B != A',actual:JSON.stringify({tokensAfterOut:afterOut,a:short(subA),b:short(subB),guard:short(guardB)})}));
 const leak=[];
 for(const f of PAGES){await go(pg,f);const r=await readAll(pg);const l=Object.entries(r).filter(([k,v])=>v!==null).map(x=>x[0]);if(l.length)leak.push(f+':'+l.join(','))}
 await go(pg,PAGES[0]);const bInput=await pg.inputValue('#company');
 await go(pg,PAGES[1]);await pg.waitForTimeout(800);const bDash=await pg.evaluate(()=>document.body.innerText);
 await t.check('L3b','THE REPORTED BUG: as B, no local key on any tool page holds A\'s data; Company Settings is empty; the dashboard does not show A\'s company',async()=>({ok:!leak.length&&bInput===''&&!bDash.includes(CO.A),expected:'nothing from A',actual:JSON.stringify({leak,bInputEmpty:bInput==='',dashShowsA:bDash.includes(CO.A)})}));
 // B saves its own, then A's data must be untouched and still hidden/restored
 await go(pg,PAGES[0]);await pg.fill('#company',CO.B);await pg.click('#save');await pg.waitForTimeout(400);await writeAll(pg,'B');
 const keysAsB=await rawKeys(pg);
 await t.check('L3c','B\'s local data is stored under B\'s own namespace; A\'s namespaced copies are preserved (hidden, not deleted)',async()=>{const ra=keysAsB.filter(k=>k.endsWith('::'+subA)).length,rb=keysAsB.filter(k=>k.endsWith('::'+subB)).length;return{ok:ra>=KEYS.length&&rb>=KEYS.length,expected:'>= '+KEYS.length+' keys each',actual:JSON.stringify({a:ra,b:rb})}});
 // L4 back to A
 await signOut(pg);await signIn(pg,AE,AP);const subA2=await subOf(pg);
 await go(pg,PAGES[0]);const aBack=await pg.inputValue('#company');const aAll=await readAll(pg);
 await go(pg,PAGES[1]);await pg.waitForTimeout(800);const aDash=await pg.evaluate(()=>document.body.innerText);
 await t.check('L4','back as A: A\'s own data is restored exactly (company, all keys); B\'s company never appears',async()=>({ok:subA2===subA&&aBack===CO.A&&KEYS.every(k=>aAll[k]!==null)&&!JSON.stringify(aAll).includes('"owner":"B"')&&!aDash.includes(CO.B),expected:'A restored, no B',actual:JSON.stringify({sameUser:subA2===subA,company:aBack,keys:KEYS.filter(k=>aAll[k]!==null).length,dashShowsB:aDash.includes(CO.B)})}));
 // L5 stale tab: tab1 stays open as A while tab2 switches to B in the same profile
 const tab1=pg,tab2=await ctx.newPage();await go(tab1,PAGES[0]);
 await signOut(tab2);await signIn(tab2,BE,BP);
 await tab1.evaluate(()=>{window.dispatchEvent(new Event('focus'));document.dispatchEvent(new Event('visibilitychange'))});await tab1.waitForTimeout(1500);
 const t1=await tab1.evaluate(()=>({company:document.querySelector('#company')&&document.querySelector('#company').value,ls:localStorage.getItem('gaongreen-company-settings-v1'),guard:window.ggAccountGuard&&window.ggAccountGuard.sessionUser()}));
 await t.check('L5','stale tab: a tab opened as A that is still open after the profile switched to B no longer shows or reads A\'s data',async()=>{const showsA=(t1.company||'').includes(CO.A)||String(t1.ls||'').includes(CO.A);return{ok:!showsA&&t1.guard===subB,expected:'no A data, guard sees B',actual:JSON.stringify({showsA,guard:short(t1.guard)})}});
 await tab2.close();
 // L6 no cloud writes and no unexpected hosts
 await t.check('L6','this test made no cloud data writes (no write method to rest/storage; HEAD count queries are reads) and contacted no host other than 127.0.0.1 and the staging project',async()=>({ok:!writes.length&&!blocked.length,expected:'0 writes, 0 blocked',actual:JSON.stringify({writes,blocked:[...new Set(blocked)]})}));
 await t.check('L7','no uncaught page errors',async()=>({ok:!errs.length,expected:'none',actual:JSON.stringify(errs.slice(0,3))}));
 // cleanup: end the session so no token remains; the context is discarded
 try{await signOut(pg)}catch(e){}
 await ctx.close();await s.close();
 const build=MODE==='staging'?'REAL SDK 2.118.0 + REAL STAGING project, real sign-in as the two fictional accounts (E5)':'REAL SDK 2.118.0 vs loopback MOCK via route forwarding (E2): validates this script only, NOT real Supabase';
 fs.writeFileSync(out,JSON.stringify({run:new Date().toISOString(),mode:MODE,build,results:t.res},null,1));process.exit(t.res.every(x=>x.status==='PASS')?0:1)})().catch(e=>{console.error('ERROR',String(e&&e.message||e).replace(/\n.*/s,'').slice(0,200));process.exit(1)});
