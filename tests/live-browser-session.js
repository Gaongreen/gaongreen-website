// LIVE counterpart of tests/func-session.js: session-only sign-in and the 30-minute idle timeout against the REAL staging Auth/Data (E5) with the real SDK, fictional account A only.
// Mock mode (GG_LIVE_MODE=mock) validates this script offline (E2). Playwright fake clock is used for idle time; never advanced past 31 minutes (staging tokens last 60).
// Writes: Auth calls (sign-in, refresh, sign-out) and ONE fictional company_profiles row for A (cloud save test), deleted again at the end. Never a password/token in output.
// Usage: node tests/live-browser-session.js <out.json> <pinned-dir>   env: A_EMAIL A_PASSWORD [MOCK_URL]
const fs=require('fs'),S=require('./lib/serve.js'),T=require('./lib/t.js');const t=T.make();
const MODE=process.env.GG_LIVE_MODE||'staging',STAGING_HOST='gdmejzbycgpuabvutkdk.supabase.co',KEY='sb_publishable_RV_G9MyL3cRJpl67w6gXUg_BpvFP6x8',MIN=60000;
const AE=process.env.A_EMAIL,AP=process.env.A_PASSWORD,out=process.argv[2]||'live-browser-session.json',dir=process.argv[3]||'dist-live-pinned';
if(!AE||!AP){console.log('REFUSED: A_EMAIL and A_PASSWORD must be set.');process.exit(2)}
if(!/@example\.(test|com)$/.test(AE)){console.log('REFUSED: only fictional example.* accounts may be used.');process.exit(2)}
if(MODE!=='staging'&&MODE!=='mock'){console.log('REFUSED: GG_LIVE_MODE must be staging or mock.');process.exit(2)}
if(MODE==='mock'&&!/^http:\/\/127\.0\.0\.1:\d+$/.test(process.env.MOCK_URL||'')){console.log('REFUSED: mock mode needs MOCK_URL.');process.exit(2)}
const API=MODE==='staging'?'https://'+STAGING_HOST:process.env.MOCK_URL;
const info=(id,name,actual)=>{t.res.push({id,name,status:'INFO',expected:'observation',actual:JSON.stringify(actual)});console.log('INFO '+id+' '+name+'  '+JSON.stringify(actual))};
(async()=>{
 const s=await S.start(dir);const blocked=[],reqs=[];
 const authLog=[];let inflight=0;
 const mk=async(state)=>{const ctx=await s.browser.newContext(state?{storageState:state}:{});await ctx.clock.install();
  ctx.on('request',r=>{if(r.url().includes(STAGING_HOST))inflight++});ctx.on('requestfinished',r=>{if(r.url().includes(STAGING_HOST))inflight=Math.max(0,inflight-1)});ctx.on('requestfailed',r=>{if(r.url().includes(STAGING_HOST))inflight=Math.max(0,inflight-1)});
  ctx.on('response',r=>{try{const u=new URL(r.url());if(u.host===STAGING_HOST&&/^\/auth\/v1\//.test(u.pathname))authLog.push(r.request().method()+' '+u.pathname.replace('/auth/v1/','')+' '+r.status())}catch(e){}});
  await ctx.route('**/*',async route=>{const rq=route.request(),u=new URL(rq.url());if(S.isAllowedUrl(rq.url(),s.port))return route.continue();
   if(u.protocol==='https:'&&u.host===STAGING_HOST){reqs.push({m:rq.method(),p:u.pathname});if(MODE==='staging')return route.continue();const cors={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*','access-control-expose-headers':'*'};
    if(rq.method()==='OPTIONS')return route.fulfill({status:204,headers:cors});
    try{const r=await fetch(process.env.MOCK_URL+u.pathname+u.search,{method:rq.method(),headers:rq.headers(),body:['GET','HEAD'].includes(rq.method())?undefined:rq.postDataBuffer()});return route.fulfill({status:r.status,headers:{...cors,'content-type':r.headers.get('content-type')||'application/json'},body:Buffer.from(await r.arrayBuffer())})}catch(e){return route.abort()}}
   blocked.push(u.host.slice(0,60));route.abort()});return ctx};
 const go=async(p,f)=>{await p.goto(s.base+f);await p.waitForTimeout(600)};
 const inStore=(p,st)=>p.evaluate(x=>Object.keys(window[x]).some(k=>/^sb-.+-auth-token$/.test(k)),st);
 const sess=p=>p.evaluate(()=>{for(const k of Object.keys(sessionStorage))if(/^sb-.+-auth-token$/.test(k)){const j=JSON.parse(sessionStorage.getItem(k));return{k,v:sessionStorage.getItem(k),rt:j.refresh_token,at:j.access_token,uid:j.user&&j.user.id}}return null});
 const signIn=async p=>{await go(p,'GaonGreen_Login.html');await p.fill('#email',AE);await p.fill('#password',AP);await p.click('#form button[type=submit]');for(let i=0;i<60;i++){if(await inStore(p,'sessionStorage'))break;await p.waitForTimeout(200)}await p.waitForTimeout(500)};
 const idle=async(p,ms)=>{let left=ms;while(left>0){const d=Math.min(15000,left);await p.clock.runFor(d);left-=d;await p.waitForTimeout(15)}await p.waitForTimeout(900)};
 const idleSettled=async(p,ms)=>{let left=ms;while(left>0){const d=Math.min(15000,left);await p.clock.runFor(d);left-=d;for(let i=0;i<150&&inflight>0;i++)await p.waitForTimeout(20);await p.waitForTimeout(15)}await p.waitForTimeout(900)};
 const msgOf=q=>q.evaluate(()=>(document.getElementById('status')||{}).textContent||'');
 const http=async(path,hdr,method,body)=>(await fetch(API+path,{method:method||'GET',headers:{apikey:KEY,'content-type':'application/json',...hdr},body:body?JSON.stringify(body):undefined})).status;
 const cloudRead=p=>p.evaluate(async()=>{const c=window.ggClients&&window.ggClients[0];if(!c)return{noClient:true};const r=await c.from('company_profiles').select('owner_id').limit(1);return{ok:!r.error}});
 const refresh=p=>p.evaluate(async()=>{const c=window.ggClients[0];const r=await c.auth.refreshSession();return{ok:!!(r.data&&r.data.session),err:r.error&&String(r.error.message||r.error.name).slice(0,60)}});
 const revoked=async se=>{const r=await http('/auth/v1/token?grant_type=refresh_token',{},'POST',{refresh_token:se.rt});const u=await http('/auth/v1/user',{authorization:'Bearer '+se.at});return{refresh:r,user:u,ok:r>=400&&r<500&&(u===401||u===403)}};
 // S1 session-only on the real SDK + real Auth
 const c1=await mk();const p1=await c1.newPage();await signIn(p1);const inL=await inStore(p1,'localStorage'),inS=await inStore(p1,'sessionStorage');const se1=await sess(p1);
 await go(p1,'GaonGreen_Company_Settings_Cloud_Beta.html');await p1.reload();await p1.waitForTimeout(800);const reloaded=await inStore(p1,'sessionStorage');const rd=await cloudRead(p1);
 await t.check('S1','real sign-in: the session is in sessionStorage only, survives a reload, and an authenticated cloud read works; the guard identifies the user',async()=>{const g=await p1.evaluate(()=>window.ggAccountGuard.sessionUser());return{ok:!inL&&inS&&reloaded&&rd.ok===true&&g===se1.uid,expected:'session-only',actual:JSON.stringify({inL,inS,reloaded,read:rd,guardOk:g===se1.uid})}});
 const c2=await mk();const p2=await c2.newPage();await go(p2,'GaonGreen_Login.html');
 await t.check('S2','a new browser context (browser closed and reopened normally) has no session',async()=>({ok:!(await inStore(p2,'sessionStorage'))&&!(await inStore(p2,'localStorage')),expected:'none',actual:'checked'}));await c2.close();
 // S3 token refresh
 const before=await sess(p1);const rf=await refresh(p1);const after=await sess(p1);const rd2=await cloudRead(p1);
 await t.check('S3','token refresh: succeeds, the refresh token rotates, cloud reads keep working',async()=>({ok:rf.ok&&before.rt!==after.rt&&rd2.ok===true,expected:'rotated',actual:JSON.stringify({rf,rotated:before.rt!==after.rt,read:rd2})}));
 // S4 cloud save + load (own fictional row), then clean up
 await go(p1,'GaonGreen_Company_Settings_Cloud_Beta.html');p1.on('dialog',d=>d.accept());await p1.fill('#company','Fictional Session Co (cloud)');const w0=reqs.length;await p1.click('#cloudSave');await p1.waitForTimeout(2500);
 const wrote=reqs.slice(w0).filter(r=>r.m==='POST'&&/company_profiles/.test(r.p)).length;await p1.fill('#company','changed locally');await p1.click('#cloudLoad');await p1.waitForTimeout(2500);const back=await p1.inputValue('#company');
 await p1.evaluate(async()=>{const c=window.ggClients[0];const u=(await c.auth.getUser()).data.user;await c.from('company_profiles').delete().eq('owner_id',u.id)});
 await t.check('S4','cloud save and cloud load work with the session-only client (the fictional row is deleted afterwards)',async()=>({ok:wrote>=1&&back==='Fictional Session Co (cloud)',expected:'saved+loaded',actual:JSON.stringify({posts:wrote,back})}));
 // S5 idle (own context: its fake clock runs ahead of real time, and server token expiry is real-clock based)
 const c5=await mk();const p5=await c5.newPage();await signIn(p5);await go(p5,'GaonGreen_Company_Settings_Cloud_Beta.html');await p5.fill('#company','Unsaved live text');await idle(p5,29*MIN);
 const warn=await p5.evaluate(()=>!!document.getElementById('gg-idle-banner'));await p5.click('#gg-idle-stay');await p5.waitForTimeout(300);const warnGone=await p5.evaluate(()=>!document.getElementById('gg-idle-banner'));
 const se2=await sess(p5);const mark=authLog.length;await idleSettled(p5,31*MIN);await p5.waitForFunction(()=>!sessionStorage.getItem('gg-revoke'),null,{timeout:15000}).catch(()=>{});await p5.waitForTimeout(2500);const signedOut=!(await inStore(p5,'sessionStorage')),msg=await msgOf(p5),rv=await revoked(se2);const calls=authLog.slice(mark);
 await t.check('S5a','idle: warning at 28 minutes, "Stay signed in" resets, then 30 minutes of inactivity signs out with a visible message',async()=>({ok:warn&&warnGone&&signedOut&&/30 minutes/.test(msg),expected:'warn, stay, out',actual:JSON.stringify({warn,warnGone,signedOut,msg:msg.slice(0,50)})}));
 await t.check('S5b','the automatic sign-out revoked the session on the real server: old refresh token rejected, old access token rejected by Auth /user',async()=>({ok:rv.ok,expected:'4xx and 401/403',actual:JSON.stringify({refresh:rv.refresh,user:rv.user,authCallsDuringSignOut:calls})}));
 const st5=await c5.storageState();await c5.close();const c5b=await mk(st5);const p5b=await c5b.newPage();await signIn(p5b);await go(p5b,'GaonGreen_Company_Settings_Cloud_Beta.html');const kept=await p5b.inputValue('#company');
 await t.check('S5c','unsaved text typed before the automatic sign-out is still there after signing in again (flushed to the account-local store)',async()=>({ok:kept==='Unsaved live text',expected:'kept',actual:JSON.stringify({kept})}));
 try{await p5b.evaluate(()=>window.ggClients[0].auth.signOut({scope:'local'}))}catch(e){}
 // S5d the hand-off path live: fake clock jumps (safety timeout fires before the network), so the Login page must finish the revocation
 const c5d=await mk();const p5d=await c5d.newPage();await signIn(p5d);const se5d=await sess(p5d);await go(p5d,'GaonGreen_Company_Settings_Cloud_Beta.html');await idle(p5d,31*MIN);await p5d.waitForFunction(()=>!sessionStorage.getItem('gg-revoke'),null,{timeout:15000}).catch(()=>{});await p5d.waitForTimeout(3000);const rv5d=await revoked(se5d);
 await t.check('S5d','automatic sign-out when the logout cannot finish before the safety timeout (fast-forwarded clock): the Login hand-off still revokes the server session',async()=>({ok:!(await inStore(p5d,'sessionStorage'))&&rv5d.ok,expected:'signed out + revoked',actual:JSON.stringify({refresh:rv5d.refresh,user:rv5d.user})}));await c5d.close();
 // S6 restored tab with a stale activity stamp: signed out and revoked before any data call
 const c6s=await mk();const p6s=await c6s.newPage();await signIn(p6s);const dump6=await sess(p6s);
  {const c=await mk();await c.addInitScript(d=>{try{if(!sessionStorage.getItem(d.k)){sessionStorage.setItem(d.k,d.v);sessionStorage.setItem('gg-last-activity',String(Date.now()-45*60000))}}catch(e){}},{k:dump6.k,v:dump6.v});const q=await c.newPage();const w=reqs.length;await go(q,'GaonGreen_Company_Settings_Cloud_Beta.html');await q.waitForTimeout(3500);
  const data=reqs.slice(w).filter(r=>/\/rest\/v1\//.test(r.p)).length,gone=!(await inStore(q,'sessionStorage')),m=await msgOf(q),rv2=await revoked(dump6);
  await t.check('S6','a tab restored by the browser with an activity stamp 45 minutes old is signed out before any data call, shows the message, and its session is revoked on the server',async()=>({ok:gone&&data===0&&/30 minutes/.test(m)&&rv2.ok,expected:'out, 0 data calls, revoked',actual:JSON.stringify({gone,dataCalls:data,msg:m.slice(0,40),revoked:rv2})}));await c.close()}
 // S7 duplicated tab (observation + clean end)
 const c7=await mk();const p7=await c7.newPage();await signIn(p7);const d3=await p7.evaluate(()=>Object.entries(sessionStorage));const p3=await c7.newPage();await p3.addInitScript(a=>{try{if(!sessionStorage.length)a.forEach(([k,v])=>sessionStorage.setItem(k,v))}catch(e){}},d3);/* a real "Duplicate tab" copies ALL of sessionStorage, including the activity stamp */await go(p3,'GaonGreen_Company_Settings_Cloud_Beta.html');
 const r1=await refresh(p7),r2=await refresh(p3),r3=await refresh(p7),r4=await refresh(p3);info('S7a','DUPLICATED tab: both tabs refresh the same session (t1,t3,t1,t3)',{results:[r1.ok,r2.ok,r3.ok,r4.ok],errors:[r1.err,r2.err,r3.err,r4.err].filter(Boolean)});
 await idle(p7,31*MIN);const both=!(await inStore(p7,'sessionStorage'))&&!(await inStore(p3,'sessionStorage'));
 await t.check('S7b','duplicated tab: after 30 minutes idle both tabs end cleanly (no token left in either)',async()=>({ok:both,expected:'both out',actual:both}));
 await t.check('S8','no unexpected host was contacted (only 127.0.0.1 and the staging project)',async()=>({ok:!blocked.length,expected:'0',actual:JSON.stringify([...new Set(blocked)])}));
 try{await c1.close();await c6s.close();await c7.close()}catch(e){}await s.close();
 fs.writeFileSync(out,JSON.stringify({run:new Date().toISOString(),mode:MODE,build:MODE==='staging'?'REAL SDK + REAL STAGING Auth/Data, fake page clock (E5)':'REAL SDK vs loopback MOCK (E2): validates this script only',results:t.res},null,1));process.exit(t.res.every(x=>x.status!=='FAIL')?0:1)})().catch(e=>{console.error('ERROR',String(e&&e.message||e).replace(/\n.*/s,'').slice(0,240));process.exit(1)});
