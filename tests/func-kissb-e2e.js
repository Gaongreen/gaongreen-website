// END-TO-END K-ISSB workflow on the OFFLINE DEMO build with a FICTIONAL SME ("Hanbit Precision Co. (DEMO – fictional)"); no Supabase, no network.
// Each language starts in a fresh browser context (= a new, empty local profile). Exports are real downloads / a real print-to-PDF, read back from disk.
// Evidence statuses: 0 Not reviewed, 1 Available, 2 Missing, 3 Needs review, 4 Not applicable. "Available" is the company's own declaration (never "verified").
const S=require('./lib/serve.js'),T=require('./lib/t.js'),fs=require('fs'),os=require('os'),path=require('path'),{execFileSync}=require('child_process');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kissb-e2e-'));
const DEMO='Hanbit Precision Co. (DEMO – fictional)';
const ANS={industry:1,year:'2025',emp:'1250',rev:'1250000',elec:'987654321',renew:'123456789',fuel:'45678.9',s1:'1234.5',water:'54321',waste:'321.75',fem:'410',left:'87',
 governance:'Board-level ESG committee chaired by the CEO (demo text).',risk:'Annual risk review led by the plant manager (demo text).'};
// expected per-answer status after the scenario below (hand-derived from the links and statuses we set)
const EXP1={name:'ok',industry:'ok',year:'ok',emp:'ok',rev:'ok',elec:'ok',renew:'unv',fuel:'ok',s1:'ok',s2:'miss',ef:'opt',water:'unv',waste:'unv',rec:'miss',fem:'ok',left:'ok',inj:'miss',governance:'unv',strategy:'miss',risk:'unv',targets:'miss'};
const SEC={name:0,industry:0,year:0,emp:0,rev:0,elec:1,renew:1,fuel:1,s1:1,s2:1,ef:1,water:2,waste:2,rec:2,fem:3,left:3,inj:3,governance:4,strategy:4,risk:4,targets:4};
// the questionnaire shows one section at a time: open a field's section through the stepper, as a user does
const goSec=async(pg,id)=>{const b=pg.locator('.gg-v3-step[data-step="'+SEC[id]+'"]');if((await b.getAttribute('aria-current'))!=='step'){await b.click();await pg.waitForTimeout(120)}};
const pdfText=f=>execFileSync('pdftotext',['-enc','UTF-8',f,'-'],{encoding:'utf8'}).normalize('NFKC');
(async()=>{const s=await S.start('demo'),t=T.make();
 async function fresh(lang){const pg=await s.page();pg.on('dialog',d=>d.accept());await pg.setViewportSize({width:1280,height:900});await pg.goto(s.base+'GaonGreen_KISSB_Cloud_Beta.html');await pg.waitForTimeout(700);
  if(lang!=='en'){await pg.selectOption('#language',lang);await pg.waitForTimeout(500)}return pg}
 const H=pg=>({
  st:id=>pg.locator('.gg-ev-chip[data-for="'+id+'"] .gg-ev-badge').getAttribute('data-status'),
  all:()=>pg.evaluate(()=>Object.fromEntries(window.ggEvidenceMap.model().flatMap(x=>x.rows).map(r=>[r.id,r.st]))),
  ev:(i,v)=>pg.locator('#ggEvidence select[data-evidence="'+i+'"][data-kind="status"]').selectOption(String(v)),
  ref:(i,v)=>pg.locator('#ggEvidence input[data-evidence="'+i+'"][data-kind="reference"]').fill(v),
  link:async(id,i)=>{await goSec(pg,id);await pg.locator('.gg-ev-chip[data-for="'+id+'"] select.gg-ev-add').selectOption(String(i));await pg.waitForTimeout(150)},
  unlink:async(id,i)=>{await goSec(pg,id);await pg.locator('.gg-ev-chip[data-for="'+id+'"] .gg-ev-x[data-ev="'+i+'"]').click();await pg.waitForTimeout(150)},
  links:id=>pg.evaluate(id=>window.ggEvidenceStore.evidenceFor(id),id),
  build:async()=>{await pg.evaluate(()=>{const f=document.getElementById('form');f.requestSubmit?f.requestSubmit():f.dispatchEvent(new Event('submit',{cancelable:true}))});await pg.waitForTimeout(600)},
  csv:async sel=>{const [d]=await Promise.all([pg.waitForEvent('download',{timeout:8000}),pg.click(sel)]);const f=path.join(tmp,d.suggestedFilename());await d.saveAs(f);return{name:d.suggestedFilename(),raw:fs.readFileSync(f,'utf8')}},
  pdf:async name=>{const f=path.join(tmp,name);await pg.emulateMedia({media:'print'});await pg.pdf({path:f,format:'A4',printBackground:true});await pg.emulateMedia({media:'screen'});return{f,txt:pdfText(f),pages:+(/Pages:\s+(\d+)/.exec(execFileSync('pdfinfo',[f],{encoding:'utf8'}))||[0,0])[1]}}});
 const fillAll=async(pg,o)=>{for(const [id,v] of Object.entries(o)){await goSec(pg,id);if(id==='industry')await pg.selectOption('#industry',{index:v});else await pg.locator('#'+id).fill(v)}};
 const scenario=async(pg,h)=>{ // steps 2-6: company info, answers (s2, rec, inj, strategy, targets left missing; grid factor optional left empty), evidence references + statuses
  await fillAll(pg,{name:DEMO,...ANS});
  await h.ev(0,1);await h.ref(0,'BizReg_DEMO.pdf');await h.ev(1,1);await h.ref(1,'FS_2025_DEMO.pdf');await h.ev(2,1);await h.ref(2,'KEPCO_2025_DEMO.pdf');await h.ev(3,3);
  await h.ev(4,1);await h.ref(4,'Fuel_2025_DEMO.xlsx');await h.ev(5,1);await h.ref(5,'GHG_calc_DEMO.xlsx');await h.ev(6,2);await h.ref(6,'Water_2025_DEMO.pdf');await h.ev(8,1);await h.ev(10,4);
  await h.link('s1',4);await h.link('renew',2);await pg.waitForTimeout(200)};

 // ===================== ENGLISH: full workflow =====================
 {const pg=await fresh('en'),h=H(pg);
  // 1 new profile: the demo pre-fills only the fictional company name from its demo company profile; clear it to start from an empty profile
  await pg.fill('#name','');await pg.waitForTimeout(150);const c0=await pg.evaluate(()=>window.ggEvidenceMap.counts());
  await t.check('E2E-1','new profile starts empty: 20 required answers missing, 1 optional, no evidence statuses set, suggested links in place',async()=>({ok:c0.miss===20&&c0.opt===1&&c0.ok===0&&c0.unv===0&&await pg.evaluate(()=>window.ggEvidenceStore.isDefault()),expected:'miss 20, opt 1, default links',actual:JSON.stringify(c0)}));
  await scenario(pg,h);
  // 7 questionnaire indicators
  {const a=await h.all();const bad=Object.keys(EXP1).filter(k=>a[k]!==EXP1[k]);
   await t.check('E2E-2','after answers + evidence: every questionnaire status matches the hand-derived expectation (10 ok, 5 unverified, 5 missing, 1 optional)',async()=>({ok:!bad.length,expected:'all match',actual:bad.length?bad.map(k=>k+'='+a[k]+'≠'+EXP1[k]).join(' '):'all match'}))}
  {const l=await h.links('s1');const why=await pg.locator('.gg-ev-chip[data-for="renew"] .gg-ev-why').innerText();const pills=await pg.locator('.gg-ev-chip[data-for="s1"] .gg-ev-pill').count();
   await t.check('E2E-3','one answer, several evidence records: Scope 1 shows 2 linked records (fuel invoices + emissions calculations), both Available -> ok; renewable linked to 2 records, 1 needs review -> "1 of 2 linked records available"',async()=>({ok:JSON.stringify(l)==='[4,5]'&&pills===2&&(await h.st('s1'))==='ok'&&why==='1 of 2 linked records available',expected:'[4,5] ok; 1 of 2',actual:JSON.stringify({l,pills,why})}))}
  {const sup=await pg.locator('#ggEvidence .gg-evidence-card').nth(8).locator('.gg-ev-sup-txt').innerText();const sup2=await pg.locator('#ggEvidence .gg-evidence-card').nth(2).locator('.gg-ev-sup-txt').innerText();
   await t.check('E2E-4','one evidence record, several answers: "HR records" supports Employees, Female employees, Employees who left (all ok); a link added from the questionnaire appears on the card ("Electricity bills" now also supports Renewable electricity)',async()=>({ok:/Employees/.test(sup)&&/Female employees/.test(sup)&&/Employees who left/.test(sup)&&['emp','fem','left'].every(k=>EXP1[k]==='ok')&&/Electricity consumed/.test(sup2)&&/Renewable electricity/.test(sup2),expected:'both directions',actual:sup+' || '+sup2}))}
  {const g=await pg.locator('.gg-ev-chip[data-for="governance"] .gg-ev-why').innerText();await t.check('E2E-5','edge: answer whose only linked record is "Not applicable" stays unverified with reason',async()=>t.eq(g,'linked evidence marked not applicable'))}
  // 8-9 report
  await h.build();
  {const tiles=(await pg.locator('#ggEvMap [data-tile]').allInnerTexts()).map(x=>x.replace(/\s+/g,' '));const acts=await pg.locator('#ggEvMapActions li').allInnerTexts();const checks=await pg.locator('#ggEvMapChecks li').allInnerTexts();
   await t.check('E2E-6','report preview: tiles 10 / 5 / 5 of 20; next actions start with the missing answers then evidence to confirm',async()=>({ok:/^10 .*\(10 of 20\)/.test(tiles[0])&&/^5 .*\(5 of 20\)/.test(tiles[1])&&/^5 .*\(5 of 20\)/.test(tiles[2])&&acts[0]==='Answer Scope 2 emissions'&&acts.some(a=>/^Confirm or add evidence: Renewable electricity/.test(a)),expected:'10/5/5',actual:tiles.join(' | ')+' :: '+acts.join(' ; ')}));
   await t.check('E2E-7','evidence record checks flag: Available without reference (HR records), reference recorded but status Missing (Water), needs review (Renewable)',async()=>({ok:checks.some(c=>/HR headcount.*no document reference/.test(c))&&checks.some(c=>/Water bills.*marked Missing/.test(c))&&checks.some(c=>/Renewable electricity certificates.*needs review/.test(c)),expected:'3 flags',actual:checks.join(' ; ')}))}
  {const row=id=>pg.locator('#ggEvMap tr[data-row="'+id+'"] td.gg-evmap-ans').innerText();const v={rev:await row('rev'),elec:await row('elec'),fuel:await row('fuel'),year:await row('year'),s1:await row('s1')};
   const kpi=await pg.locator('#reportKpis').innerText();const ind=await pg.locator('table tr',{hasText:'Total energy'}).first().innerText();
   await t.check('E2E-8','large numbers formatted for display without changing values: 1,250,000 KRW million; 987,654,321 kWh; 45,678.9 GJ; 1,234.5 tCO2e; year stays 2025; existing indicator total energy = 987,654,321 x 0.0036 + 45,678.9 = 3,601,234.46 GJ',async()=>({ok:v.rev==='1,250,000 KRW million'&&v.elec==='987,654,321 kWh'&&v.fuel==='45,678.9 GJ'&&v.year==='2025'&&/1,234\.5 tCO₂e/.test(v.s1)&&/3,601,234\.46/.test(ind),expected:'formatted',actual:JSON.stringify(v)+' | '+ind.replace(/\s+/g,' ')}))}
  // 6+7 again: change statuses AFTER the report is open -> questionnaire, card and report update together
  await h.ev(3,1);await h.ref(3,'REC_2025_DEMO.pdf');await pg.waitForTimeout(250);
  {const tiles=(await pg.locator('#ggEvMap [data-tile]').allInnerTexts()).map(x=>x.split('\n')[0]);await t.check('E2E-9','changing "Renewable" to Available updates the questionnaire chip and the open report together (renewable -> ok; tiles 11 / 4 / 5)',async()=>({ok:(await h.st('renew'))==='ok'&&tiles.join('/')==='11/4/5',expected:'ok, 11/4/5',actual:(await h.st('renew'))+' '+tiles.join('/')}))}
  // links survive language switches and a reload; answers unchanged
  await pg.selectOption('#language','ko');await pg.waitForTimeout(400);await pg.selectOption('#language','en');await pg.waitForTimeout(400);
  await pg.reload();await pg.waitForTimeout(900);
  {const l=await h.links('s1'),r=await h.links('renew');await t.check('E2E-10','links and evidence persist across language switch and page reload (same account-scoped checklist record, no new storage key)',async()=>({ok:JSON.stringify(l)==='[4,5]'&&JSON.stringify(r)==='[2,3]'&&(await pg.inputValue('#ggEvidence select[data-evidence="3"][data-kind="status"]'))==='1',expected:'s1 [4,5], renew [2,3], renewable Available',actual:JSON.stringify({l,r})}))}
  // reload restores saved answers only via the existing Save/Resume flow, so re-enter the scenario answers (evidence + links are already persisted)
  await fillAll(pg,{name:DEMO,...ANS});await pg.waitForTimeout(200);await h.build();
  // 10-11 exports reflect the latest state
  {const c=await h.csv('#ggEvMapCsv');const L=c.raw.split('\r\n');const rr=L.find(l=>l.startsWith('"Energy and emissions","Renewable electricity"'))||'';const s1=L.find(l=>l.startsWith('"Energy and emissions","Scope 1 emissions"'))||'';
   await t.check('E2E-11','evidence-map CSV reflects the latest state: renewable now "Evidence on file" with both records and references; Scope 1 lists 2 records; raw numeric values (no thousands separators) for spreadsheets; fictional-data note',async()=>({ok:c.raw.charCodeAt(0)===0xfeff&&/"123456789","kWh","Evidence on file","","Electricity bills or meter readings \| Renewable electricity certificates \/ contracts","Available \(company-declared\) \| Available \(company-declared\)","KEPCO_2025_DEMO\.pdf \| REC_2025_DEMO\.pdf"/.test(rr)&&/"1234\.5","tCO₂e","Evidence on file","","Fuel invoices and conversion records \| Emissions calculations and factor sources"/.test(s1)&&/fictional in the demo/.test(c.raw)&&/^GaonGreen_Evidence_Map_Hanbit_Precision_Co_DEMO_fictional_2025\.csv$/.test(c.name),expected:'latest state',actual:c.name+' :: '+rr.slice(0,240)}))}
  {const c=await h.csv('#csvBtn');await t.check('E2E-12','existing indicator CSV still exports (BOM, total energy 3,601,234.46 GJ)',async()=>({ok:c.raw.charCodeAt(0)===0xfeff&&/Total energy","3,601,234\.46","GJ"/.test(c.raw),expected:'BOM + value',actual:c.raw.split('\r\n').find(l=>/Total energy/.test(l))}))}
  {const p=await h.pdf('kissb-en.pdf');const tx=p.txt.replace(/\s+/g,' ');
   await t.check('E2E-13','PDF (print) contains the report, the evidence readiness section with latest counts, formatted numbers and references; the interactive controls are not printed',async()=>({ok:p.pages>=2&&/Hanbit Precision Co\./.test(tx)&&/Evidence readiness by answer/.test(tx)&&/11 answers with evidence on file/.test(tx)&&/1,250,000 KRW million/.test(tx)&&/REC_2025_DEMO\.pdf/.test(tx)&&!/Link evidence/.test(tx)&&!/Download evidence map/.test(tx),expected:'report + section',actual:p.pages+' pages; '+tx.slice(0,160)}))}
  // remove a link and restore suggested links
  await h.unlink('s1',4);{const l1=await h.links('s1');await pg.click('#ggEvLinksReset');await pg.waitForTimeout(200);const l2=await h.links('s1'),r2=await h.links('renew');
   await t.check('E2E-14','removing a link updates immediately; "Restore suggested links" resets every link to the defaults without touching answers or statuses',async()=>({ok:JSON.stringify(l1)==='[5]'&&JSON.stringify(l2)==='[5]'&&JSON.stringify(r2)==='[3]'&&(await pg.inputValue('#rev'))==='1250000'&&(await pg.inputValue('#ggEvidence select[data-evidence="3"][data-kind="status"]'))==='1',expected:'[5] -> defaults',actual:JSON.stringify({l1,l2,r2})}))}
  // no duplicates: the add-list never offers an already linked record; toggling the same link twice is idempotent
  {await goSec(pg,'s1');const offered=await pg.locator('.gg-ev-chip[data-for="s1"] select.gg-ev-add option').allInnerTexts();const dup=await pg.evaluate(()=>{const S=window.ggEvidenceStore;S.setLink('s1',4,true);S.setLink('s1',4,true);return S.evidenceFor('s1')});
   await t.check('E2E-15','no duplicate links: an already-linked record is not offered again, and repeated linking keeps a single link',async()=>({ok:!offered.some(o=>/Emissions calculations/.test(o))&&JSON.stringify(dup)==='[4,5]',expected:'not offered; [4,5]',actual:JSON.stringify(dup)}))}
  // backup round trip keeps links; malformed link data is rejected
  {const b=await h.csv('#ggEvidenceExport');const o=JSON.parse(b.raw);const okB=o.data[4].answers.includes('s1')&&o.data[5].answers.includes('s1');
   const bad=JSON.parse(b.raw);bad.data[0].answers=['name','not-a-question'];const bf=path.join(tmp,'bad.json');fs.writeFileSync(bf,JSON.stringify(bad));
   await pg.setInputFiles('#ggEvidenceFile',bf);await pg.waitForTimeout(300);const msg=await pg.locator('#ggEvidenceStatus').innerText();
   await t.check('E2E-16','evidence backup includes the links; a backup with an unknown linked answer is rejected (nothing changes)',async()=>({ok:okB&&/Could not import/.test(msg)&&JSON.stringify(await h.links('s1'))==='[4,5]',expected:'links exported, bad rejected',actual:okB+' / '+msg}))}
  await t.check('E2E-17','English run: no page errors, no external requests',async()=>({ok:!pg.errors.length&&!pg.external.length,expected:'clean',actual:JSON.stringify({e:pg.errors,x:pg.external})}))}

 // ===================== KOREAN: essential workflow =====================
 {const pg=await fresh('ko'),h=H(pg);await scenario(pg,h);const a=await h.all();const bad=Object.keys(EXP1).filter(k=>a[k]!==EXP1[k]);
  const lab=await pg.locator('label[for="rev"]').innerText(),lab2=await pg.locator('label[for="emp"]').innerText();const why=await pg.locator('.gg-ev-chip[data-for="renew"] .gg-ev-why').innerText();
  await t.check('E2E-KO1','Korean: same statuses as English; units localised in the questionnaire (매출액 (백만 원), 직원 수 (명)); reason text in Korean',async()=>({ok:!bad.length&&/백만 원/.test(lab)&&/\(명\)/.test(lab2)&&why==='연결 증빙 2건 중 1건 보유',expected:'match + Korean units',actual:JSON.stringify({bad,lab:lab.split('\n')[0],lab2:lab2.split('\n')[0],why})}));
  await h.build();const ans=await pg.locator('#ggEvMap tr[data-row="rev"] td.gg-evmap-ans').innerText();const unitCell=await pg.locator('table tr',{hasText:'총 에너지'}).first().innerText().catch(()=>'');const tiles=(await pg.locator('#ggEvMap [data-tile]').allInnerTexts()).map(x=>x.split('\n')[0]);
  await t.check('E2E-KO2','Korean report: title, tiles 10/5/5, revenue shown as "1,250,000 백만 원"; indicator units localised (GJ / 백만 원)',async()=>({ok:(await pg.locator('#ggEvMap h2').innerText())==='답변별 증빙 준비 현황'&&tiles.join('/')==='10/5/5'&&ans==='1,250,000 백만 원'&&/백만 원/.test(await pg.locator('#indicators').innerText()),expected:'Korean report',actual:JSON.stringify({ans,tiles})}));
  const c=await h.csv('#ggEvMapCsv'),c2=await h.csv('#csvBtn');
  await t.check('E2E-KO3','Korean CSV exports: UTF-8 with BOM (Excel shows Hangul), Korean header and statuses; indicator CSV Korean too',async()=>({ok:c.raw.charCodeAt(0)===0xfeff&&/^﻿"구분","질문","답변","단위","상태"/.test(c.raw)&&/"증빙 보유"/.test(c.raw)&&/"입력됨 – 증빙 미확인","연결 증빙 2건 중 1건 보유"/.test(c.raw)&&c2.raw.charCodeAt(0)===0xfeff&&/[가-힣]/.test(c2.raw),expected:'BOM + Hangul',actual:c.raw.split('\r\n')[0]}));
  const p=await h.pdf('kissb-ko.pdf');const tx=p.txt.replace(/\s+/g,' ');
  await t.check('E2E-KO4','Korean PDF: Hangul text is embedded and extractable (title, statuses, units)',async()=>({ok:/답변별 증빙 준비 현황/.test(tx)&&/증빙 보유/.test(tx)&&/백만 원/.test(tx)&&/Hanbit Precision/.test(tx),expected:'Hangul in PDF',actual:tx.slice(0,200)}));
  await t.check('E2E-KO5','Korean run: no page errors, no external requests',async()=>({ok:!pg.errors.length&&!pg.external.length,expected:'clean',actual:JSON.stringify({e:pg.errors,x:pg.external})}))}

 // ===================== ARABIC (RTL): essential workflow =====================
 {const pg=await fresh('ar'),h=H(pg);await scenario(pg,h);const a=await h.all();const bad=Object.keys(EXP1).filter(k=>a[k]!==EXP1[k]);
  await h.build();
  const g=await pg.evaluate(()=>{const tb=document.querySelector('#ggEvMap .gg-evmap-table'),th=[...tb.querySelectorAll('th')],r=th.map(x=>x.getBoundingClientRect().left);const cell=document.querySelector('#ggEvMap tr[data-row="rev"] td.gg-evmap-ans');
   return{dir:document.documentElement.dir,tdir:getComputedStyle(tb).direction,align:getComputedStyle(th[0]).textAlign,firstRight:r[0]>r[1]&&r[1]>r[2]&&r[2]>r[3],ans:cell.innerText,overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+2,indDir:getComputedStyle(document.getElementById('indicators')).direction}});
  await t.check('E2E-AR1','Arabic: same statuses; RTL page and tables (direction rtl, columns run right-to-left, text aligned to start), no horizontal overflow; indicator table RTL',async()=>({ok:!bad.length&&g.dir==='rtl'&&g.tdir==='rtl'&&g.firstRight&&/start|right/.test(g.align)&&!g.overflow&&g.indDir==='rtl',expected:'rtl ok',actual:JSON.stringify({bad,...g})}));
  await t.check('E2E-AR2','Arabic numbers and units: revenue "1,250,000 مليون وون" (same Western-digit convention as the existing Arabic report); units localised in labels and indicators',async()=>({ok:g.ans==='1,250,000 مليون وون'&&/مليون وون/.test(await pg.locator('label[for="rev"]').innerText())&&/مليون وون/.test(await pg.locator('#indicators').innerText()),expected:'1,250,000 مليون وون',actual:g.ans}));
  const c=await h.csv('#ggEvMapCsv');await t.check('E2E-AR3','Arabic CSV: BOM, Arabic header and statuses, references intact',async()=>({ok:c.raw.charCodeAt(0)===0xfeff&&/^﻿"القسم","السؤال"/.test(c.raw)&&/"الدليل متوفر"/.test(c.raw)&&/KEPCO_2025_DEMO\.pdf/.test(c.raw),expected:'Arabic CSV',actual:c.raw.split('\r\n')[0]}));
  await pg.locator('#ggEvMap').screenshot({path:path.join(tmp,'ar-map.png')});const p=await h.pdf('kissb-ar.pdf');const tx=p.txt;
  await t.check('E2E-AR4','Arabic PDF: generated, contains the evidence section (Arabic words present after NFKC normalisation), references and formatted numbers',async()=>({ok:p.pages>=2&&/KEPCO_2025_DEMO\.pdf/.test(tx)&&/1,250,000/.test(tx)&&/[؀-ۿ]/.test(tx),expected:'Arabic PDF',actual:p.pages+' pages'}));
  await t.check('E2E-AR5','Arabic run: no page errors, no external requests',async()=>({ok:!pg.errors.length&&!pg.external.length,expected:'clean',actual:JSON.stringify({e:pg.errors,x:pg.external})}))}

 // ===================== edge: empty company profile =====================
 {const pg=await fresh('en'),h=H(pg);await pg.fill('#name','');await pg.waitForTimeout(100);await h.build();const vis=await pg.locator('#ggEvMap').isVisible();const tiles=(await pg.locator('#ggEvMap [data-tile]').allInnerTexts()).map(x=>x.split('\n')[0]);
  const c=await h.csv('#ggEvMapCsv');await t.check('E2E-EMPTY','empty company profile: report and evidence section still render (0 / 0 / 20), CSV exports with a generic file name, no errors',async()=>({ok:vis&&tiles.join('/')==='0/0/20'&&c.name==='GaonGreen_Evidence_Map_company.csv'&&!pg.errors.length&&!pg.external.length,expected:'0/0/20, generic name',actual:tiles.join('/')+' '+c.name}))}
 await s.close();const outDir=process.env.GG_E2E_ARTIFACTS;if(outDir){fs.mkdirSync(outDir,{recursive:true});for(const f of fs.readdirSync(tmp))fs.copyFileSync(path.join(tmp,f),path.join(outDir,f))}
 fs.writeFileSync(process.argv[2]||'func-kissb-e2e.json',JSON.stringify({run:new Date().toISOString(),build:'OFFLINE DEMO, fictional SME (DEMO data); exports read back from disk',results:t.res},null,1));
 process.exit(t.res.every(x=>x.status==='PASS')?0:1)})().catch(e=>{console.error(e);process.exit(1)});
