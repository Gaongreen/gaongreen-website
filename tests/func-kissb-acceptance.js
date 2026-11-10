// K-ISSB customer-demo ACCEPTANCE checks on the OFFLINE DEMO build. Fictional data and fictional user ids only; no Supabase, no network.
// Sessions are simulated exactly like tests/func-account-isolation.js (the sessionStorage record supabase-js writes), so this proves the
// browser-side scoping only, not the real auth service.
const S=require('./lib/serve.js'),T=require('./lib/t.js'),fs=require('fs'),os=require('os'),path=require('path');
const A='a0000000-0000-4000-8000-0000000000a1',B='b0000000-0000-4000-8000-0000000000b2';
const KEY='gaongreen-evidence-v1',W='GaonGreen_KISSB_Cloud_Beta.html';
const DEF=[['name','industry','year'],['rev'],['elec'],['renew'],['fuel'],['s1','s2','ef'],['water'],['waste','rec'],['emp','fem','left'],['inj'],['governance'],['strategy','risk'],['targets']];
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kissb-acc-'));
(async()=>{const s=await S.start('demo'),t=T.make();
 const pg=await s.page();let reply=true;const dialogs=[];pg.on('dialog',d=>{dialogs.push(d.message());reply?d.accept():d.dismiss()});
 const go=async f=>{await pg.goto(s.base+f);await pg.waitForTimeout(600)};
 const setSession=async uid=>{await go('GaonGreen_Login.html');await pg.evaluate(u=>{for(const k of Object.keys(sessionStorage))if(/^sb-.+-auth-token$/.test(k))sessionStorage.removeItem(k);if(u){sessionStorage.setItem('sb-testref-auth-token',JSON.stringify({access_token:'not-a-real-token',user:{id:u}}));sessionStorage.setItem('gg-last-activity',String(Date.now()))}},uid);await pg.waitForTimeout(150)};
 const wiz=async()=>{await go(W);await pg.waitForTimeout(300)};
 const links=()=>pg.evaluate(()=>window.ggEvidenceStore.ANSWERS.reduce((o,id)=>{const e=window.ggEvidenceStore.evidenceFor(id);if(e.length)o[id]=e;return o},{}));
 const statuses=()=>pg.evaluate(()=>[...document.querySelectorAll('#ggEvidence select[data-kind="status"]')].map(x=>+x.value));
 const refs=()=>pg.evaluate(()=>[...document.querySelectorAll('#ggEvidence input[data-kind="reference"]')].map(x=>x.value));
 const raw=()=>pg.evaluate(k=>Object.keys(localStorage).filter(x=>x.startsWith(k)).sort().reduce((o,x)=>(o[x]=localStorage.getItem(x),o),{}),KEY);
 const custom=()=>pg.evaluate(()=>!window.ggEvidenceStore.isDefault());
 const ev=(i,v)=>pg.locator('#ggEvidence select[data-evidence="'+i+'"][data-kind="status"]').selectOption(String(v));
 const ref=(i,v)=>pg.locator('#ggEvidence input[data-evidence="'+i+'"][data-kind="reference"]').fill(v);
 const importFile=async(name,content)=>{const f=path.join(tmp,name);fs.writeFileSync(f,content);dialogs.length=0;await pg.setInputFiles('#ggEvidenceFile',f);await pg.waitForTimeout(300);return (await pg.locator('#ggEvidenceStatus').innerText())};
 const exportBackup=async()=>{const [d]=await Promise.all([pg.waitForEvent('download'),pg.click('#ggEvidenceExport')]);const f=path.join(tmp,'export-'+Date.now()+'.json');await d.saveAs(f);return fs.readFileSync(f,'utf8')};
 const defLinks=()=>{const o={};DEF.forEach((a,i)=>a.forEach(id=>(o[id]=o[id]||[]).push(i)));return o};
 // canonical JSON (sorted object keys) so equal link maps compare equal whatever their key order
 const J=v=>JSON.stringify(v,(k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.keys(x).sort().reduce((o,kk)=>(o[kk]=x[kk],o),{}):x);

 // ---------- account isolation of evidence + links (fictional A, B, signed-out) ----------
 await setSession(A);await wiz();
 await pg.evaluate(()=>{const S=window.ggEvidenceStore;S.setLink('s1',4,true);S.setLink('renew',2,true);S.setLink('targets',12,false)});
 await ev(4,1);await ref(4,'A_fuel_DEMO.xlsx');await pg.waitForTimeout(150);const aLinks=await links(),aSt=await statuses();
 await pg.reload();await pg.waitForTimeout(800);
 await t.check('AC1','account A: custom links, statuses and references survive a page reload',async()=>({ok:J(await links())===J(aLinks)&&J(await statuses())===J(aSt)&&(await refs())[4]==='A_fuel_DEMO.xlsx'&&aLinks.s1.join()==='4,5'&&!aLinks.targets,expected:'same after reload',actual:J(await links()).slice(0,120)}));
 await setSession(B);await wiz();
 {const txt=await pg.locator('body').innerText();await t.check('AC2','switch to account B: B sees the suggested links and empty statuses; none of A\'s links or references are visible anywhere on the page',async()=>({ok:J(await links())===J(defLinks())&&(await statuses()).every(x=>x===0)&&!txt.includes('A_fuel_DEMO')&&!(await custom()),expected:'defaults, nothing of A',actual:J({custom:await custom(),aRefVisible:txt.includes('A_fuel_DEMO')})}))}
 await pg.evaluate(()=>window.ggEvidenceStore.setLink('governance',12,true));await ev(10,3);await pg.waitForTimeout(150);const bLinks=await links();
 await setSession(A);await wiz();
 await t.check('AC3','back to account A: A\'s own links are intact and B\'s change (governance -> targets record) did not leak in',async()=>({ok:J(await links())===J(aLinks)&&(await statuses())[10]===0,expected:'A unchanged',actual:J((await links()).governance)}));
 await setSession(null);await wiz();
 {const txt=await pg.locator('body').innerText();await t.check('AC4','signed out: neither A\'s nor B\'s evidence or links are visible (suggested links, empty statuses)',async()=>({ok:J(await links())===J(defLinks())&&(await statuses()).every(x=>x===0)&&!txt.includes('A_fuel_DEMO'),expected:'defaults',actual:J({custom:await custom()})}))}
 {const r=await raw();const ka=r[KEY+'::'+A],kb=r[KEY+'::'+B];
  await t.check('AC5','storage: links live inside each account\'s own scoped record (gaongreen-evidence-v1::<user id>); no shared/unscoped copy holds A\'s or B\'s links; no new storage key',async()=>({ok:!!ka&&!!kb&&JSON.parse(ka)[4].answers.includes('s1')&&JSON.parse(kb)[12].answers.includes('governance')&&!JSON.parse(ka)[12].answers.includes('governance')&&!(r[KEY]||'').includes('A_fuel_DEMO')&&Object.keys(r).every(k=>k===KEY||k===KEY+'::'+A||k===KEY+'::'+B||k===KEY+'::anon'),expected:'scoped',actual:Object.keys(r).join(', ')}))}
 // stale tab: page loaded as A, the browser session becomes B (e.g. sign-in in another tab); a link edit made on the stale page must not be written to A or B
 await setSession(A);await wiz();
 {await pg.evaluate(u=>{for(const k of Object.keys(sessionStorage))if(/^sb-.+-auth-token$/.test(k))sessionStorage.removeItem(k);sessionStorage.setItem('sb-testref-auth-token',JSON.stringify({access_token:'not-a-real-token',user:{id:u}}))},B);
  await pg.evaluate(()=>{try{window.ggEvidenceStore.setLink('fuel',0,true)}catch(e){}});await pg.waitForTimeout(1500);
  const r=await raw();const fuelA=JSON.parse(r[KEY+'::'+A])[0].answers.includes('fuel'),fuelB=JSON.parse(r[KEY+'::'+B])[0].answers.includes('fuel');const nowB=J(await links())===J(bLinks);
  await t.check('AC6','stale tab: a link edit made after the session switched from A to B is dropped (written to neither account) and the page reloads showing B\'s data',async()=>({ok:!fuelA&&!fuelB&&nowB,expected:'dropped, B shown',actual:J({fuelA,fuelB,nowB})}))}

 // ---------- backup & restore (as B) ----------
 await setSession(B);await wiz();
 const bk=await exportBackup();const bo=JSON.parse(bk);
 await t.check('BK1','backup export contains type/version 1, all 13 records with status, reference and their linked answers (B\'s custom link included)',async()=>({ok:bo.type==='GaonGreenEvidence'&&bo.version===1&&bo.data.length===13&&bo.data[12].answers.includes('governance')&&bo.data[10].status===3,expected:'links in backup',actual:J(bo.data[12])}));
 // clear: warning names what will be reset; cancelling changes nothing
 reply=false;dialogs.length=0;await pg.click('#ggEvidenceClear');await pg.waitForTimeout(200);
 await t.check('BK2','"Clear evidence checklist" with custom links: the confirmation states that statuses, references AND the custom link changes will be reset (with the count) and answers are kept; Cancel changes nothing',async()=>({ok:dialogs.length===1&&/resets your 1 custom answer–evidence link change/.test(dialogs[0])&&/questionnaire answers are not changed/.test(dialogs[0])&&J(await links())===J(bLinks)&&(await statuses())[10]===3,expected:'warned, unchanged',actual:dialogs[0]}));
 reply=true;dialogs.length=0;await pg.click('#ggEvidenceClear');await pg.waitForTimeout(200);
 await t.check('BK3','confirming the clear resets statuses and links to the suggested defaults',async()=>({ok:J(await links())===J(defLinks())&&(await statuses()).every(x=>x===0),expected:'defaults',actual:J(await custom())}));
 dialogs.length=0;await pg.click('#ggEvidenceClear');await pg.waitForTimeout(150);
 await t.check('BK4','clear with suggested links only: the confirmation says the links are already the suggested ones (no false warning)',async()=>({ok:dialogs.length===1&&/already the suggested links/.test(dialogs[0]),expected:'plain warning',actual:dialogs[0]}));
 {const m=await importFile('roundtrip.json',bk);await t.check('BK5','restoring the exported backup brings back every link, status and reference exactly; message says links were restored',async()=>({ok:J(await links())===J(bLinks)&&(await statuses())[10]===3&&/including answer–evidence links/.test(m)&&dialogs.length===0,expected:'identical',actual:m}))}
 // pre-Phase-2 backup = version 1 records without "answers"
 const legacy=J({type:'GaonGreenEvidence',version:1,data:bo.data.map((x,i)=>({status:i===2?1:0,reference:i===2?'OLD_bills.pdf':''}))});
 reply=false;{const before=await links();const m=await importFile('legacy.json',legacy);
  await t.check('BK6','older (pre-Phase-2) backup while custom links exist: the user is asked first, the message explains the backup has no links and N custom changes would be reset; Cancel keeps everything',async()=>({ok:dialogs.length===1&&/made before answer–evidence links existed/.test(dialogs[0])&&/resets your 1 custom/.test(dialogs[0])&&/Restore cancelled/.test(m)&&J(await links())===J(before)&&(await statuses())[10]===3,expected:'asked, unchanged',actual:dialogs[0]+' | '+m}))}
 reply=true;{const m=await importFile('legacy.json',legacy);
  await t.check('BK7','older backup accepted after confirmation: statuses and references restored, suggested links applied, and the message says so',async()=>({ok:J(await links())===J(defLinks())&&(await statuses())[2]===1&&(await refs())[2]==='OLD_bills.pdf'&&/Older evidence backup restored/.test(m),expected:'restored + defaults',actual:m}))}
 {const m=await importFile('legacy2.json',legacy);await t.check('BK8','older backup when links are already the suggested ones: restored without an unnecessary question',async()=>({ok:dialogs.length===0&&/Older evidence backup restored/.test(m),expected:'no dialog',actual:m}))}
 // a REAL backup produced by the previous wizard page (no link support) still in the demo build
 {await go('K-ISSB%20Reporting%20Wizard%20_%20GaonGreen.html');const has=await pg.locator('#ggEvidenceExport').count();let m='',ok=false,info='old page has no evidence export';
  if(has){await pg.locator('#ggEvidence select[data-kind="status"]').nth(6).selectOption('1');await pg.locator('#ggEvidence input[data-kind="reference"]').nth(6).fill('Water_OLD_DEMO.pdf');await pg.waitForTimeout(150);
   const [d]=await Promise.all([pg.waitForEvent('download'),pg.click('#ggEvidenceExport')]);const f=path.join(tmp,'oldpage.json');await d.saveAs(f);const old=fs.readFileSync(f,'utf8');
   await wiz();m=await importFile('oldpage.json',old);const o=JSON.parse(old);ok=o.data.every(x=>x.answers===undefined||Array.isArray(x.answers))&&(await statuses())[6]===1&&(await refs())[6]==='Water_OLD_DEMO.pdf'&&/restored/.test(m);info=m}else await wiz();
  await t.check('BK9','backup exported by the previous K-ISSB wizard page imports into the current one (statuses and references kept, links handled)',async()=>({ok:has>0&&ok,expected:'compatible',actual:info}))}
 // malformed / incomplete backups: rejected, nothing changes, no confirmation shown
 {await pg.evaluate(()=>window.ggEvidenceStore.setLink('waste',6,true));const L0=J(await links()),S0=J(await statuses());const base=bo.data;const mk=d=>J({type:'GaonGreenEvidence',version:1,data:d});
  const cases={'not JSON':'{oops','null':'null','empty object':'{}','wrong type':J({type:'Other',version:1,data:base}),'version 2':J({type:'GaonGreenEvidence',version:2,data:base}),'12 records':mk(base.slice(0,12)),'14 records':mk([...base,base[0]]),
   'status 7':mk(base.map((x,i)=>i?x:{...x,status:7})),'status "1" (string)':mk(base.map((x,i)=>i?x:{...x,status:'1'})),'reference 251 chars':mk(base.map((x,i)=>i?x:{...x,reference:'x'.repeat(251)})),'reference missing':mk(base.map((x,i)=>i?x:{status:0})),
   'answers not a list':mk(base.map((x,i)=>i?x:{...x,answers:'s1'})),'unknown answer id':mk(base.map((x,i)=>i?x:{...x,answers:['name','not-a-question']})),'numeric answer id':mk(base.map((x,i)=>i?x:{...x,answers:[1]})),'over 100 KB':mk(base).replace('"data"','"pad":"'+'x'.repeat(110000)+'","data"')};
  const bad=[];for(const [k,v] of Object.entries(cases)){const m=await importFile('bad.json',v);if(!/Could not import/.test(m)||dialogs.length||J(await links())!==L0||J(await statuses())!==S0)bad.push(k+': '+m)}
  await t.check('BK10','malformed or incomplete backups ('+Object.keys(cases).length+' kinds: not JSON, null, {}, wrong type, version 2, 12/14 records, bad status, string status, long/missing reference, bad links, >100 KB) are rejected with a clear message; nothing changes, no dialog',async()=>({ok:!bad.length,expected:'all rejected',actual:bad.join(' ; ')||'all rejected'}))}
 {reply=true;const m=await importFile('dup.json',J({type:'GaonGreenEvidence',version:1,data:bo.data.map((x,i)=>i===5?{...x,answers:['s1','s1','s2']}:x)}));
  await t.check('BK11','a backup that repeats the same answer in one record is restored without duplicates (one link)',async()=>({ok:/restored/.test(m)&&J(await pg.evaluate(()=>window.ggEvidenceStore.answersOf(5)))===J(['s1','s2']),expected:'["s1","s2"]',actual:m}))}
 {const m=await importFile('mixed.json',J({type:'GaonGreenEvidence',version:1,data:bo.data.map((x,i)=>i<6?{status:x.status,reference:x.reference}:x)}));
  await t.check('BK12','partly old-format backup (some records without links): treated as an older backup (asked if custom links exist), records without links get the suggested links, records with links keep them',async()=>({ok:/Older evidence backup restored/.test(m)&&J(await pg.evaluate(()=>window.ggEvidenceStore.answersOf(12)))===J(bo.data[12].answers)&&J(await pg.evaluate(()=>window.ggEvidenceStore.answersOf(5)))===J(DEF[5]),expected:'mixed handled',actual:m}))}
 // cross-account restore is explicit: B's backup imported by A changes A only, B untouched
 {const rawB0=(await raw())[KEY+'::'+B];await setSession(A);await wiz();reply=true;const m=await importFile('b-backup.json',bk);const aNow=await links();const rawB1=(await raw())[KEY+'::'+B];
  await t.check('BK13','restoring B\'s backup while signed in as A is an explicit user action that changes only A\'s copy (A now has the backup\'s links); B\'s stored record is byte-for-byte unchanged',async()=>({ok:/restored/.test(m)&&J(aNow)===J(bLinks)&&rawB0===rawB1&&!!rawB0,expected:'A = backup, B unchanged',actual:m+' | B unchanged='+(rawB0===rawB1)}))}

 // ---------- demo-readiness fixes ----------
 await setSession(null);await wiz();
 {const o=await pg.evaluate(()=>{const f=document.getElementById('form'),e=document.getElementById('ggEvidence'),r=document.getElementById('out');const pos=(a,b)=>!!(a.compareDocumentPosition(b)&Node.DOCUMENT_POSITION_FOLLOWING);return{fe:pos(f,e),er:pos(e,r)}});
  await t.check('UX1','page order for a first-time user: questionnaire, then evidence checklist, then report',async()=>({ok:o.fe&&o.er,expected:'form < evidence < report',actual:J(o)}))}
 {const r={};for(const l of ['ko','ar','en']){await pg.selectOption('#language',l);await pg.waitForTimeout(300);r[l]={txt:await pg.locator('#gg-demo-text').innerText(),btn:await pg.locator('#gg-demo-reset').innerText(),dir:await pg.locator('#gg-demo-banner').getAttribute('dir'),opt:await pg.locator('#ggEvidence select[data-kind="status"]').first().locator('option').nth(1).innerText()}}
  await t.check('UX2','demo banner follows the language (Korean, Arabic RTL, English) and still says the data is fictional; evidence status "Available" is labelled as company-declared in all three languages',async()=>({ok:/가상 데이터 전용/.test(r.ko.txt)&&r.ko.btn==='데모 데이터 초기화'&&/بيانات وهمية/.test(r.ar.txt)&&r.ar.dir==='rtl'&&/fictional data only/.test(r.en.txt)&&r.en.opt==='Available (company-declared)'&&r.ko.opt==='보유 (회사 자체 확인)'&&r.ar.opt==='متوفر (تصريح الشركة)',expected:'localised',actual:J(r).slice(0,300)}))}
 {await setSession(A);await wiz();await pg.waitForTimeout(600);await pg.selectOption('#language','ko');await pg.waitForTimeout(400);const ko=await pg.locator('#ggCompanyStatus').innerText();await pg.selectOption('#language','ar');await pg.waitForTimeout(300);const ar=await pg.locator('#ggCompanyStatus').innerText();await pg.selectOption('#language','en');
  await t.check('UX3','cloud profile status message follows a language switch (was stuck in English)',async()=>({ok:!/[A-Za-z]{4,}/.test(ko)&&!/[A-Za-z]{4,}/.test(ar)&&ko.length>3,expected:'ko/ar text',actual:ko+' | '+ar}))}
 {await go('GaonGreen_Evidence_Locker_Cloud_Beta.html');const href=await pg.locator('a[data-t="wizard"]').getAttribute('href');await pg.click('a[data-t="wizard"]');await pg.waitForTimeout(700);
  await t.check('UX4','Evidence Locker "Open K-ISSB Reporting Wizard" opens the current wizard (was the old prototype page)',async()=>({ok:href===W&&pg.url().endsWith(W)&&await pg.locator('#ggEvidence').count()===1&&await pg.locator('.gg-ev-chip').count()===21,expected:W,actual:href+' -> '+pg.url().split('/').pop()}))}
 // untranslated visible text after a full Korean / Arabic pass (allow-list: product names, units, references, demo company)
 {const scan=async l=>{await wiz();await pg.selectOption('#language',l);await pg.waitForTimeout(400);await pg.evaluate(()=>document.getElementById('form').requestSubmit());await pg.waitForTimeout(600);
   return pg.evaluate(()=>{const allow=/^(ESG|K-ISSB|ISSB|IFRS|GaonGreen|CSV|PDF|kWh|GJ|MWh|tCO|CO|Scope|KRW|RE100|K-RE100|K-RE|EPR|QR|DEMO|Hanbit|Precision|Co|fictional|Example|Exporter|Supabase|KEPCO|GHG|SME|HR|ID|JSON|Excel|CEO|demo|user|example|invalid|assurance|Electricity_Bills_2025|pdf)$/i;const out=new Set();const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){const el=n.parentElement;if(!el||el.closest('script,style,noscript,option')||!el.getClientRects().length)continue;const cs=getComputedStyle(el);if(cs.visibility==='hidden')continue;const words=(n.textContent.match(/[A-Za-z][A-Za-z'’-]{2,}/g)||[]).filter(x=>!allow.test(x));if(words.length)out.add(n.textContent.trim().slice(0,80))}return[...out]})};
  const ko=await scan('ko'),ar=await scan('ar');await t.check('UX5','no untranslated visible interface text in Korean or Arabic after the questionnaire and report are shown (product names, units, file references and fictional company excepted)',async()=>({ok:!ko.length&&!ar.length,expected:'none',actual:J({ko,ar})}))}
 // layout: evidence pills never overlap the neighbouring question
 {const res=[];for(const [l,w] of [['en',1280],['ar',1280],['ko',390]]){await pg.setViewportSize({width:w,height:900});await wiz();if(l!=='en'){await pg.selectOption('#language',l);await pg.waitForTimeout(300)}
   await pg.click('.gg-v3-step[data-step="1"]');await ev(4,1);await ref(4,'Fuel_invoices_2025_full_year_DEMO.xlsx');await pg.evaluate(()=>{window.ggEvidenceStore.setLink('s1',4,true)});await pg.waitForTimeout(250);
   res.push(await pg.evaluate(()=>{let bad=0;document.querySelectorAll('#form fieldset label[for]').forEach(l=>{const c=l.querySelector('.gg-ev-chip');if(!c||!l.getClientRects().length)return;const L=l.getBoundingClientRect();c.querySelectorAll('.gg-ev-pill,.gg-ev-badge,select').forEach(x=>{const R=x.getBoundingClientRect();if(R.width&&(R.left<L.left-1||R.right>L.right+1))bad++})});return bad+(document.documentElement.scrollWidth>document.documentElement.clientWidth+1?100:0)}))}
  await pg.setViewportSize({width:1280,height:900});
  await t.check('UX6','long evidence names/references stay inside their own question (no overlap, no horizontal scroll) in English, Arabic and Korean mobile',async()=>({ok:res.every(x=>x===0),expected:'0,0,0',actual:res.join(',')}))}
 {await wiz();const names=[];for(const n of ['한빛정밀 (DEMO)','شركة تجريبية','Hanbit Precision Co. (DEMO)']){await pg.fill('#name',n);await pg.evaluate(()=>document.getElementById('form').requestSubmit());await pg.waitForTimeout(400);const [d]=await Promise.all([pg.waitForEvent('download'),pg.click('#ggEvMapCsv')]);names.push(d.suggestedFilename())}
  await t.check('UX7','CSV file name is always a real .csv name: Korean or Arabic company names no longer produce a bare "download" file (ASCII-only name, company name stays inside the file)',async()=>({ok:J(names)===J(['GaonGreen_Evidence_Map_DEMO.csv','GaonGreen_Evidence_Map_company.csv','GaonGreen_Evidence_Map_Hanbit_Precision_Co_DEMO.csv']),expected:'.csv names',actual:names.join(', ')}))}
 await t.check('AC-NET','whole acceptance run: no page errors, no external requests',async()=>({ok:!pg.errors.length&&!pg.external.length,expected:'clean',actual:J({e:pg.errors.slice(0,3),x:pg.external.slice(0,3)})}));
 await s.close();fs.writeFileSync(process.argv[2]||'func-kissb-acceptance.json',JSON.stringify({run:new Date().toISOString(),build:'OFFLINE DEMO; fictional users and data; simulated sessions',results:t.res},null,1));
 process.exit(t.res.every(x=>x.status==='PASS')?0:1)})().catch(e=>{console.error(e);process.exit(1)});
