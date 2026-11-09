// Post-acceptance fixes (8 Nov 2026 staging report F2, F4, F5, F6). OFFLINE demo stand-in only; says nothing about the real project.
// F2: one shared language preference ('gaongreen-language') is honoured by all 8 app pages, incl. K-ISSB with a cached draft in another language.
// F4: Supplier ESG cloud save never silently uploads without the current assessment in the saved list.
// F5: K-ISSB total energy keeps decimals in the indicator table and report KPI (display only).
// F6: Dashboard hides "Open login" while signed in and shows it again when signed out.
// F3: Evidence Locker keeps company/category/year after a save and prefills company from this account's Company Settings copy.
// F7: K-ISSB print CSS lets report panels break across pages while table rows stay whole.
// F9: the shareable validation summary keeps the exact allow-listed draft id/URL lines wherever they appear; leak detectors unchanged.
const S=require('./lib/serve.js'),T=require('./lib/t.js');const t=T.make();
const APP=['GaonGreen_ESG_Dashboard_Cloud_Beta.html','GaonGreen_Company_Settings_Cloud_Beta.html','GaonGreen_KISSB_Cloud_Beta.html','GaonGreen_K-RE100_Cloud_Beta.html','GaonGreen_EPR_Cloud_Beta.html','GaonGreen_Supplier_ESG_Scan_Cloud_Beta.html','GaonGreen_QR_ESG_Card_Cloud_Beta.html','GaonGreen_Evidence_Locker_Cloud_Beta.html'];
const switchLang=async(pg,L)=>pg.evaluate(L=>{const sel=[...document.querySelectorAll('select')].find(x=>[...x.options].some(o=>o.value===L));if(sel){sel.value=L;sel.dispatchEvent(new Event('change',{bubbles:true}));return 1}const b=[...document.querySelectorAll('[data-lang]')].find(x=>x.dataset.lang===L);if(b){b.click();return 2}return 0},L);
const state=pg=>pg.evaluate(()=>({lang:document.documentElement.lang,dir:document.documentElement.dir||document.body.dir}));
(async()=>{const s=await S.start('demo');
 const go=async(pg,f)=>{await pg.goto(s.base+f);await pg.waitForTimeout(600)};
 const fresh=async(onDialog)=>{const pg=await s.page();pg.on('dialog',d=>onDialog?onDialog(d):d.accept());return pg};

 for(const L of ['ko','ar']) await t.check('P1-'+L,'F2: language chosen on Dashboard ('+L+') is kept on all 7 other app pages'+(L==='ar'?' with RTL':''),async()=>{
  const pg=await fresh();await go(pg,APP[0]);await switchLang(pg,L);await pg.waitForTimeout(300);const bad=[];
  for(const f of APP.slice(1)){await go(pg,f);const st=await state(pg);if(st.lang!==L||(L==='ar'&&st.dir!=='rtl'))bad.push(f+':'+JSON.stringify(st))}
  await pg.context().close();return{ok:!bad.length,expected:'all pages '+L,actual:JSON.stringify(bad)}});

 await t.check('P2','F2: switching back to English on any page (K-ISSB) is kept across pages',async()=>{
  const pg=await fresh();await go(pg,APP[0]);await switchLang(pg,'ar');await go(pg,APP[2]);await switchLang(pg,'en');await pg.waitForTimeout(300);const bad=[];
  for(const f of APP){await go(pg,f);const st=await state(pg);if(st.lang!=='en'||st.dir==='rtl')bad.push(f+':'+JSON.stringify(st))}
  await pg.context().close();return{ok:!bad.length,expected:'all pages en, ltr',actual:JSON.stringify(bad)}});

 await t.check('P3','F2: legacy per-page keys still honoured when no shared preference exists (K-RE100 ko, Evidence Locker ar)',async()=>{
  const pg=await fresh();await go(pg,'index.html');await pg.evaluate(()=>{localStorage.removeItem('gaongreen-language');localStorage.setItem('gaongreen-kre100-lang','ko')});
  await go(pg,APP[3]);const a=await state(pg);await pg.evaluate(()=>{localStorage.removeItem('gaongreen-language');localStorage.setItem('gg-locker-lang','ar')});await go(pg,APP[7]);const b=await state(pg);
  await pg.context().close();return{ok:a.lang==='ko'&&b.lang==='ar',expected:'ko / ar',actual:a.lang+' / '+b.lang}});

 await t.check('P4','F2: K-ISSB cached draft saved in English does not override a later Arabic preference on reload; preference not overwritten',async()=>{
  const pg=await fresh();await go(pg,APP[2]);await pg.evaluate(()=>{const el=document.getElementById('name');el.value='Example Exporter A';el.dispatchEvent(new Event('input',{bubbles:true}));window.dispatchEvent(new Event('gg-flush'))});await pg.waitForTimeout(400);
  const cached=await pg.evaluate(()=>Object.keys(localStorage).filter(k=>/kissb/i.test(k)&&/cloud|cache|account|draft/i.test(k)).length);
  await pg.evaluate(()=>localStorage.setItem('gaongreen-language','ar'));await go(pg,APP[2]);await pg.waitForTimeout(600);const st=await state(pg);const pref=await pg.evaluate(()=>localStorage.getItem('gaongreen-language'));const name=await pg.evaluate(()=>document.getElementById('name').value);
  await pg.context().close();return{ok:st.lang==='ar'&&pref==='ar'&&name==='Example Exporter A',expected:'ar, pref ar, draft kept',actual:JSON.stringify({st,pref,name,cached})}});

 await t.check('P5','F4: Supplier cloud save with an unsaved assessment asks first; Cancel uploads nothing and says why',async()=>{
  const pg=await fresh(d=>d.dismiss());await go(pg,APP[5]);await pg.fill('#supplier','Test Supplier A1');await pg.click('#cloudSave');await pg.waitForTimeout(800);
  const msg=await pg.evaluate(()=>document.getElementById('cloudStatus').textContent);const opts=await pg.evaluate(()=>document.getElementById('savedSelect').options.length);
  await pg.context().close();return{ok:/cancelled/i.test(msg)&&opts===1,expected:'cancelled message, list still empty',actual:JSON.stringify({msg,opts})}});

 await t.check('P6','F4: accepting the prompt adds the assessment to the list, saves to cloud, and a reload + cloud load restores it',async()=>{
  const pg=await fresh();await go(pg,APP[5]);await pg.fill('#supplier','Test Supplier A1');await pg.click('#cloudSave');await pg.waitForTimeout(900);
  const msg=await pg.evaluate(()=>document.getElementById('cloudStatus').textContent);
  await pg.evaluate(()=>{for(const k of ['gaongreen-supplier-scan-v1','gaongreen-supplier-draft-v1'])localStorage.removeItem(k)});await go(pg,APP[5]);
  await pg.click('#cloudLoad');await pg.waitForTimeout(900);const names=await pg.evaluate(()=>[...document.getElementById('savedSelect').options].map(o=>o.textContent));
  await pg.context().close();return{ok:/successfu/i.test(msg)&&names.some(n=>n.startsWith('Test Supplier A1')),expected:'saved + restored in list',actual:JSON.stringify({msg,names})}});

 await t.check('P7','F4: the new prompt and cancel message exist in Korean and Arabic',async()=>{
  const pg=await fresh();await go(pg,APP[5]);const r=await pg.evaluate(()=>{const o={};for(const L of ['ko','ar']){document.documentElement.lang=L;o[L]=[ggTr('sup_unsaved','x'),ggTr('sup_unsaved_cancel','x')]}document.documentElement.lang='en';return o});
  await pg.context().close();return{ok:r.ko.every(x=>/[가-힣]/.test(x))&&r.ar.every(x=>/[؀-ۿ]/.test(x)),expected:'Hangul + Arabic',actual:JSON.stringify(r).slice(0,160)}});

 await t.check('P8','F5: K-ISSB 1000 kWh shows total energy 3.6 GJ (not 4) in the indicator table and the report KPI',async()=>{
  const pg=await fresh();await go(pg,APP[2]);
  await pg.evaluate(()=>{const set=(id,v)=>{const e=document.getElementById(id);e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}))};set('name','Example Exporter A');set('elec','1000');set('renew','250');set('s1','10');set('s2','20');document.getElementById('form').requestSubmit()});await pg.waitForTimeout(500);
  const r=await pg.evaluate(()=>({table:[...document.querySelectorAll('#indicators tr')].map(tr=>tr.textContent).find(x=>/Total energy/.test(x))||'',kpi:(document.getElementById('reportKpis')||{}).textContent||''}));
  await pg.context().close();return{ok:/3\.6/.test(r.table)&&/3\.6 GJ/.test(r.kpi)&&!/\b4 GJ/.test(r.kpi),expected:'3.6 in table and KPI',actual:JSON.stringify(r)}});

 await t.check('P9','F6: Dashboard hides "Open login" while signed in, shows it after sign-out; banner no longer says "sign in to see"',async()=>{
  const pg=await fresh();await go(pg,APP[0]);await pg.waitForTimeout(600);
  const inn=await pg.evaluate(()=>({login:document.getElementById('cloudLogin').hidden,sep:document.getElementById('cloudSep').hidden,status:document.getElementById('cloudStatus').textContent,banner:document.querySelector('[data-t="warning"]').textContent}));
  await pg.evaluate(()=>__ggDemoTest.expireSession());await go(pg,APP[0]);await pg.waitForTimeout(600);
  const out=await pg.evaluate(()=>({login:document.getElementById('cloudLogin').hidden,status:document.getElementById('cloudStatus').textContent}));
  await pg.context().close();return{ok:inn.login===true&&inn.sep===true&&/Signed in/.test(inn.status)&&!/sign in to see/i.test(inn.banner)&&out.login===false,expected:'hidden when signed in, visible when out',actual:JSON.stringify({inn,out})}});

 const EV=APP[7];const SET=JSON.stringify({version:1,company:'Example Exporter A',country:'KR',industry:'Manufacturing',currency:'USD',entries:[]});
 await t.check('P10','F3: empty company fields are prefilled from Company Settings; with no settings they stay empty',async()=>{
  const pg=await fresh();await go(pg,EV);const none=await pg.evaluate(()=>[document.getElementById('company').value,document.getElementById('cloudCompany').value]);
  await pg.evaluate(v=>localStorage.setItem('gaongreen-company-settings-v1',v),SET);await go(pg,EV);const got=await pg.evaluate(()=>[document.getElementById('company').value,document.getElementById('cloudCompany').value]);
  await pg.context().close();return{ok:none.join('')===''&&got.every(x=>x==='Example Exporter A'),expected:'empty, then prefilled',actual:JSON.stringify({none,got})}});

 await t.check('P11','F3: after a cloud upload only title, file and notes clear; company, category, year and review status stay',async()=>{
  const pg=await fresh();await go(pg,EV);
  await pg.evaluate(()=>{const v=(i,x)=>{document.getElementById(i).value=x};v('cloudCompany','Example Exporter A');v('cloudTitle','Bill Oct');v('cloudYear','2025');v('cloudNotes','n1');const c=document.getElementById('cloudCategory');c.value=c.options[2].value;const r=document.getElementById('cloudReview');r.value=r.options[1].value});
  const before=await pg.evaluate(()=>['cloudCategory','cloudReview'].map(i=>document.getElementById(i).value));
  await pg.setInputFiles('#cloudFile',{name:'v4-test.txt',mimeType:'text/plain',buffer:Buffer.from('GaonGreen F3 test\n')});await pg.click('#cloudUpload');await pg.waitForTimeout(1200);
  const r=await pg.evaluate(()=>({company:cloudCompany.value,title:cloudTitle.value,notes:cloudNotes.value,year:cloudYear.value,files:cloudFile.files.length,cat:cloudCategory.value,rev:cloudReview.value,list:document.body.textContent.includes('Bill Oct')}));
  await pg.context().close();return{ok:r.company==='Example Exporter A'&&r.title===''&&r.notes===''&&r.files===0&&r.year==='2025'&&r.cat===before[0]&&r.rev===before[1]&&r.list,expected:'kept + cleared + listed',actual:JSON.stringify(r)}});

 await t.check('P12','F3: after a local save only title, file and notes clear; company and year stay',async()=>{
  const pg=await fresh();await go(pg,EV);
  await pg.evaluate(()=>{const v=(i,x)=>{document.getElementById(i).value=x};v('company','Example Exporter A');v('docTitle','Local doc');v('year','2025');v('notes','n2')});
  await pg.setInputFiles('#file',{name:'local.txt',mimeType:'text/plain',buffer:Buffer.from('local\n')});await pg.click('#addButton');await pg.waitForTimeout(1200);
  const r=await pg.evaluate(()=>({company:company.value,title:docTitle.value,notes:notes.value,year:year.value,files:file.files.length,listed:document.body.textContent.includes('Local doc')}));
  await pg.context().close();return{ok:r.company==='Example Exporter A'&&r.title===''&&r.notes===''&&r.files===0&&r.year==='2025'&&r.listed,expected:'kept + cleared + listed',actual:JSON.stringify(r)}});

 await t.check('P13','F7: in print media the K-ISSB report panels may break across pages while table rows stay whole',async()=>{
  const pg=await fresh();await go(pg,APP[2]);
  await pg.evaluate(()=>{const set=(id,v)=>{const e=document.getElementById(id);e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}))};set('name','Example Exporter A');set('elec','1000');set('renew','250');set('s1','10');set('s2','20');document.getElementById('form').requestSubmit()});await pg.waitForTimeout(500);
  await pg.emulateMedia({media:'print'});const r=await pg.evaluate(()=>{const p=[...document.querySelectorAll('#out>.panel')];const tr=document.querySelector('#out>.panel tr');return{panels:p.length,inside:[...new Set(p.map(x=>getComputedStyle(x).breakInside))],tr:tr?getComputedStyle(tr).breakInside:null}});
  const pdf=await pg.pdf({format:'A4'});const pages=(pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g)||[]).length;
  await pg.context().close();return{ok:r.panels>0&&r.inside.length===1&&r.inside[0]==='auto'&&r.tr==='avoid'&&pages>0,expected:'panels auto, rows avoid',actual:JSON.stringify({...r,pages})}});

 const os=require('os'),path=require('path'),fs2=require('fs'),cp=require('child_process');
 const runSum=(depLines,secrets)=>{const d=fs2.mkdtempSync(path.join(os.tmpdir(),'ggsum-'));fs2.writeFileSync(path.join(d,'state.txt'),'RESULT=PASS\nDEPLOY=ok\n');fs2.writeFileSync(path.join(d,'deploy.txt'),depLines.join('\n')+'\n');
  const r=cp.spawnSync(process.execPath,['tools/summarize-validation.js','--state',path.join(d,'state.txt'),'--deploy',path.join(d,'deploy.txt'),'--out',path.join(d,'share.txt')],{encoding:'utf8',env:{...process.env,GG_SCAN_SECRETS:JSON.stringify(secrets||[])}});
  let share='';try{share=fs2.readFileSync(path.join(d,'share.txt'),'utf8')}catch(e){}fs2.rmSync(d,{recursive:true,force:true});return{status:r.status,share}};
 const ID='6af06650abe06f879981cfac',LIVE='6adf6e4d0e82082a49c6f086',CLI=Array.from({length:15},(_,i)=>'  "field_'+i+'": "value '+i+' '+'x'.repeat(30)+'",');
 await t.check('P14','F9: draft id, draft URL and verified line are kept even after 15 lines of CLI output; other lines stay scrubbed and capped at 12',async()=>{
  const r=runSum([...CLI,'verified: live site still serves '+LIVE,'DRAFT deploy id: '+ID,'DRAFT deploy URL: https://'+ID+'--incredible-biscotti-bcf58a.netlify.app (team-login protected)']);
  const other=(r.share.match(/^deploy: (?!DRAFT|verified)/gm)||[]).length;
  return{ok:r.status===0&&r.share.includes('deploy: DRAFT deploy id: '+ID)&&r.share.includes('deploy: DRAFT deploy URL: https://'+ID+'--incredible-biscotti-bcf58a.netlify.app')&&r.share.includes('verified: live site still serves '+LIVE)&&other===12&&!/x{30}/.test(r.share),expected:'3 allow-listed lines + 12 scrubbed',actual:JSON.stringify({status:r.status,other})}});
 await t.check('P15','F9: lookalike URLs are not allow-listed, and the password leak detector still withholds the summary',async()=>{
  const a=runSum(['DRAFT deploy URL: https://'+ID+'--some-other-site.netlify.app','DRAFT deploy id: '+ID+'0']);
  const b=runSum(['note: pw Fict10nal-Pass in log'],['Fict10nal-Pass']);
  return{ok:a.status===0&&!a.share.includes('some-other-site.netlify.app')&&!a.share.includes('DRAFT deploy id: '+ID+'0')&&b.status===4&&b.share==='',expected:'lookalikes scrubbed; leak -> exit 4',actual:JSON.stringify({a:a.status,b:b.status})}});

 await s.close();require('fs').writeFileSync(process.argv[2]||'func-post-acceptance.json',JSON.stringify({run:new Date().toISOString(),build:'OFFLINE demo stand-in',results:t.res},null,1));process.exit(t.res.every(x=>x.status==='PASS')?0:1)})().catch(e=>{console.error(e);process.exit(1)});
