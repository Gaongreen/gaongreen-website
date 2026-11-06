// Failure-path checks on the OFFLINE DEMO build: expired session, backend outage, validation rejections, QR cloud round trip, K-ISSB PDF content.
// STAND-IN ONLY: faults are injected through the stand-in's test hook (self.__ggDemoTest). This shows how the PAGES react to errors; it says nothing about real Supabase behaviour.
const S=require('./lib/serve.js'),T=require('./lib/t.js'),fs=require('fs'),os=require('os'),path=require('path'),{execFileSync}=require('child_process');
(async()=>{const s=await S.start('demo'),t=T.make();const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'faults-'));
 const rows=(p,tb)=>p.evaluate(tb=>{const r=localStorage.getItem('gaongreen_demo_v1:table:'+tb);return r?JSON.parse(r).length:0},tb);
 const objs=p=>p.evaluate(()=>new Promise(res=>{const q=indexedDB.open('gaongreen_demo_v1:objects',1);q.onupgradeneeded=()=>q.result.createObjectStore('o',{keyPath:'k'});q.onsuccess=()=>{const g=q.result.transaction('o').objectStore('o').getAll();g.onsuccess=()=>{q.result.close();res(g.result.length)}}}));
 const open=async f=>{const p=await s.page();p.on('dialog',d=>d.accept());await p.goto(s.base+f);await p.waitForTimeout(600);return p};
 const hook=(p,fn,arg)=>p.evaluate(([fn,arg])=>window.__ggDemoTest[fn](arg),[fn,arg]);
 // tool descriptors: file, table, save/load/status selectors, how to enter local data, how to read it back
 const TOOLS=[
  {n:'K-ISSB',f:'GaonGreen_KISSB_Cloud_Beta.html',tb:'kissb_drafts',save:'#ggCloudSave',load:'#ggCloudLoad',st:'#ggCloudStatus',set:p=>p.fill('#name','Fault Co (fictional)'),get:p=>p.inputValue('#name'),want:'Fault Co (fictional)'},
  {n:'K-RE100',f:'GaonGreen_K-RE100_Cloud_Beta.html',tb:'kre100_drafts',save:'#cloudSave',load:'#cloudLoad',st:'#cloudStatus',set:async p=>{await p.fill('#total','1200');await p.fill('#m_ppa','300')},get:p=>p.inputValue('#total'),want:'1200'},
  {n:'EPR',f:'GaonGreen_EPR_Cloud_Beta.html',tb:'epr_drafts',save:'#cloudSave',load:'#cloudLoad',st:'#cloudStatus',set:p=>p.locator('#rows tr').nth(0).locator('input').nth(0).fill('Fault box'),get:p=>p.locator('#rows tr').nth(0).locator('input').nth(0).inputValue(),want:'Fault box'},
  {n:'Supplier',f:'GaonGreen_Supplier_ESG_Scan_Cloud_Beta.html',tb:'supplier_esg_drafts',save:'#cloudSave',load:'#cloudLoad',st:'#cloudStatus',set:p=>p.fill('#supplier','Fault Supplier Ltd'),get:p=>p.inputValue('#supplier'),want:'Fault Supplier Ltd'},
  {n:'QR',f:'GaonGreen_QR_ESG_Card_Cloud_Beta.html',tb:'qr_esg_drafts',save:'#cloudSave',load:'#cloudLoad',st:'#cloudStatus',set:p=>p.fill('#company','Fault QR Co'),get:p=>p.inputValue('#company'),want:'Fault QR Co'},
  {n:'Settings',f:'GaonGreen_Company_Settings_Cloud_Beta.html',tb:'company_profiles',save:'#cloudSave',load:'#cloudLoad',st:'#cloudStatus',set:p=>p.fill('#company','Fault Settings Co'),get:p=>p.inputValue('#company'),want:'Fault Settings Co'}];
 const ERRTXT=/sign|log ?in|session|expired|auth|jwt|unavailable|failed|error|503|401/i;
 // X1: expired session (silent: the page still believes it is signed in)
 for(const k of ['save','load']) await t.check('X1-'+k,`Expired session: cloud ${k.toUpperCase()} on all 6 tools + Settings shows an error/sign-in message, writes nothing and keeps the user's local data`,async()=>{const bad=[];
  for(const T of TOOLS){const p=await open(T.f);await T.set(p);await p.evaluate(()=>{});const n0=await rows(p,T.tb);await hook(p,'expireSession');await p.click(T[k]);await p.waitForTimeout(600);
   const msg=(await p.locator(T.st).innerText()).trim(),n1=await rows(p,T.tb),kept=await T.get(p);
   if(!(n1===n0&&ERRTXT.test(msg)&&!/saved to cloud successfully|loaded/i.test(msg)&&kept===T.want))bad.push(`${T.n}: rows ${n0}->${n1} kept="${kept}" msg="${msg.slice(0,70)}"`);await p.context().close()}
  return{ok:!bad.length,expected:'7/7 tools handled',actual:JSON.stringify(bad).slice(0,380)}});
 // F-1: backend outage (503) while signed in
 for(const k of ['save','load']) await t.check('F1-'+k,`Backend outage: cloud ${k.toUpperCase()} on all 6 tools + Settings shows an error, writes nothing and keeps local data`,async()=>{const bad=[];
  for(const T of TOOLS){const p=await open(T.f);await T.set(p);const n0=await rows(p,T.tb);await hook(p,'failBackend',true);await p.click(T[k]);await p.waitForTimeout(600);
   const msg=(await p.locator(T.st).innerText()).trim(),n1=await rows(p,T.tb),kept=await T.get(p);
   if(!(n1===n0&&ERRTXT.test(msg)&&!/saved to cloud successfully|loaded/i.test(msg)&&kept===T.want))bad.push(`${T.n}: rows ${n0}->${n1} kept="${kept}" msg="${msg.slice(0,70)}"`);await p.context().close()}
  return{ok:!bad.length,expected:'7/7 tools handled',actual:JSON.stringify(bad).slice(0,380)}});
 // Q-C: QR cloud draft round trip
 await t.check('Q-C','QR: cloud save, clear, cloud load restores company, year and energy',async()=>{const p=await open('GaonGreen_QR_ESG_Card_Cloud_Beta.html');
  await p.fill('#company','Example Exporter Co.');await p.fill('#year','2026');await p.fill('#energy','40');await p.fill('#website','https://example.com/esg');await p.click('#cloudSave');await p.waitForTimeout(500);
  const saved=/saved to cloud/i.test(await p.locator('#cloudStatus').innerText());await p.fill('#company','x');await p.fill('#energy','1');await p.fill('#year','1999');await p.click('#cloudLoad');await p.waitForTimeout(600);
  const got=[await p.inputValue('#company'),await p.inputValue('#year'),await p.inputValue('#energy'),await p.inputValue('#website')];
  return{ok:saved&&got.join('|')==='Example Exporter Co.|2026|40|https://example.com/esg',expected:'Example Exporter Co.|2026|40|https://example.com/esg',actual:`saved=${saved} ${got.join('|')}`}});
 // L-R: Evidence rejections (client-side rules), local and cloud forms
 const EV='GaonGreen_Evidence_Locker_Cloud_Beta.html';
 await t.check('L-R1','Evidence cloud: a file over 10 MB is rejected with a message; no table row and no stored object',async()=>{const p=await open(EV);const r0=await rows(p,'evidence_documents'),o0=await objs(p);
  await p.fill('#cloudCompany','Example Exporter Co.');await p.fill('#cloudTitle','Too big');await p.fill('#cloudYear','2026');await p.setInputFiles('#cloudFile',{name:'big.txt',mimeType:'text/plain',buffer:Buffer.alloc(10*1024*1024+1,65)});await p.click('#cloudUpload');await p.waitForTimeout(900);
  const msg=(await p.locator('#cloudStatus').innerText()).trim(),r1=await rows(p,'evidence_documents'),o1=await objs(p);return{ok:r1===r0&&o1===o0&&/10 ?MB|too (big|large)|size/i.test(msg),expected:'rejected, nothing stored',actual:`rows ${r0}->${r1} objs ${o0}->${o1} msg="${msg.slice(0,80)}"`}});
 await t.check('L-R2','Evidence cloud: a disallowed extension (.exe) is rejected with a message; nothing stored',async()=>{const p=await open(EV);const r0=await rows(p,'evidence_documents'),o0=await objs(p);
  await p.fill('#cloudCompany','Example Exporter Co.');await p.fill('#cloudTitle','Bad type');await p.fill('#cloudYear','2026');
  // the input has an accept= list, which only filters the file picker; setInputFiles bypasses it, so the page's own check must hold
  await p.setInputFiles('#cloudFile',{name:'run.exe',mimeType:'application/octet-stream',buffer:Buffer.from('MZ fictional')});await p.click('#cloudUpload');await p.waitForTimeout(900);
  const msg=(await p.locator('#cloudStatus').innerText()).trim(),r1=await rows(p,'evidence_documents'),o1=await objs(p);return{ok:r1===r0&&o1===o0&&/type|allowed|format|not supported|unsupported|invalid/i.test(msg),expected:'rejected, nothing stored',actual:`rows ${r0}->${r1} objs ${o0}->${o1} msg="${msg.slice(0,80)}"`}});
 await t.check('L-R3','Evidence local library: >10 MB and .exe are rejected (library stays empty); a valid file afterwards IS accepted (positive control)',async()=>{const p=await open(EV);
  const total=()=>p.evaluate(()=>document.getElementById('total')?document.getElementById('total').textContent.trim():'NO-#total');
  const t0=await total();
  for(const f of [{name:'big.txt',mimeType:'text/plain',buffer:Buffer.alloc(10*1024*1024+1,65)},{name:'run.exe',mimeType:'application/octet-stream',buffer:Buffer.from('MZ')}]){await p.fill('#company','Example Exporter Co.');await p.fill('#docTitle','Reject me');await p.setInputFiles('#file',f);await p.click('#addButton');await p.waitForTimeout(500)}
  const t1=await total();await p.fill('#company','Example Exporter Co.');await p.fill('#docTitle','Accept me');await p.setInputFiles('#file',{name:'ok.txt',mimeType:'text/plain',buffer:Buffer.from('hello')});await p.click('#addButton');await p.waitForTimeout(600);const t2=await total();
  return{ok:t0==='0'&&t1==='0'&&t2==='1',expected:'0,0,1',actual:`${t0},${t1},${t2}`}});
 await t.check('L-R4','Evidence cloud: when the backend is down, upload shows an error and no row/object appears',async()=>{const p=await open(EV);const r0=await rows(p,'evidence_documents'),o0=await objs(p);await hook(p,'failBackend',true);
  await p.fill('#cloudCompany','Example Exporter Co.');await p.fill('#cloudTitle','Outage');await p.fill('#cloudYear','2026');await p.setInputFiles('#cloudFile',{name:'ok.txt',mimeType:'text/plain',buffer:Buffer.from('hello')});await p.click('#cloudUpload');await p.waitForTimeout(900);
  const msg=(await p.locator('#cloudStatus').innerText()).trim(),r1=await rows(p,'evidence_documents'),o1=await objs(p);return{ok:r1===r0&&o1===o0&&ERRTXT.test(msg),expected:'error, nothing stored',actual:`rows ${r0}->${r1} objs ${o0}->${o1} msg="${msg.slice(0,80)}"`}});
 // P-1: K-ISSB report rendered through the page's PRINT stylesheet to a real PDF, then text-extracted
 await t.check('P-1','K-ISSB: print layout renders to a PDF containing the company, the six indicator values and the Missing marker, and no navigation strip',async()=>{const p=await open('GaonGreen_KISSB_Cloud_Beta.html');
  const next=async n=>{for(let i=0;i<n;i++)await p.click('#ggV3Next')};
  await p.fill('#name','Example Exporter Co.');await p.selectOption('#industry',{index:1});await p.fill('#year','2025');await p.fill('#emp','100');await p.fill('#rev','5000');await next(1);
  for(const [id,v] of Object.entries({elec:'1000000',renew:'250000',fuel:'500',s1:'120',s2:'300'}))await p.fill('#'+id,v);await next(3);await p.getByRole('button',{name:/Build my dashboard/}).click();await p.waitForTimeout(700);
  const pdf=path.join(tmp,'kissb.pdf');await p.pdf({path:pdf,format:'A4',printBackground:true});const txt=execFileSync('pdftotext',['-layout',pdf,'-']).toString();
  const need=['Example Exporter Co.','420','4.2','0.08','4,100','0.82','25'],miss=need.filter(x=>!txt.includes(x));const hasMissing=/Missing/i.test(txt),navLeak=/Sign out|Evidence Locker/.test(txt.split('\n').slice(0,6).join(' '));
  fs.copyFileSync(pdf,path.join(path.dirname(process.argv[2]||'.'),'func-faults-kissb-report.pdf'));
  return{ok:!miss.length&&hasMissing&&!navLeak,expected:'all values present, Missing present, no nav',actual:`missing=[${miss}] hasMissing=${hasMissing} navLeak=${navLeak} pdfChars=${txt.length}`}});
 fs.writeFileSync(process.argv[2]||'func-faults.json',JSON.stringify({run:new Date().toISOString(),build:'demo (offline stand-in with injected faults; NOT real Supabase)',results:t.res},null,1));fs.rmSync(tmp,{recursive:true,force:true});await s.close();process.exit(t.res.some(r=>r.status!=='PASS')?1:0)})();
