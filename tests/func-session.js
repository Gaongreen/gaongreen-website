// Session-only authentication + 30-minute idle timeout: tests T1-T12 (offline). REAL vendored supabase-js 2.118.0 in the pinned build, staging host forwarded to the loopback MOCK
// (with session/refresh/logout semantics), Playwright fake clock. E2: proves the app logic; the live staging counterpart is tests/live-browser-isolation.js + live-browser-session.js.
// Usage: node tests/func-session.js <out.json>   (builds the pinned pack into a temp dir)
const fs=require('fs'),os=require('os'),path=require('path'),{spawnSync}=require('child_process'),S=require('./lib/serve.js'),T=require('./lib/t.js'),M=require('./rls/mock-supabase.js');const t=T.make();
const STAGING_HOST='gdmejzbycgpuabvutkdk.supabase.co',MIN=60000;
const PA='mockpass-A-1234',PB='mockpass-B-1234';process.env.MOCK_PW_A=PA;process.env.MOCK_PW_B=PB;process.env.MOCK_REUSE_MS='2000';
const KEYS=['gaongreen-company-settings-v1','gaongreen-epr-scorecard-v1','gaongreen-kre100-helper-v1','gaongreen-kissb-draft-v1','gaongreen-evidence-v1','gaongreen-qr-esg-card-v1','gaongreen-supplier-scan-v1','gaongreen-supplier-draft-v1','gaongreen-evidence-form-v1'];
const TOOLS=[['Company Settings','GaonGreen_Company_Settings_Cloud_Beta.html','#company'],['EPR Packaging','GaonGreen_EPR_Cloud_Beta.html','#company'],['K-RE100','GaonGreen_K-RE100_Cloud_Beta.html','main input[type=text],main input:not([type]),main textarea'],
 ['K-ISSB (main form)','GaonGreen_KISSB_Cloud_Beta.html','#form input[type=text],#form textarea,main input[type=text],main textarea'],['QR ESG Card','GaonGreen_QR_ESG_Card_Cloud_Beta.html','main input[type=text],main input:not([type]),main textarea'],
 ['Supplier ESG Scan','GaonGreen_Supplier_ESG_Scan_Cloud_Beta.html','#supplier'],['Evidence Locker','GaonGreen_Evidence_Locker_Cloud_Beta.html','#company']];
