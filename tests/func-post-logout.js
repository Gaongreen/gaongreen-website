// Post-logout behaviour (reported 2026-11-08 on the private draft): nav reflects auth state (EN/KO/AR), a missing session is a normal signed-out state, Back/Refresh/back-forward-cache restore never show the previous account's information.
// REAL SDK 2.118.0 (pinned build) vs loopback MOCK. E2. Usage: node tests/func-post-logout.js <out.json>
const fs=require('fs'),os=require('os'),path=require('path'),{spawnSync}=require('child_process'),S=require('./lib/serve.js'),T=require('./lib/t.js'),M=require('./rls/mock-supabase.js');const t=T.make();
const HOST='gdmejzbycgpuabvutkdk.supabase.co',PB='mockpass-B-1234';process.env.MOCK_PW_B=PB;process.env.MOCK_PW_A='mockpass-A-1234';
const DASH='GaonGreen_ESG_Dashboard_Cloud_Beta.html',KISSB='GaonGreen_KISSB_Cloud_Beta.html',SET='GaonGreen_Company_Settings_Cloud_Beta.html';
const NAVT={en:{out:'Sign out',inn:'Sign in'},ko:{out:'로그아웃',inn:'로그인'},ar:{out:'تسجيل الخروج',inn:'تسجيل الدخول'}};
(async()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'fpl-')),pack=path.join(tmp,'pk');
 const b=spawnSync('node',['tools/build-pinned.js','--vendor','vendor','--target-url','https://'+HOST,'--target-key','sb_publishable_RV_G9MyL3cRJpl67w6gXUg_BpvFP6x8','--qr','demo/vendor/qrcode-shim.js','--out',pack],{cwd:process.cwd()});
 if(b.status!==0){console.log('BUILD FAILED');process.exit(1)}
 const mock=await M.start('allowlist'),s=await S.start(pack);const reqs=[];
 const mk=async()=>{const ctx=await s.browser.newContext();await ctx.route('**/*',async route=>{const rq=route.request(),u=new URL(rq.url());if(S.isAllowedUrl(rq.url(),s.port))return route.continue();
   if(u.protocol==='https:'&&u.host===HOST){reqs.push(rq.method()+' '+u.pathname);const cors={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*','access-control-expose-headers':'*'};if(rq.method()==='OPTIONS')return route.fulfill({status:204,headers:cors});
    try{const r=await fetch(mock.url+u.pathname+u.search,{method:rq.method(),headers:rq.headers(),body:['GET','HEAD'].includes(rq.method())?undefined:rq.postDataBuffer()});return route.fulfill({status:r.status,headers:{...cors,'content-type':r.headers.get('content-type')||'application/json'},body:Buffer.from(await r.arrayBuffer())})}catch(e){return route.abort()}}route.abort()});return ctx};
 const wait=ms=>new Promise(r=>setTimeout(r,ms));
 const go=async(p,f)=>{await p.goto(s.base+f);await p.waitForTimeout(900)};
 const signIn=async(p,email,pw)=>{await go(p,'GaonGreen_Login.html');await p.fill('#email',email);await p.fill('#password',pw);await p.click('#form button[type=submit]');for(let i=0;i<40;i++){if(await p.evaluate(()=>Object.keys(sessionStorage).some(k=>/^sb-.+-auth-token$/.test(k))))break;await p.waitForTimeout(150)}await p.waitForTimeout(400)};
 const navOf=p=>p.evaluate(()=>{const a=document.querySelector('.gg-nav-out');return a?{text:a.textContent,href:a.getAttribute('href')}:null});
 const body=p=>p.evaluate(()=>document.body.innerText);
 const pp=await (async()=>{const ctx=await mk();const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message.slice(0,100)));return{ctx,p,errs}})();
 const {ctx,p,errs}=pp;
 // R1 nav reflects auth state in all three languages
 await go(p,SET);const outIn=await navOf(p);
 const langRes={};for(const l of ['en','ko','ar']){await p.evaluate(x=>document.documentElement.setAttribute('lang',x),l);await p.waitForTimeout(150);langRes[l]=(await navOf(p)).text}
 await t.check('R1a','signed out: the nav shows "Sign in" (linking to Login) in EN/KO/AR, never "Sign out"',async()=>({ok:outIn&&/GaonGreen_Login\.html$/.test(outIn.href)&&!/action=signout/.test(outIn.href)&&['en','ko','ar'].every(l=>langRes[l]===NAVT[l].inn),expected:'Sign in x3',actual:JSON.stringify({href:outIn&&outIn.href,langRes})}));
 await signIn(p,'b@example.com',PB);await go(p,SET);await p.fill('#company','Private B Co (post-logout)');p.on('dialog',d=>d.accept());await p.click('#cloudSave');await p.waitForTimeout(1500);
 const inNav=await navOf(p);const inLang={};for(const l of ['en','ko','ar']){await p.evaluate(x=>document.documentElement.setAttribute('lang',x),l);await p.waitForTimeout(150);inLang[l]=(await navOf(p)).text}await p.evaluate(()=>document.documentElement.setAttribute('lang','en'));
 await t.check('R1b','signed in: the nav shows "Sign out" (linking to the sign-out action) in EN/KO/AR',async()=>({ok:/action=signout/.test(inNav.href)&&['en','ko','ar'].every(l=>inLang[l]===NAVT[l].out),expected:'Sign out x3',actual:JSON.stringify({href:inNav.href,inLang})}));
 await go(p,DASH);const dashIn=await body(p);
 // R1c the reported sequence
 await p.click('.gg-nav-out');await p.waitForTimeout(1200);const before=reqs.length;
 await p.goBack();await p.waitForTimeout(1000);const back=await navOf(p),backBody=await body(p);await p.reload();await p.waitForTimeout(1000);const ref=await navOf(p),refBody=await body(p);await go(p,DASH);const dNav=await navOf(p),dBody=await body(p);
 const afterReqs=reqs.slice(before);const dataCalls=afterReqs.filter(r=>/\/rest\/v1\//.test(r));
 await t.check('R1c','reported sequence (Sign out -> Back -> Refresh -> Dashboard): the nav says "Sign in" at every step',async()=>({ok:[back,ref,dNav].every(n=>n&&n.text==='Sign in'),expected:'Sign in x3',actual:JSON.stringify({back:back&&back.text,refresh:ref&&ref.text,dashboard:dNav&&dNav.text})}));
 await t.check('R2','missing session is a normal signed-out state: the Dashboard shows "Not signed in", NOT "Auth session missing"/"Could not load", makes no cloud data request, and shows none of B\'s e-mail or profile',async()=>({ok:/Not signed in/i.test(dBody)&&!/Auth session missing|Could not load/i.test(dBody)&&dataCalls.length===0&&![backBody,refBody,dBody].some(x=>/b@example\.com|Private B Co/.test(x))&&/b@example\.com/.test(dashIn),expected:'signed-out state, no B info',actual:JSON.stringify({notSignedIn:/Not signed in/i.test(dBody),error:/Auth session missing|Could not load/i.test(dBody),dataCalls:dataCalls.length,bVisible:[backBody,refBody,dBody].map(x=>/b@example\.com|Private B Co/.test(x)),wasSignedInShowingB:/b@example\.com/.test(dashIn)})}));
 // R3 KISSB, no application error for a missing session
 await go(p,KISSB);await p.waitForTimeout(800);const kb=await body(p);
 await t.check('R3','K-ISSB with no session: no "Auth session missing" error, no uncaught error, none of B\'s information',async()=>({ok:!/Auth session missing/i.test(kb)&&!errs.length&&!/b@example\.com|Private B Co/.test(kb),expected:'clean signed-out page',actual:JSON.stringify({error:/Auth session missing/i.test(kb),pageErrors:errs.slice(0,2),bVisible:/b@example\.com|Private B Co/.test(kb)})}));
 // R4 simulated back/forward-cache restore
 await signIn(p,'b@example.com',PB);await go(p,DASH);await p.evaluate(()=>{window.__marker='old-page'});const signedInShowing=/b@example\.com/.test(await body(p));
 await p.evaluate(()=>{for(const k of Object.keys(sessionStorage))if(/^sb-.+-auth-token$/.test(k)||k==='gg-last-activity')sessionStorage.removeItem(k)}); // the session ended while this page sat in the cache
 await p.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));await p.waitForTimeout(1500);
 const reloaded=await p.evaluate(()=>window.__marker===undefined),after=await body(p),navAfter=await navOf(p);
 await t.check('R4a','back/forward-cache restore after the session ended: the page reloads (no stale signed-in DOM), shows the signed-out state and nothing of B',async()=>({ok:signedInShowing&&reloaded&&!/b@example\.com|Private B Co/.test(after)&&navAfter.text==='Sign in',expected:'reloaded, signed-out',actual:JSON.stringify({signedInShowing,reloaded,bVisible:/b@example\.com|Private B Co/.test(after),nav:navAfter&&navAfter.text})}));
 // reverse: page cached while signed out, user signs in elsewhere in the tab, then restore
 await go(p,DASH);await p.evaluate(()=>{window.__marker='old-signed-out'});const p2=await ctx.newPage();await signIn(p2,'a@example.com','mockpass-A-1234');const tok=await p2.evaluate(()=>Object.entries(sessionStorage));await p2.close();
 await p.evaluate(a=>{a.forEach(([k,v])=>sessionStorage.setItem(k,v))},tok);await p.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));await p.waitForTimeout(1500);
 const reloaded2=await p.evaluate(()=>window.__marker===undefined),nav2=await navOf(p);
 await t.check('R4b','back/forward-cache restore when a session now exists: the page reloads and the nav shows "Sign out" (no stale signed-out state either)',async()=>({ok:reloaded2&&nav2&&nav2.text==='Sign out',expected:'reloaded, signed in',actual:JSON.stringify({reloaded2,nav:nav2&&nav2.text})}));
 // R4c no reload loop / no reload when nothing changed
 await go(p,DASH);await p.evaluate(()=>{window.__marker='same'});await p.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));await p.waitForTimeout(900);const same=await p.evaluate(()=>window.__marker==='same');
 await t.check('R4c','a restore with an unchanged sign-in state does NOT reload the page (no loops, no lost typing)',async()=>({ok:same,expected:'no reload',actual:same}));
 // R5 the nav follows an in-tab sign-in / sign-out without navigation (gg-auth-state / focus)
 await go(p,SET);await p.evaluate(()=>{for(const k of Object.keys(sessionStorage))if(/^sb-/.test(k))sessionStorage.removeItem(k)});await p.evaluate(()=>window.dispatchEvent(new Event('focus')));const n0=await navOf(p);
 await signIn(p,'b@example.com',PB);await go(p,SET);const n1=await navOf(p);
 await t.check('R5','the nav switches between "Sign in" and "Sign out" as the tab\'s session appears/disappears',async()=>({ok:n0.text==='Sign in'&&n1.text==='Sign out',expected:'Sign in -> Sign out',actual:JSON.stringify({before:n0.text,after:n1.text})}));
 await ctx.close();await s.close();mock.close();fs.rmSync(tmp,{recursive:true,force:true});
 fs.writeFileSync(process.argv[2]||'func-post-logout.json',JSON.stringify({run:new Date().toISOString(),build:'pinned pack (REAL SDK 2.118.0) vs loopback MOCK (E2)',results:t.res},null,1));process.exit(t.res.every(x=>x.status==='PASS')?0:1)})().catch(e=>{console.error('ERROR',String(e&&e.stack||e).slice(0,400));process.exit(1)});
