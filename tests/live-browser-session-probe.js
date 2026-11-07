// SESSION PROBE (investigation only; the pages are NOT modified and no session change is implemented).
// Measures how the real SDK + real Auth behave under today's persistent sessions vs a session-only (sessionStorage) client, for the proposal in docs/SESSION_DESIGN.md.
// "session mode" is simulated per browser context by an init script that wraps supabase.createClient to pass auth.storage=sessionStorage. Pages stay byte-identical.
//   GG_LIVE_MODE=staging: real staging project (E5).  GG_LIVE_MODE=mock: loopback mock with session/refresh/logout semantics (E2, validates the script only).
// Usage: node tests/live-browser-session-probe.js <out.json> <pinned-dir>   env: A_EMAIL A_PASSWORD [MOCK_URL] [WAIT_MS reuse wait, default 12000]
// Results: PASS/FAIL for safety assertions; INFO for observations the decision depends on. Only booleans, status codes and 8-char ids are recorded. Never a password, token or refresh token.
// Cloud writes: none (sign-in/refresh/sign-out are Auth calls; data calls are SELECTs on the signed-in user's own rows).
const fs=require('fs'),S=require('./lib/serve.js'),T=require('./lib/t.js');const t=T.make();
const MODE=process.env.GG_LIVE_MODE||'staging',STAGING='https://gdmejzbycgpuabvutkdk.supabase.co',STAGING_HOST='gdmejzbycgpuabvutkdk.supabase.co',KEY='sb_publishable_RV_G9MyL3cRJpl67w6gXUg_BpvFP6x8';
const AE=process.env.A_EMAIL,AP=process.env.A_PASSWORD,WAIT=Number(process.env.WAIT_MS||12000);
const out=process.argv[2]||'live-browser-session-probe.json',dir=process.argv[3]||'dist-live-pinned';
if(!AE||!AP){console.log('REFUSED: A_EMAIL and A_PASSWORD must be set in the environment.');process.exit(2)}
if(!/@example\.(test|com)$/.test(AE)){console.log('REFUSED: only fictional example.* accounts may be used.');process.exit(2)}
if(MODE!=='staging'&&MODE!=='mock'){console.log('REFUSED: GG_LIVE_MODE must be staging or mock.');process.exit(2)}
if(MODE==='mock'&&!/^http:\/\/127\.0\.0\.1:\d+$/.test(process.env.MOCK_URL||'')){console.log('REFUSED: mock mode needs MOCK_URL.');process.exit(2)}
const API=MODE==='staging'?STAGING:process.env.MOCK_URL;
const info=(id,name,actual)=>{t.res.push({id,name,status:'INFO',expected:'observation',actual:JSON.stringify(actual)});console.log('INFO '+id+' '+name+'  '+JSON.stringify(actual))};
const short=s=>String(s||'').slice(0,8);
const WRAP=(session)=>`(function(){var s;Object.defineProperty(window,'supabase',{configurable:true,get:function(){return s},set:function(v){if(v&&typeof v.createClient==='function'&&!v.__ggw){var o=v.createClient;v=Object.assign({},v,{__ggw:1,createClient:function(u,k,op){op=op||{};${session?"op.auth=Object.assign({},op.auth,{storage:window.sessionStorage});":""}var c=o.call(v,u,k,op);(window.__gg=window.__gg||[]).push(c);return c}})}s=v}})})();`;
(async()=>{
 const s=await S.start(dir);const writes=[],blocked=[];
 const mk=async(session,state)=>{const ctx=await s.browser.newContext(state?{storageState:state}:{});await ctx.addInitScript(WRAP(session));
  await ctx.route('**/*',async route=>{const rq=route.request(),u=new URL(rq.url());if(S.isAllowedUrl(rq.url(),s.port))return route.continue();
   if(u.protocol==='https:'&&u.host===STAGING_HOST){if(!['GET','HEAD','OPTIONS'].includes(rq.method())&&!/^\/auth\/v1\//.test(u.pathname))writes.push(rq.method()+' '+u.pathname.slice(0,40));
    if(MODE==='staging')return route.continue();const cors={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*','access-control-expose-headers':'*'};
    if(rq.method()==='OPTIONS')return route.fulfill({status:204,headers:cors});
    try{const r=await fetch(process.env.MOCK_URL+u.pathname+u.search,{method:rq.method(),headers:rq.headers(),body:['GET','HEAD'].includes(rq.method())?undefined:rq.postDataBuffer()});return route.fulfill({status:r.status,headers:{...cors,'content-type':r.headers.get('content-type')||'application/json'},body:Buffer.from(await r.arrayBuffer())})}catch(e){return route.abort()}}
   blocked.push(u.host.slice(0,60));route.abort()});return ctx};
 const go=async(p,f)=>{await p.goto(s.base+f);await p.waitForTimeout(600)};
 const tok=(p,store)=>p.evaluate(st=>{const S=window[st];for(const k of Object.keys(S))if(/^sb-.+-auth-token$/.test(k))return true;return false},store);
 const getSess=(p,store)=>p.evaluate(st=>{const S=window[st];for(const k of Object.keys(S))if(/^sb-.+-auth-token$/.test(k)){try{const j=JSON.parse(S.getItem(k));return{k,v:S.getItem(k),rt:j.refresh_token,at:j.access_token}}catch(e){}}return null},store);
 const signIn=async(p)=>{await go(p,'GaonGreen_Login.html');await p.fill('#email',AE);await p.fill('#password',AP);await p.click('#form button[type=submit]');for(let i=0;i<40;i++){if(await p.evaluate(()=>Object.keys(localStorage).concat(Object.keys(sessionStorage)).some(k=>/^sb-.+-auth-token$/.test(k))))break;await p.waitForTimeout(250)}await p.waitForTimeout(500)};
 // helpers executed in the page against the SDK client created by the Login page
 const user=p=>p.evaluate(async()=>{const c=window.__gg&&window.__gg[0];if(!c)return{noClient:true};const r=await c.auth.getUser();return{ok:!!(r.data&&r.data.user),err:r.error&&(r.error.status||r.error.name)}});
 const cloudRead=p=>p.evaluate(async()=>{const c=window.__gg&&window.__gg[0];if(!c)return{noClient:true};const r=await c.from('company_profiles').select('owner_id').limit(1);return{ok:!r.error,err:r.error&&(r.error.code||r.error.message||'').slice(0,40)}});
 const refresh=p=>p.evaluate(async()=>{const c=window.__gg&&window.__gg[0];const r=await c.auth.refreshSession();return{ok:!!(r.data&&r.data.session),err:r.error&&((r.error.code||r.error.name||'')+':'+(r.error.status||'')).slice(0,60)}});
 const j=async(path,hdr,method,body)=>{const r=await fetch(API+path,{method:method||'GET',headers:{apikey:KEY,'content-type':'application/json',...hdr},body:body?JSON.stringify(body):undefined});return r.status};

 // ---------- P1: today's persistent mode: does the session survive a browser restart?
 const cP=await mk(false);const p1=await cP.newPage();await signIn(p1);
 const inLocal=await tok(p1,'localStorage'),inSess=await tok(p1,'sessionStorage');
 const state=await cP.storageState();const cP2=await mk(false,state);const p1b=await cP2.newPage();await go(p1b,'GaonGreen_Login.html');await p1b.waitForTimeout(800);const restart=await user(p1b);
 info('P1','PERSISTENT mode (today): token location and survival of a "browser restart" (new context seeded with the saved localStorage)',{tokenInLocalStorage:inLocal,tokenInSessionStorage:inSess,signedInAfterRestart:restart.ok===true});
 await t.check('P1a','persistent mode stores the real session in localStorage (confirms current behaviour)',async()=>({ok:inLocal&&!inSess,expected:'localStorage only',actual:JSON.stringify({inLocal,inSess})}));
 try{await p1.evaluate(()=>window.__gg[0].auth.signOut({scope:'local'}))}catch(e){}await cP.close();
 try{await p1b.evaluate(()=>window.__gg[0].auth.signOut({scope:'local'}))}catch(e){}await cP2.close();

 // ---------- P2: session-only mode
 const cS=await mk(true);const p2=await cS.newPage();await signIn(p2);
 const sl=await tok(p2,'localStorage'),ss=await tok(p2,'sessionStorage');
 await p2.reload();await p2.waitForTimeout(800);const afterReload=await user(p2);const read=await cloudRead(p2);
 await t.check('P2a','session-only mode: the session is in sessionStorage and NOT in localStorage; a page reload keeps the user signed in; an authenticated cloud read works',async()=>({ok:!sl&&ss&&afterReload.ok===true&&read.ok===true,expected:'session-only, reload ok, read ok',actual:JSON.stringify({inLocal:sl,inSession:ss,reloadUser:afterReload,cloudRead:read})}));
 const cFresh=await mk(true);const pf=await cFresh.newPage();await go(pf,'GaonGreen_Login.html');await pf.waitForTimeout(800);const fresh=await user(pf);
 await t.check('P2b','a brand-new browser context (browser closed and reopened normally) has NO session in session-only mode',async()=>({ok:fresh.ok!==true&&!(await tok(pf,'localStorage'))&&!(await tok(pf,'sessionStorage')),expected:'signed out',actual:JSON.stringify(fresh)}));
 await cFresh.close();
 // guard interaction: unmodified guard reads localStorage only
 const guardU=await p2.evaluate(()=>window.ggAccountGuard&&window.ggAccountGuard.sessionUser());
 info('P2c','UNMODIFIED guard under session-only storage: does it still see the user? (if null, local data would fall into the anonymous namespace; the guard MUST be changed together with the storage)',{guardSeesUser:!!guardU});
 // session restore simulation: seed another context's sessionStorage with the dump (what "reopen closed tab"/session-restore does)
 const dump=await getSess(p2,'sessionStorage');
 const cR=await mk(true);await cR.addInitScript(d=>{try{if(d&&!sessionStorage.getItem(d.k))sessionStorage.setItem(d.k,d.v)}catch(e){}},dump&&{k:dump.k,v:dump.v});const pr=await cR.newPage();await go(pr,'GaonGreen_Login.html');await pr.waitForTimeout(800);const restored=await user(pr);
 info('P3','RESTORED session-only tab (sessionStorage restored by the browser): is the session usable? (yes = closing the browser is not a guarantee; only the lastActivity timestamp bounds it)',{usableAfterRestore:restored.ok===true});
 await cR.close();

 // ---------- P4: token refresh
 const before=await getSess(p2,'sessionStorage');const rf=await refresh(p2);const after=await getSess(p2,'sessionStorage');const read2=await cloudRead(p2);
 await t.check('P4','token refresh in session-only mode: refresh succeeds, the refresh token rotates, and cloud reads still work afterwards',async()=>({ok:rf.ok===true&&!!before&&!!after&&before.rt!==after.rt&&read2.ok===true,expected:'rotated, read ok',actual:JSON.stringify({refresh:rf,rotated:!!(before&&after&&before.rt!==after.rt),read:read2})}));

 // ---------- P5: sign-out (local scope) revokes THIS session on the server; access token lifetime after sign-out
 const cur=await getSess(p2,'sessionStorage');const RT=cur.rt,AT=cur.at;
 await p2.evaluate(()=>window.__gg[0].auth.signOut({scope:'local'}));await p2.waitForTimeout(800);
 const refreshAfter=await j('/auth/v1/token?grant_type=refresh_token',{},'POST',{refresh_token:RT});
 const userAfter=await j('/auth/v1/user',{authorization:'Bearer '+AT});
 const restAfter=await j('/rest/v1/company_profiles?select=owner_id&limit=1',{authorization:'Bearer '+AT});
 await t.check('P5a','signOut({scope:"local"}) revokes the session on the server: the old refresh token is rejected (4xx) and the old access token no longer passes Auth /user',async()=>({ok:refreshAfter>=400&&refreshAfter<500&&(userAfter===401||userAfter===403),expected:'refresh 4xx, /user 401/403',actual:JSON.stringify({refreshWithOldToken:refreshAfter,authUserWithOldAccessToken:userAfter})}));
 info('P5b','after sign-out the OLD ACCESS TOKEN against the data API (JWT valid until its exp; 200 = still accepted by the data API until expiry, which is why a shorter JWT expiry is the only server-side bound on Free)',{dataApiStatusWithOldAccessToken:restAfter});
 await cS.close();

 // ---------- P6: unsaved work
 const cU=await mk(true);const pu=await cU.newPage();await signIn(pu);await go(pu,'GaonGreen_Company_Settings_Cloud_Beta.html');
 await pu.fill('#company','UNSAVED probe text');await pu.waitForTimeout(2500);
 const autosaved=await pu.evaluate(()=>{for(const k of Object.keys(localStorage))if(/company-settings/.test(k)&&String(localStorage.getItem(k)).includes('UNSAVED probe text'))return true;return false});
 await go(pu,'GaonGreen_Login.html?action=signout');await pu.waitForTimeout(1200);await signIn(pu);await go(pu,'GaonGreen_Company_Settings_Cloud_Beta.html');const back=await pu.inputValue('#company');
 info('P6','UNSAVED work today: text typed in Company Settings but not saved (Save not clicked) - autosaved locally after 2.5 s? and still present after sign-out + sign-in? (false/false = an idle sign-out would lose it unless the idle handler first flushes edits; this is a REQUIREMENT for the design)',{autosavedLocally:autosaved,presentAfterReLogin:back==='UNSAVED probe text'});
 try{await pu.evaluate(()=>window.__gg[0].auth.signOut({scope:'local'}))}catch(e){}await cU.close();

 // ---------- P7: multiple tabs
 const cT=await mk(true);const t1=await cT.newPage();await signIn(t1);const t2=await cT.newPage();await go(t2,'GaonGreen_Login.html');await t2.waitForTimeout(800);const newTab=await user(t2);
 info('P7a','NEW TAB (same window, session-only): is it signed in? (false = login friction: every new tab asks for sign-in)',{signedInInNewTab:newTab.ok===true});
 // Duplicate-tab simulation, scenario X: refresh in both copies WITHIN the reuse window
 const d1=await getSess(t1,'sessionStorage');const t3=await cT.newPage();await t3.addInitScript(d=>{try{if(d&&!sessionStorage.getItem(d.k))sessionStorage.setItem(d.k,d.v)}catch(e){}},{k:d1.k,v:d1.v});await go(t3,'GaonGreen_Login.html');await t3.waitForTimeout(800);
 const rx1=await refresh(t1),rx2=await refresh(t3),rx3=await refresh(t1),rx4=await refresh(t3);
 info('P7b','DUPLICATED tab, both tabs refresh inside the reuse window (t1,t3,t1,t3)',{results:[rx1.ok,rx2.ok,rx3.ok,rx4.ok],errors:[rx1.err,rx2.err,rx3.err,rx4.err].filter(Boolean)});
 try{await t1.evaluate(()=>window.__gg[0].auth.signOut({scope:'local'}))}catch(e){}try{await t3.evaluate(()=>window.__gg[0].auth.signOut({scope:'local'}))}catch(e){}await cT.close();
 // scenario Y: copy, one tab refreshes, wait past the reuse window, the other (stale) copy refreshes with the OLD refresh token
 const cY=await mk(true);const y1=await cY.newPage();await signIn(y1);const dy=await getSess(y1,'sessionStorage');const y2=await cY.newPage();await y2.addInitScript(d=>{try{if(d&&!sessionStorage.getItem(d.k))sessionStorage.setItem(d.k,d.v)}catch(e){}},{k:dy.k,v:dy.v});await go(y2,'GaonGreen_Login.html');await y2.waitForTimeout(800);
 const ry1=await refresh(y1);await y1.waitForTimeout(WAIT);const ry2=await refresh(y2);const ry3=await refresh(y1);const uy1=await user(y1);
 info('P7c','DUPLICATED tab, stale copy refreshes AFTER the reuse window (y1 refresh; wait; y2 refresh with the OLD refresh token; y1 refresh again; y1 getUser). A failed y1 means reuse detection revoked BOTH tabs.',{y1First:ry1.ok,staleCopy:ry2.ok,staleErr:ry2.err||null,y1Second:ry3.ok,y1UserStillSignedIn:uy1.ok===true,waitMs:WAIT});
 try{await y1.evaluate(()=>window.__gg[0].auth.signOut({scope:'local'}))}catch(e){}await cY.close();

 await t.check('P8','the probe wrote nothing to the cloud and contacted no host other than 127.0.0.1 and the staging project',async()=>({ok:!writes.length&&!blocked.length,expected:'0/0',actual:JSON.stringify({writes,blocked:[...new Set(blocked)]})}));
 await s.close();
 const build=MODE==='staging'?'REAL SDK + REAL STAGING Auth/Data, session-only simulated by an init script (E5); pages unmodified':'REAL SDK vs loopback MOCK (E2): validates this script only';
 fs.writeFileSync(out,JSON.stringify({run:new Date().toISOString(),mode:MODE,build,results:t.res},null,1));process.exit(t.res.every(x=>x.status!=='FAIL')?0:1)})().catch(e=>{console.error('ERROR',String(e&&e.message||e).replace(/\n.*/s,'').slice(0,240));process.exit(1)});