(async()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'fsess-')),pack=path.join(tmp,'pk');
 const b=spawnSync('node',['tools/build-pinned.js','--vendor','vendor','--target-url','https://'+STAGING_HOST,'--target-key','sb_publishable_RV_G9MyL3cRJpl67w6gXUg_BpvFP6x8','--qr','demo/vendor/qrcode-shim.js','--out',pack],{cwd:process.cwd()});
 if(b.status!==0){console.log('BUILD FAILED',String(b.stderr).slice(0,300));process.exit(1)}
 const mock=await M.start('allowlist'),s=await S.start(pack);const reqs=[];
 const mk=async()=>{const ctx=await s.browser.newContext();await ctx.clock.install();
  await ctx.route('**/*',async route=>{const rq=route.request(),u=new URL(rq.url());if(S.isAllowedUrl(rq.url(),s.port))return route.continue();
   if(u.protocol==='https:'&&u.host===STAGING_HOST){reqs.push({m:rq.method(),p:u.pathname,t:Date.now()});const cors={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*','access-control-expose-headers':'*'};
    if(rq.method()==='OPTIONS')return route.fulfill({status:204,headers:cors});
    try{const r=await fetch(mock.url+u.pathname+u.search,{method:rq.method(),headers:rq.headers(),body:['GET','HEAD'].includes(rq.method())?undefined:rq.postDataBuffer()});let body=Buffer.from(await r.arrayBuffer());
    if(u.pathname==='/auth/v1/token'&&r.ok){try{const j=JSON.parse(body.toString());delete j.expires_at;body=Buffer.from(JSON.stringify(j))}catch(e){}} // the SDK then derives expiry from expires_in with the PAGE's (fake) clock; the mock's expires_at is real-clock based
    return route.fulfill({status:r.status,headers:{...cors,'content-type':r.headers.get('content-type')||'application/json'},body})}catch(e){return route.abort()}}
   route.abort()});return ctx};
 const go=async(p,f)=>{await p.goto(s.base+f);await p.waitForTimeout(500)};
 const inStore=(p,st)=>p.evaluate(x=>Object.keys(window[x]).some(k=>/^sb-.+-auth-token$/.test(k)),st);
 const sess=(p)=>p.evaluate(()=>{for(const k of Object.keys(sessionStorage))if(/^sb-.+-auth-token$/.test(k)){const j=JSON.parse(sessionStorage.getItem(k));return{k,v:sessionStorage.getItem(k),rt:j.refresh_token,at:j.access_token,uid:j.user&&j.user.id}}return null});
 const signIn=async(p,email,pw)=>{await go(p,'GaonGreen_Login.html');await p.fill('#email',email);await p.fill('#password',pw);await p.click('#form button[type=submit]');for(let i=0;i<40;i++){if(await inStore(p,'sessionStorage'))break;await p.waitForTimeout(150)}await p.waitForTimeout(300)};
 const refreshWith=async rt=>(await fetch(mock.url+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({refresh_token:rt})})).status;
 const idle=async(p,ms)=>{let left=ms;while(left>0){const d=Math.min(15000,left);await p.clock.runFor(d);left-=d;await p.waitForTimeout(15)}await p.waitForTimeout(700)}; // chunked so network round-trips (real time) can finish between fake-clock steps
 const ls=(p)=>p.evaluate(()=>Object.fromEntries(Object.keys(localStorage).filter(k=>/^gaongreen-/.test(k)).map(k=>[k,localStorage.getItem(k)])));
 const msgOf=q=>q.evaluate(()=>(document.getElementById('status')||{}).textContent||'');
 const A='a@example.com',B='b@example.com';
 // ---------- T1/T2/T12
 {const ctx=await mk();const p=await ctx.newPage();await go(p,'GaonGreen_Login.html');await p.evaluate(()=>localStorage.setItem('sb-legacyref-auth-token',JSON.stringify({access_token:'x.y.z',refresh_token:'old',user:{id:'legacy'}})));
  await go(p,'GaonGreen_Login.html');const legacyGone=await p.evaluate(()=>localStorage.getItem('sb-legacyref-auth-token')===null);
  await signIn(p,A,PA);const inL=await inStore(p,'localStorage'),inS=await inStore(p,'sessionStorage'),se=await sess(p);const guard=await p.evaluate(()=>window.ggAccountGuard&&window.ggAccountGuard.sessionUser());
  await t.check('T1','the session is in sessionStorage and not in localStorage; a legacy persistent token in localStorage is deleted on load (one-time migration)',async()=>({ok:!inL&&inS&&legacyGone,expected:'session-only + legacy removed',actual:JSON.stringify({inL,inS,legacyGone})}));
  await t.check('T12','ggAccountGuard.sessionUser() identifies the user from the sessionStorage session',async()=>({ok:!!se&&!!guard&&guard===se.uid,expected:'guard == session user',actual:JSON.stringify({guard:(guard||'').slice(0,8),user:(se&&se.uid||'').slice(0,8)})}));
  await go(p,'GaonGreen_Company_Settings_Cloud_Beta.html');await p.reload();await p.waitForTimeout(600);const afterReload=await inStore(p,'sessionStorage');
  const stamp=await p.evaluate(()=>sessionStorage.getItem('gg-last-activity'));
  await t.check('T2','a page reload keeps the session and the activity stamp',async()=>({ok:afterReload&&!!stamp,expected:'kept',actual:JSON.stringify({afterReload,stamp:!!stamp})}));
  const ctx2=await mk();const p2=await ctx2.newPage();await go(p2,'GaonGreen_Login.html');
  await t.check('T3a','a brand-new browser context (browser closed and reopened) has no session',async()=>({ok:!(await inStore(p2,'sessionStorage'))&&!(await inStore(p2,'localStorage')),expected:'none',actual:'checked'}));
  // restored tab: stale stamp -> signed out + revoked BEFORE any cloud call
  const dump=await sess(p);const stampNow=Number(await p.evaluate(()=>sessionStorage.getItem('gg-last-activity')));
  const restore=async(stampVal)=>{const c=await mk();await c.addInitScript(d=>{try{if(!sessionStorage.getItem(d.k)){sessionStorage.setItem(d.k,d.v);if(d.s!==null)sessionStorage.setItem('gg-last-activity',String(d.s))}}catch(e){}},{k:dump.k,v:dump.v,s:stampVal});const q=await c.newPage();return{c,q}};
  {const {c,q}=await restore(Date.now()-45*MIN);const before=reqs.length;await go(q,'GaonGreen_Company_Settings_Cloud_Beta.html');await q.waitForTimeout(1200);
   const rest=reqs.slice(before).filter(r=>/\/rest\/v1\//.test(r.p)).length;const url=q.url(),gone=!(await inStore(q,'sessionStorage')),qm=await msgOf(q);
   await t.check('T3b','a restored tab whose last activity is older than 30 minutes is signed out (token removed, redirected to Login with the reason) before any cloud data call',async()=>({ok:gone&&/GaonGreen_Login\.html/.test(url)&&/30 minutes/.test(qm)&&rest===0,expected:'signed out, no data calls',actual:JSON.stringify({gone,url:url.replace(s.base,''),msg:qm.slice(0,50),dataCalls:rest})}));
   const status=await refreshWith(dump.rt);await t.check('T3c','...and its session was revoked on the server (old refresh token rejected)',async()=>({ok:status>=400&&status<500,expected:'4xx',actual:status}));await c.close()}
  // restored with a stamp but no activity record at all (duplicated/odd) -> treated as expired
  await signIn(p,A,PA);const dump2=await sess(p);
  {const c=await mk();await c.addInitScript(d=>{try{if(!sessionStorage.getItem(d.k)){sessionStorage.setItem(d.k,d.v);sessionStorage.removeItem('gg-last-activity')}}catch(e){}},{k:dump2.k,v:dump2.v});const q=await c.newPage();await go(q,'GaonGreen_Company_Settings_Cloud_Beta.html');await q.waitForTimeout(1200);
   await t.check('T3d','a session with no activity stamp (unknown age) is treated as expired, not trusted',async()=>({ok:!(await inStore(q,'sessionStorage'))&&(await msgOf(q)).length>10,expected:'signed out with a message',actual:q.url().replace(s.base,'')}));await c.close()}
  await ctx.close();await ctx2.close()}
 // ---------- T4/T5: warning at 28, stay, sign out at 30
 {const ctx=await mk();const p=await ctx.newPage();await signIn(p,A,PA);await go(p,'GaonGreen_Company_Settings_Cloud_Beta.html');const se=await sess(p);
  await idle(p,27*MIN);const early=await p.evaluate(()=>!!document.getElementById('gg-idle-banner'));
  await idle(p,2*MIN);const warn=await p.evaluate(()=>{const b=document.getElementById('gg-idle-banner');return b?{text:b.textContent.slice(0,120),role:b.getAttribute('role')}:null});
  await t.check('T4a','no warning before 28 minutes of inactivity; a warning (role=alertdialog) appears at 28 minutes',async()=>({ok:!early&&!!warn&&warn.role==='alertdialog',expected:'none at 27, banner at 29',actual:JSON.stringify({early,warn})}));
  await p.click('#gg-idle-stay');await p.waitForTimeout(300);await idle(p,29*MIN);const still=await inStore(p,'sessionStorage');const bannerAfter=await p.evaluate(()=>!!document.getElementById('gg-idle-banner'));
  await t.check('T4b','"Stay signed in" resets the clock: still signed in 29 minutes later (and the next warning shows again)',async()=>({ok:still&&bannerAfter,expected:'signed in, new banner',actual:JSON.stringify({still,bannerAfter})}));
  const se2=await sess(p);const cnt0=(await (await fetch(mock.url+'/__mock/sessions')).json()).count;await idle(p,3*MIN);const gone=!(await inStore(p,'sessionStorage'));const url=p.url();const msg=await p.evaluate(()=>(document.getElementById('status')||{}).textContent||'');
  await t.check('T5a','30 minutes idle: signed out, token removed, redirected to Login with reason=idle and a visible message',async()=>({ok:gone&&/GaonGreen_Login\.html/.test(url)&&/30 minutes/.test(msg),expected:'signed out',actual:JSON.stringify({gone,url:url.replace(s.base,''),msg:msg.slice(0,60)})}));
  const cnt1=(await (await fetch(mock.url+'/__mock/sessions')).json()).count;const st=cnt0-cnt1;const logoutCalls=reqs.filter(r=>r.p==='/auth/v1/logout').length;
  await t.check('T5b','sign-out used the server-side local-scope logout: exactly this one session is revoked on the server (the mock\'s live-session count drops by one)',async()=>({ok:st===1&&logoutCalls>=1,expected:'exactly this session revoked on the server',actual:JSON.stringify({sessionsRevoked:st,logoutCalls})}));
  await ctx.close()}
 // the SDK re-emits SIGNED_IN on focus: that must not count as activity
 {const ctx=await mk();const p=await ctx.newPage();await signIn(p,A,PA);await go(p,'GaonGreen_Company_Settings_Cloud_Beta.html');await idle(p,29*MIN);
  await p.evaluate(()=>{window.dispatchEvent(new Event('focus'));document.dispatchEvent(new Event('visibilitychange'))});await p.waitForTimeout(500);const stillBanner=await p.evaluate(()=>!!document.getElementById('gg-idle-banner'));await idle(p,2*MIN);const out=!(await inStore(p,'sessionStorage'));
  await t.check('T4d','tab refocus (SDK re-emits SIGNED_IN) does not reset the idle clock: warning still shown at 29 minutes and signed out by 31',async()=>({ok:stillBanner&&out,expected:'banner then out',actual:JSON.stringify({stillBanner,out})}));await ctx.close()}
 // T5c (regression for the live S5b failure): the token is close to expiry at sign-out time, so the SDK must REFRESH before it can log out, and the network is slow; the page's fake clock jumps ahead of real time so the 5 s safety timeout fires first.
 // The server session must still end: through the Login hand-off if the direct logout could not finish. (Before the fix the logout was never sent and the session stayed alive.)
 {const ctx=await mk();const p=await ctx.newPage();await signIn(p,A,PA);await go(p,'GaonGreen_Company_Settings_Cloud_Beta.html');await idle(p,29*MIN);await p.click('#gg-idle-stay');await p.waitForTimeout(300);await idle(p,28*MIN);
  const cnt0=(await (await fetch(mock.url+'/__mock/sessions')).json()).count;await fetch(mock.url+'/__mock/latency?ms=300');
  await idle(p,4*MIN);await p.waitForTimeout(3000);await fetch(mock.url+'/__mock/latency?ms=0');await p.waitForTimeout(2500);
  const cnt1=(await (await fetch(mock.url+'/__mock/sessions')).json()).count;const out=!(await inStore(p,'sessionStorage'));const m=await msgOf(p);const pending=await p.evaluate(()=>sessionStorage.getItem('gg-revoke')!==null);
  await t.check('T5c','token near expiry + slow network at the automatic sign-out (safety timeout fires first): the tab is signed out AND the server session ends (direct logout or Login hand-off) - never left alive; no pending hand-off remains',async()=>({ok:out&&/30 minutes/.test(m)&&cnt0-cnt1===1&&!pending,expected:'signed out and revoked',actual:JSON.stringify({signedOut:out,msg:m.slice(0,30),liveSessionsBefore:cnt0,after:cnt1,handoffPending:pending})}));await ctx.close()}
 // activity keeps the session alive
 {const ctx=await mk();const p=await ctx.newPage();await signIn(p,A,PA);await go(p,'GaonGreen_Company_Settings_Cloud_Beta.html');
  for(let i=0;i<4;i++){await idle(p,20*MIN);await p.keyboard.press('Shift');await p.waitForTimeout(200)}const alive=await inStore(p,'sessionStorage');
  await t.check('T4c','continuous activity (a click every 20 minutes, 80 minutes in total) never signs the user out',async()=>({ok:alive,expected:'still signed in',actual:alive}));await ctx.close()}
 // ---------- T7: flush per tool; nothing silently discarded
 for(const [name,page,sel] of TOOLS){const ctx=await mk();const p=await ctx.newPage();await signIn(p,A,PA);await go(p,page);const val='FLUSH-'+name.replace(/\W/g,'').slice(0,8)+'-77';
  const ok=await p.evaluate(sl=>{const e=[...document.querySelectorAll(sl)].find(x=>x.offsetParent!==null&&!x.disabled&&!x.readOnly);return !!e},sel);
  if(ok){const el=(await p.$$(sel))[0];const h=await p.evaluateHandle(sl=>[...document.querySelectorAll(sl)].find(x=>x.offsetParent!==null&&!x.disabled&&!x.readOnly),sel);await h.asElement().fill(val)}
  await p.evaluate(()=>{for(const k of Object.keys(localStorage))if(/^gaongreen-(?!language)/.test(k)&&k.indexOf('::')>0&&!/language/.test(k)&&false)localStorage.removeItem(k)});
  await idle(p,31*MIN);const out=!(await inStore(p,'sessionStorage'));
  await signIn(p,A,PA);const data=await ls(p);const hit=Object.entries(data).filter(([k,v])=>String(v).includes(val)).map(x=>x[0].split('::')[0]);
  const uid=(await sess(p)).uid;const mine=Object.keys(data).filter(k=>String(data[k]).includes(val)).every(k=>k.endsWith('::'+uid));
  await t.check('T7-'+name.replace(/\W+/g,'-'),name+': text typed but not saved by hand survives the idle sign-out (found in this account\'s local data after signing in again; none outside the account namespace)',async()=>({ok:ok&&out&&hit.length>0&&mine,expected:'value preserved under the account namespace',actual:JSON.stringify({fieldFound:ok,signedOut:out,keys:hit,onlyInAccountNamespace:mine})}));
  await ctx.close()}
 // ---------- T7f: what cannot be saved (a chosen file) is named in the warning and on the Login page - never discarded silently
 {const ctx=await mk();const p=await ctx.newPage();await signIn(p,A,PA);await go(p,'GaonGreen_Evidence_Locker_Cloud_Beta.html');await p.setInputFiles('#cloudFile',{name:'evidence-test.pdf',mimeType:'application/pdf',buffer:Buffer.from('x')});
  await idle(p,29*MIN);const lostTxt=await p.evaluate(()=>(document.getElementById('gg-idle-lost')||{}).textContent||'');await idle(p,2*MIN);const m=await msgOf(p);
  await t.check('T7f','Evidence Locker: a chosen file (cannot be kept) is named in the 28-minute warning and in the message shown after the automatic sign-out',async()=>({ok:/evidence-test\.pdf/.test(lostTxt)&&/evidence-test\.pdf/.test(m),expected:'file named twice',actual:JSON.stringify({warning:lostTxt.slice(0,80),login:m.slice(0,160)})}));await ctx.close()}
 // ---------- T8: account switching after an idle sign-out
 {const ctx=await mk();const p=await ctx.newPage();await signIn(p,A,PA);await go(p,'GaonGreen_Company_Settings_Cloud_Beta.html');await p.fill('#company','Fictional A Co (idle)');await idle(p,31*MIN);
  await signIn(p,B,PB);await go(p,'GaonGreen_Company_Settings_Cloud_Beta.html');const bVal=await p.inputValue('#company');await go(p,'GaonGreen_ESG_Dashboard_Cloud_Beta.html');await p.waitForTimeout(700);const dash=await p.evaluate(()=>document.body.innerText);
  const bData=await ls(p);const bLeak=Object.values(bData).some(v=>String(v).includes('Fictional A Co (idle)'))&&Object.keys(bData).some(k=>!/::/.test(k)&&String(bData[k]).includes('Fictional A Co (idle)'));
  await p.goto(s.base+'GaonGreen_Login.html?action=signout');await p.waitForTimeout(800);await signIn(p,A,PA);await go(p,'GaonGreen_Company_Settings_Cloud_Beta.html');const aBack=await p.inputValue('#company');
  await t.check('T8','idle sign-out as A, then B signs in: B sees none of A\'s data (Company Settings, dashboard); A\'s unsaved company name is back when A signs in again',async()=>({ok:bVal===''&&!dash.includes('Fictional A Co (idle)')&&!bLeak&&aBack==='Fictional A Co (idle)',expected:'isolated and restored',actual:JSON.stringify({bEmpty:bVal==='',dashShowsA:dash.includes('Fictional A Co (idle)'),aBack})}));await ctx.close()}
 // ---------- T9: session revoked elsewhere / refresh token no longer valid -> flush + clean end (no silent loss)
 {const ctx=await mk();const p=await ctx.newPage();await signIn(p,A,PA);await go(p,'GaonGreen_Company_Settings_Cloud_Beta.html');await p.fill('#company','Revoked-elsewhere text');const se=await sess(p);
  await fetch(mock.url+'/auth/v1/logout?scope=local',{method:'POST',headers:{authorization:'Bearer '+se.at}});
  for(let i=0;i<3;i++){await idle(p,20*MIN);await p.keyboard.press('Shift')}await idle(p,5*MIN);await p.waitForTimeout(800);
  const url=p.url(),gone=!(await inStore(p,'sessionStorage')),em=await msgOf(p);await signIn(p,A,PA);const data=await ls(p);const kept=Object.values(data).some(v=>String(v).includes('Revoked-elsewhere text'));
  await t.check('T9','an expired/revoked session that the SDK can no longer refresh (active user, token expired 2+ minutes): the tab flushes local edits, removes the dead token and goes to Login with an "ended" message; the edit is still there after signing in again',async()=>({ok:gone&&/GaonGreen_Login\.html/.test(url)&&/ended/.test(em)&&kept,expected:'ended + kept',actual:JSON.stringify({gone,url:url.replace(s.base,''),msg:em.slice(0,40),kept})}));await ctx.close()}
 // ---------- T10: duplicated tab
 {const ctx=await mk();const p1=await ctx.newPage();await signIn(p1,A,PA);await go(p1,'GaonGreen_Company_Settings_Cloud_Beta.html');const d=await p1.evaluate(()=>({a:Object.entries(sessionStorage)}));
  const p2=await ctx.newPage();await p2.addInitScript(x=>{try{if(!sessionStorage.length)x.a.forEach(([k,v])=>sessionStorage.setItem(k,v))}catch(e){}},d);await go(p2,'GaonGreen_Company_Settings_Cloud_Beta.html');
  const both=(await inStore(p1,'sessionStorage'))&&(await inStore(p2,'sessionStorage'));
  await idle(p1,31*MIN);const p1out=!(await inStore(p1,'sessionStorage'));
  await p2.evaluate(()=>{const c=(window.ggClients||[])[0];return c&&c.auth.refreshSession().catch(()=>{})});await p2.waitForTimeout(1500);const p2out=!(await inStore(p2,'sessionStorage'));
  await t.check('T10','duplicated tab: both tabs work; when one idles out and revokes the shared session, the other tab ends cleanly at its next refresh (flush + Login with a reason), never shows another account\'s data',async()=>({ok:both&&p1out&&p2out&&/GaonGreen_Login\.html/.test(p2.url()),expected:'both out cleanly',actual:JSON.stringify({both,p1out,p2out,url:p2.url().replace(s.base,'')})}));await ctx.close()}
 // ---------- T11: cloud save/load still works in session-only mode
 {const ctx=await mk();const p=await ctx.newPage();await signIn(p,A,PA);await go(p,'GaonGreen_Company_Settings_Cloud_Beta.html');p.on('dialog',d=>d.accept());await p.fill('#company','Cloud Co T11');const before=reqs.length;await p.click('#cloudSave');await p.waitForTimeout(1500);
  const post=reqs.slice(before).filter(r=>r.m==='POST'&&/company_profiles/.test(r.p)).length;await p.fill('#company','changed locally');await p.click('#cloudLoad');await p.waitForTimeout(1500);const back=await p.inputValue('#company');
  await t.check('T11','cloud save and cloud load still work with the session-only client (POST to company_profiles; the saved value comes back)',async()=>({ok:post>=1&&back==='Cloud Co T11',expected:'saved and loaded',actual:JSON.stringify({posts:post,back})}));await ctx.close()}
 await s.close();mock.close();fs.rmSync(tmp,{recursive:true,force:true});
 fs.writeFileSync(process.argv[2]||'func-session.json',JSON.stringify({run:new Date().toISOString(),build:'pinned pack (REAL SDK 2.118.0) vs loopback MOCK, fake clock (E2)',results:t.res},null,1));process.exit(t.res.every(x=>x.status==='PASS')?0:1)})().catch(e=>{console.error('ERROR',String(e&&e.stack||e).slice(0,400));process.exit(1)});
