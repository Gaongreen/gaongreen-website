// Regression: browser-local tool data must never cross accounts (reported 2026-11-07: after switching A -> B in one browser the dashboard still showed A's company name from local Company Settings).
// E1: headless Chromium against the offline demo build; sessions are simulated by writing the SAME localStorage record the real supabase-js writes (sb-<ref>-auth-token with user.id). Says nothing about the real project.
const fs=require('fs'),S=require('./lib/serve.js'),T=require('./lib/t.js');const t=T.make();
const A='a0000000-0000-4000-8000-00000000000a',B='b0000000-0000-4000-8000-00000000000b';
const KEYS=['gaongreen-company-settings-v1','gaongreen-epr-scorecard-v1','gaongreen-kre100-helper-v1','gaongreen-kissb-draft-v1','gaongreen-evidence-v1','gaongreen-qr-esg-card-v1','gaongreen-supplier-scan-v1','gaongreen-supplier-draft-v1','gaongreen-evidence-form-v1'];
const PAGES=['GaonGreen_ESG_Dashboard_Cloud_Beta.html','GaonGreen_Company_Settings_Cloud_Beta.html','GaonGreen_KISSB_Cloud_Beta.html','GaonGreen_K-RE100_Cloud_Beta.html','GaonGreen_EPR_Cloud_Beta.html','GaonGreen_Supplier_ESG_Scan_Cloud_Beta.html','GaonGreen_QR_ESG_Card_Cloud_Beta.html','GaonGreen_Evidence_Locker_Cloud_Beta.html'];
const IDB=['gaongreen-epr-backup-v1','gaongreen-evidence-locker-v1'];
const settings=(c)=>JSON.stringify({version:1,company:c,country:'KR',industry:'Manufacturing',currency:'USD',entries:[]});
(async()=>{const s=await S.start('demo');
 const go=async(pg,f)=>{await pg.goto(s.base+f);await pg.waitForTimeout(500)};
 // The "session-changing" page: Login is no-reload, like the real sign-in/out flow. This writes the record the SDK would write.
 const setSession=async(pg,uid)=>{await go(pg,'GaonGreen_Login.html');await pg.evaluate(u=>{for(const k of Object.keys(sessionStorage))if(/^sb-.+-auth-token$/.test(k))sessionStorage.removeItem(k);if(u){sessionStorage.setItem('sb-testref-auth-token',JSON.stringify({access_token:'not-a-real-token',user:{id:u}}));sessionStorage.setItem('gg-last-activity',String(Date.now()))}},uid);await pg.waitForTimeout(150)};
 const writeAll=async(pg,tag)=>pg.evaluate(([ks,tag])=>{ks.forEach(k=>localStorage.setItem(k,k==='gaongreen-company-settings-v1'?tag.settings:'{"owner":"'+tag.name+'","k":"'+k+'"}'))},[KEYS,tag]);
 const readAll=async(pg)=>pg.evaluate(ks=>Object.fromEntries(ks.map(k=>[k,localStorage.getItem(k)])),KEYS);
 const fresh=async()=>{const pg=await s.page();await go(pg,'GaonGreen_Login.html');return pg};
 const dataA={name:'A',settings:settings('Fictional A Co')},dataB={name:'B',settings:settings('Fictional B Co')};
 // ---- I1: the reported scenario, on the real pages
 {const pg=await fresh();await setSession(pg,A);await go(pg,'GaonGreen_Company_Settings_Cloud_Beta.html');await writeAll(pg,dataA);
  await setSession(pg,null);await setSession(pg,B);
  await go(pg,'GaonGreen_Company_Settings_Cloud_Beta.html');const bInput=await pg.inputValue('#company');
  await pg.evaluate(()=>sessionStorage.setItem('gaongreen_demo_v1:signedOut','1'));await go(pg,'GaonGreen_ESG_Dashboard_Cloud_Beta.html');await pg.waitForTimeout(700);const bDash=await pg.textContent('#company');
  await setSession(pg,null);await setSession(pg,A);await go(pg,'GaonGreen_Company_Settings_Cloud_Beta.html');const aInput=await pg.inputValue('#company');await go(pg,'GaonGreen_ESG_Dashboard_Cloud_Beta.html');await pg.waitForTimeout(700);const aDash=await pg.textContent('#company');
  await t.check('I1','reported bug: after A -> B on one browser, B sees neither A\'s company in Company Settings nor on the dashboard; back as A both show "Fictional A Co"',async()=>({ok:bInput===''&&!/Fictional A/.test(bDash)&&aInput==='Fictional A Co'&&/Fictional A Co/.test(aDash),expected:'B empty, A restored',actual:JSON.stringify({bInput,bDash,aInput,aDash})}));await pg.context().close()}
 // ---- I2: every product key, every guarded page, A -> B -> A, byte-for-byte, no mixing
 {const pg=await fresh();await setSession(pg,A);await go(pg,'GaonGreen_Company_Settings_Cloud_Beta.html');await writeAll(pg,dataA);const a0=await readAll(pg);
  const bad=[];await setSession(pg,B);
  for(const f of PAGES){await go(pg,f);const r=await readAll(pg);const leaked=Object.entries(r).filter(([k,v])=>v!==null);if(leaked.length)bad.push(f+' leaked '+leaked.map(x=>x[0]).join(','))}
  await go(pg,'GaonGreen_Company_Settings_Cloud_Beta.html');await writeAll(pg,dataB);const b0=await readAll(pg);
  await setSession(pg,A);await go(pg,'GaonGreen_Company_Settings_Cloud_Beta.html');const a1=await readAll(pg);
  await setSession(pg,B);await go(pg,'GaonGreen_Company_Settings_Cloud_Beta.html');const b1=await readAll(pg);
  await t.check('I2','all 8 product keys: B sees none of A\'s on any of the 8 app pages; A\'s and B\'s data both survive A -> B -> A -> B byte-for-byte with no mixing',async()=>({ok:!bad.length&&JSON.stringify(a1)===JSON.stringify(a0)&&JSON.stringify(b1)===JSON.stringify(b0)&&Object.values(a0).every(v=>v)&&JSON.stringify(a0)!==JSON.stringify(b0),expected:'isolated + preserved',actual:JSON.stringify({bad:bad.slice(0,3),aSame:JSON.stringify(a1)===JSON.stringify(a0),bSame:JSON.stringify(b1)===JSON.stringify(b0)})}));await pg.context().close()}
 // ---- I3: data that predates the guard (raw, unsuffixed key written before the guard existed) is never shown to a signed-in account, and is still there for a signed-out visitor (nothing deleted)
 {const pg=await s.page();await pg.context().addInitScript(([k,v])=>{try{if(!sessionStorage.getItem('seeded')){localStorage.setItem(k,v);sessionStorage.setItem('seeded','1')}}catch(e){}},[KEYS[0],settings('Legacy Co')]);
  await go(pg,'GaonGreen_Login.html');await setSession(pg,B);await go(pg,'GaonGreen_Company_Settings_Cloud_Beta.html');const asB=await pg.inputValue('#company');
  await setSession(pg,null);await go(pg,'GaonGreen_Company_Settings_Cloud_Beta.html');const anon=await pg.inputValue('#company');
  await t.check('I3','legacy (pre-guard) local data is hidden from a signed-in account and still visible when signed out (nothing deleted)',async()=>({ok:asB===''&&anon==='Legacy Co',expected:'B empty, anon Legacy Co',actual:JSON.stringify({asB,anon})}));await pg.context().close()}
 // ---- I4: sign-out hides, sign-in restores
 {const pg=await fresh();await setSession(pg,A);await go(pg,'GaonGreen_Company_Settings_Cloud_Beta.html');await writeAll(pg,dataA);
  await setSession(pg,null);await go(pg,'GaonGreen_Company_Settings_Cloud_Beta.html');const out=await pg.inputValue('#company');
  await setSession(pg,A);await go(pg,'GaonGreen_Company_Settings_Cloud_Beta.html');const back=await pg.inputValue('#company');
  await t.check('I4','after sign-out the previous account\'s data is not shown; signing in again restores it',async()=>({ok:out===''&&back==='Fictional A Co',expected:'hidden then restored',actual:JSON.stringify({out,back})}));await pg.context().close()}
 // ---- I5: sessions are per TAB now. Two tabs signed in as different accounts never mix; and a tab whose own identity changes after it loaded cannot write the old account's edits into the new account's data
 {const pg=await fresh();const ctx=pg.context();const tabA=await ctx.newPage(),tabB=await ctx.newPage();await setSession(tabA,A);await go(tabA,'GaonGreen_Company_Settings_Cloud_Beta.html');await writeAll(tabA,dataA);
  await setSession(tabB,B);await go(tabB,'GaonGreen_Company_Settings_Cloud_Beta.html');const bSees=await readAll(tabB);await writeAll(tabB,dataB);
  const aSees=await readAll(tabA);const bAfter=await readAll(tabB);
  await tabA.evaluate(()=>{window.__asked=0;window.addEventListener('gg-account-changed',e=>{window.__asked++;e.preventDefault()})});
  const swap=await tabA.evaluate(([u,k])=>{const t=Object.keys(sessionStorage).find(x=>/^sb-.+-auth-token$/.test(x));const old=sessionStorage.getItem(t);sessionStorage.setItem(t,JSON.stringify({access_token:'x',user:{id:u}}));localStorage.setItem(k,'{"stale":"A edit"}');const dropped=localStorage.getItem(k);sessionStorage.setItem(t,old);return dropped},[B,KEYS[3]]);
  const asked=await tabA.evaluate(()=>window.__asked);const aBack=await readAll(tabA);
  await t.check('I5','two tabs, two accounts: each sees only its own data (interleaved writes do not mix); a tab whose identity changes after load has the old account\'s late edit dropped and is asked to reload; A\'s data stays intact',async()=>({ok:Object.values(bSees).every(v=>v===null)&&aSees[KEYS[0]]===dataA.settings&&bAfter[KEYS[0]]===dataB.settings&&!/"owner":"B"/.test(JSON.stringify(aSees))&&!/"owner":"A"/.test(JSON.stringify(bAfter))&&swap===null&&asked>=1&&!/stale/.test(JSON.stringify(aBack))&&aBack[KEYS[3]]===JSON.stringify({owner:'A',k:KEYS[3]}),expected:'isolated per tab',actual:JSON.stringify({bNull:Object.values(bSees).every(v=>v===null),aOwn:aSees[KEYS[0]]===dataA.settings,bOwn:bAfter[KEYS[0]]===dataB.settings,swapDropped:swap===null,asked})}));await ctx.close()}
 // ---- I7: IndexedDB data (local Evidence Locker documents, EPR backup) is isolated the same way
 {const pg=await fresh();const idbPut=(name,val)=>pg.evaluate(([n,v])=>new Promise((res,rej)=>{const r=indexedDB.open(n,1);r.onupgradeneeded=()=>r.result.createObjectStore('documents',{keyPath:'id'});r.onsuccess=()=>{const d=r.result;if(v===null){const tx=d.transaction('documents','readonly');const c=tx.objectStore('documents').getAll();c.onsuccess=()=>{d.close();res(c.result.map(x=>x.id))}}else{const tx=d.transaction('documents','readwrite');tx.objectStore('documents').put({id:v});tx.oncomplete=()=>{d.close();res(true)}}};r.onerror=()=>rej(String(r.error))}),[name,val]);
  const NAME='gaongreen-evidence-locker-v1';await setSession(pg,A);await go(pg,'GaonGreen_Evidence_Locker_Cloud_Beta.html');await idbPut(NAME,'doc-of-A');
  await setSession(pg,B);await go(pg,'GaonGreen_Evidence_Locker_Cloud_Beta.html');const bList=await idbPut(NAME,null);await idbPut(NAME,'doc-of-B');
  await setSession(pg,null);await go(pg,'GaonGreen_Evidence_Locker_Cloud_Beta.html');const anonList=await idbPut(NAME,null);
  await setSession(pg,A);await go(pg,'GaonGreen_Evidence_Locker_Cloud_Beta.html');const aList=await idbPut(NAME,null);
  await setSession(pg,B);await go(pg,'GaonGreen_Evidence_Locker_Cloud_Beta.html');const bList2=await idbPut(NAME,null);
  await t.check('I7','IndexedDB (local Evidence Locker documents): B and signed-out see none of A\'s documents; A and B each keep only their own across switches',async()=>({ok:bList.length===0&&anonList.length===0&&JSON.stringify(aList)==='["doc-of-A"]'&&JSON.stringify(bList2)==='["doc-of-B"]',expected:'isolated',actual:JSON.stringify({bList,anonList,aList,bList2})}));await pg.context().close()}
 // ---- I8: rapid session flips in one tab, with another tab signed in as B the whole time, never move, lose or expose data
 {const pg=await fresh();const ctx=pg.context();await setSession(pg,A);await go(pg,'GaonGreen_Company_Settings_Cloud_Beta.html');await writeAll(pg,dataA);const a0=await readAll(pg);
  const tabB=await ctx.newPage();await setSession(tabB,B);await go(tabB,'GaonGreen_Company_Settings_Cloud_Beta.html');await writeAll(tabB,dataB);const b0=await readAll(tabB);
  for(const u of [B,null,A,B,A,null,B,A]){await setSession(pg,u)}
  await setSession(pg,B);await go(pg,'GaonGreen_Company_Settings_Cloud_Beta.html');const bAfter=await readAll(pg);
  await setSession(pg,null);await go(pg,'GaonGreen_Company_Settings_Cloud_Beta.html');const anonAfter=await readAll(pg);
  await setSession(pg,A);await go(pg,'GaonGreen_Company_Settings_Cloud_Beta.html');const aAfter=await readAll(pg);const bTab=await readAll(tabB);
  await t.check('I8','8 rapid sign-in/out flips in one tab with a second tab signed in as B: A\'s and B\'s data intact byte-for-byte, signed-out sees nothing',async()=>({ok:JSON.stringify(aAfter)===JSON.stringify(a0)&&JSON.stringify(bAfter)===JSON.stringify(b0)&&JSON.stringify(bTab)===JSON.stringify(b0)&&Object.values(anonAfter).every(v=>v===null),expected:'all intact',actual:JSON.stringify({aSame:JSON.stringify(aAfter)===JSON.stringify(a0),bSame:JSON.stringify(bAfter)===JSON.stringify(b0),anonEmpty:Object.values(anonAfter).every(v=>v===null)})}));await ctx.close()}
 // ---- I6: static coverage — every account-less storage key used by any page is registered in the guard; every page that touches localStorage loads the guard first
 {const src=fs.readFileSync('gg-account-guard.js','utf8');const reg=KEYS.concat(IDB).every(k=>src.includes("'"+k+"'"));
  const files=fs.readdirSync('.').filter(f=>/\.html$/.test(f)&&!/\.html\.html$/.test(f)&&(/Cloud_Beta|Login|Register|K-ISSB Reporting/.test(f)));const allowed=new Set(KEYS.concat(IDB,['gaongreen-kissb-cloud-resume-v1']));const unreg=new Set(),noGuard=[],late=[];
  for(const f of files){const h=fs.readFileSync(f,'utf8');for(const m of h.matchAll(/gaongreen-[a-z0-9]+(?:-[a-z0-9]+)*-v\d+/g))if(!allowed.has(m[0]))unreg.add(f+':'+m[0]);
   const uses=h.indexOf('localStorage');if(uses>=0){const g=h.indexOf('gg-account-guard.js');if(g<0)noGuard.push(f);else if(g>uses)late.push(f)}}
  const nr=['GaonGreen_Login.html','GaonGreen_Register.html'].every(f=>/<html[^>]*data-gg-guard="no-reload"/.test(fs.readFileSync(f,'utf8')));
  await t.check('I6','every account-less localStorage key in the pages is registered in the guard; every page using localStorage loads the guard first; Login/Register opt out of auto-reload',async()=>({ok:reg&&!unreg.size&&!noGuard.length&&!late.length&&nr&&files.length>=11,expected:'all covered',actual:JSON.stringify({reg,unreg:[...unreg],noGuard,late,nr,files:files.length})}))}
 // ---- I9: static - session-only wiring: every client is created through ggCreateClient (forces sessionStorage), every page that creates one loads gg-auth-config.js and gg-idle.js before it
 {const files=fs.readdirSync('.').filter(f=>/^GaonGreen_.*_Cloud_Beta\.html$|^GaonGreen_(Login|Register)\.html$/.test(f));const bad=[];
  for(const f of files){const h=fs.readFileSync(f,'utf8');const raw=[...h.matchAll(/(?<![A-Za-z.])createClient\(/g)].length+[...h.matchAll(/window\.supabase\.createClient\(/g)].length;const via=[...h.matchAll(/ggCreateClient\(/g)].length;
   const uses=/createClient/.test(h.replace(/ggCreateClient\(|import\s*\{[^}]*\}\s*from[^;\n]*|window\.supabase\?\.createClient|\{createClient\}/g,''));
   if(via>0||/createClient/.test(h)){const iC=h.indexOf('gg-auth-config.js'),iI=h.indexOf('gg-idle.js'),iG=h.indexOf('gg-account-guard.js'),iUse=h.indexOf('ggCreateClient(');if(!(iC>=0&&iI>iC&&iG>iI&&iUse>iG))bad.push(f+': script order');
    const direct=[...h.matchAll(/(?<!gg)(?<![A-Za-z])createClient\(/g)].length+[...h.matchAll(/(?<!\.)window\.supabase\.createClient\((?!\))/g)].length;if(direct)bad.push(f+': direct createClient call x'+direct)}
   if(/persistSession\s*:\s*true/.test(h)&&!/ggCreateClient/.test(h))bad.push(f+': persistSession without ggCreateClient')}
  const cfg=fs.readFileSync('gg-auth-config.js','utf8'),idle=fs.readFileSync('gg-idle.js','utf8');
  await t.check('I9','session-only wiring: every client creation goes through ggCreateClient (storage forced to sessionStorage); pages load gg-auth-config -> gg-idle -> guard before creating a client; idle timeout constants are 30 min / warning 28 min',async()=>({ok:!bad.length&&files.length>=10&&/storage=SS/.test(cfg)&&/IDLE=30\*60000,WARN=28\*60000/.test(idle),expected:'wired',actual:JSON.stringify({bad,files:files.length})}))}
 await s.close();fs.writeFileSync(process.argv[2]||'func-account-isolation.json',JSON.stringify({run:new Date().toISOString(),build:'OFFLINE demo build, simulated sb-*-auth-token sessions (E1)',results:t.res},null,1));process.exit(t.res.every(x=>x.status==='PASS')?0:1)})().catch(e=>{console.error(e);process.exit(1)});
