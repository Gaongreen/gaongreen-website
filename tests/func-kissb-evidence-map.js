// K-ISSB evidence map (answers <-> evidence checklist) on the OFFLINE DEMO build: page logic only, fictional data, no Supabase, no network.
// Statuses: ok = answered AND checklist "Available"; unv = answered, evidence not "Available"; miss = required answer empty; opt = optional (grid factor) empty.
const S=require('./lib/serve.js'),T=require('./lib/t.js'),fs=require('fs');
const LINK={name:0,industry:0,year:0,emp:8,rev:1,elec:2,renew:3,fuel:4,s1:5,s2:5,ef:5,water:6,waste:7,rec:7,fem:8,left:8,inj:9,governance:10,strategy:11,risk:11,targets:12};
(async()=>{const s=await S.start('demo'),t=T.make();
 const pg=await s.page();pg.on('dialog',d=>d.accept());await pg.goto(s.base+'GaonGreen_KISSB_Cloud_Beta.html');await pg.waitForTimeout(700);
 const st=id=>pg.locator('.gg-ev-chip[data-for="'+id+'"] .gg-ev-badge').getAttribute('data-status');
 const ev=i=>pg.locator('#ggEvidence select[data-evidence="'+i+'"][data-kind="status"]');const ref=i=>pg.locator('#ggEvidence input[data-evidence="'+i+'"][data-kind="reference"]');
 const counts=()=>pg.evaluate(()=>window.ggEvidenceMap.counts());const settle=()=>pg.waitForTimeout(120);
 const next=async n=>{for(let i=0;i<n;i++)await pg.click('#ggV3Next')},prev=async n=>{for(let i=0;i<n;i++)await pg.click('#ggV3Prev')};
 const keys0=await pg.evaluate(()=>Object.keys(localStorage).sort());
 // E1 initial
 {const chips=await pg.locator('.gg-ev-chip').count();const c=await counts();
  // the demo pre-fills only the company name from the fictional company profile; with no evidence marked it must count as UNVERIFIED, never ok
  const nm=await st('name');
  await t.check('KM1','every one of the 21 questions shows an evidence-status chip; fresh form: only the profile-prefilled company name is answered and it is unverified (no evidence marked); 19 missing + 1 optional',async()=>({ok:chips===21&&nm==='unv'&&c.unv===1&&c.miss===19&&c.opt===1&&c.ok===0&&c.req===20,expected:'21 chips, name unv, miss 19, opt 1',actual:`${chips} chips, name=${nm}, ${JSON.stringify(c)}`}))}
 // E2 status transitions for one answer
 {const a=[];await pg.fill('#emp','100');await settle();a.push(await st('emp'));await ev(8).selectOption('1');await settle();a.push(await st('emp'));
  await ev(8).selectOption('3');await settle();a.push(await st('emp'));await ev(8).selectOption('4');await settle();a.push(await st('emp'));await ev(8).selectOption('1');await settle();a.push(await st('emp'));
  await pg.fill('#emp','');await settle();a.push(await st('emp'));await pg.fill('#emp','100');await settle();
  await t.check('KM2','status follows answer + evidence: answered->unverified; Available->ok; Needs review->unverified; Not applicable->unverified; Available->ok; cleared answer->missing',async()=>t.eq(a.join(','),'unv,ok,unv,unv,ok,miss'))}
 // E3 one evidence record drives every answer linked to it; other answers unaffected
 {await pg.fill('#name','Example Exporter Co.');await pg.selectOption('#industry',{index:1});await pg.fill('#year','2025');await settle();const before=[await st('name'),await st('industry'),await st('year')].join(',');
  await ev(0).selectOption('1');await settle();const after=[await st('name'),await st('industry'),await st('year'),await st('rev')].join(',');
  await t.check('KM3','marking "Business registration" Available turns name/industry/year (its linked answers) to ok and leaves unrelated Revenue missing',async()=>t.eq(before+' | '+after,'unv,unv,unv | ok,ok,ok,miss'))}
 // E4 reverse link on evidence cards
 {const txt=await pg.locator('#ggEvidence .gg-evidence-card').nth(5).locator('.gg-ev-supports').innerText();
  await t.check('KM4','evidence card "Emissions calculations" lists the answers it supports (Scope 1, Scope 2, grid factor)',async()=>({ok:/Supports answers/.test(txt)&&/Scope 1 emissions/.test(txt)&&/Scope 2 emissions/.test(txt)&&/Grid emission factor/.test(txt),expected:'Scope 1, Scope 2, grid factor',actual:txt}))}
 // E5 "Update evidence" jumps to the linked record
 {await pg.click('.gg-ev-chip[data-for="rev"] .gg-ev-go');await pg.waitForTimeout(400);const f=await pg.evaluate(()=>({ev:document.activeElement&&document.activeElement.dataset.evidence,kind:document.activeElement&&document.activeElement.dataset.kind}));
  await t.check('KM5','"Update evidence" on Revenue focuses the status of the linked record (#1 Financial statements) without changing the answer',async()=>({ok:f.ev==='1'&&f.kind==='status'&&(await pg.inputValue('#rev'))==='',expected:'evidence 1 status focused',actual:JSON.stringify(f)}))}
 // scenario for the report: hand-computed ok 5 (name, industry, year, rev, elec), unverified 4 (emp, renew, s1, governance), missing 11, optional 1
 await ev(8).selectOption('0');await pg.fill('#rev','5000');await ev(1).selectOption('1');await ref(1).fill('FS_2025_audited.pdf');await next(1);
 for(const [id,v] of Object.entries({elec:'1000000',renew:'250000',s1:'120'}))await pg.fill('#'+id,v);await ev(2).selectOption('1');await ref(2).fill('KEPCO_bills_2025.pdf');
 await next(3);await pg.fill('#governance','The CEO reviews ESG quarterly.');await pg.getByRole('button',{name:/Build my dashboard/}).click();await pg.waitForTimeout(700);
 {const vis=await pg.locator('#ggEvMap').isVisible();const order=await pg.evaluate(()=>{const o=[...document.getElementById('out').children].map(c=>c.id);return o.indexOf('ggEvMap')===o.indexOf('reportGraph')+1});
  const tiles=await pg.locator('#ggEvMap [data-tile]').allInnerTexts();
  await t.check('KM6','report shows "Evidence readiness by answer" right after the report graph with tiles 5 ok / 4 unverified / 11 missing (of 20)',async()=>({ok:vis&&order&&/^5\b/.test(tiles[0])&&/\(5 of 20\)/.test(tiles[0])&&/^4\b/.test(tiles[1])&&/^11\b/.test(tiles[2]),expected:'5 / 4 / 11 of 20',actual:tiles.join(' | ').replace(/\n/g,' ')}))}
 {const rows=await pg.locator('#ggEvMap tbody tr[data-row]').count();const st2=await pg.evaluate(()=>[...document.querySelectorAll('#ggEvMap tr[data-row]')].map(r=>r.dataset.row+':'+r.querySelector('.gg-ev-badge').className.replace(/.*gg-st-/,'')).join(' '));
  const exp='name:ok industry:ok year:ok emp:unv rev:ok elec:ok renew:unv fuel:miss s1:unv s2:miss ef:opt water:miss waste:miss rec:miss fem:miss left:miss inj:miss governance:unv strategy:miss risk:miss targets:miss';
  await t.check('KM7','report table has one row per question (21) with the expected status for each',async()=>({ok:rows===21&&st2===exp,expected:exp,actual:rows+' rows: '+st2}))}
 {const acts=await pg.locator('#ggEvMapActions li').allInnerTexts();const more=await pg.locator('#ggEvMap').innerText();
  await t.check('KM8','Next actions lists missing answers first (max 8 shown, rest counted) and evidence to confirm for unverified answers',async()=>({ok:acts.length===8&&/^Answer Fuel consumed/.test(acts[0])&&/\+7 more/.test(more),expected:'8 shown, +7 more (11 missing + 4 evidence records)',actual:acts.length+' / '+(more.match(/\+\d+ more/)||[''])[0]}))}
 {const refTxt=await pg.locator('#ggEvMap tr[data-row="rev"]').innerText();await t.check('KM9','report row shows the evidence record and the document reference typed in the checklist',async()=>({ok:/Financial statements/.test(refTxt)&&/FS_2025_audited\.pdf/.test(refTxt)&&/Available/.test(refTxt),expected:'record + reference',actual:refTxt.replace(/\s+/g,' ')}))}
 // E10 CSV export (with formula-injection guard)
 await prev(3);await prev(1);await pg.fill('#name','=HYPERLINK("x")');await next(4);await pg.getByRole('button',{name:/Build my dashboard/}).click();await pg.waitForTimeout(500);
 {const [d]=await Promise.all([pg.waitForEvent('download',{timeout:5000}),pg.click('#ggEvMapCsv')]);const raw=fs.readFileSync(await d.path(),'utf8');const lines=raw.split('\r\n');
  const data=lines.slice(1).filter(l=>/^"/.test(l)&&!/Self-reported/.test(l));
  await t.check('KM10','CSV evidence map: UTF-8 BOM, 9-column header (incl. status detail and all linked records), 21 question rows, disclaimer line, formula cells neutralised',async()=>({ok:raw.charCodeAt(0)===0xfeff&&/^﻿"Section","Question","Answer","Unit","Status","Status detail","Linked evidence records","Checklist statuses","Document references"$/.test(lines[0])&&data.length===21&&lines.some(l=>/"Revenue","5000","KRW million","Evidence on file","","Financial statements[^"]*","Available \(company-declared\)","FS_2025_audited\.pdf"/.test(l))&&lines.some(l=>l.includes('"\'=HYPERLINK(""x"")"'))&&/not verified by GaonGreen/.test(raw)&&/^GaonGreen_Evidence_Map_.*_2025\.csv$/.test(d.suggestedFilename()),expected:'BOM, header, 21 rows, guard, note',actual:`${d.suggestedFilename()} rows=${data.length} first=${lines[0].slice(0,40)}`}))}
 await prev(4);await pg.fill('#name','Example Exporter Co.');await next(4);await pg.getByRole('button',{name:/Build my dashboard/}).click();await pg.waitForTimeout(500);
 // E11 Korean and Arabic (RTL), answers preserved through the language re-render
 for(const [l,title,ok,dir] of [['ko','답변별 증빙 준비 현황','증빙 보유','ltr'],['ar','جاهزية الأدلة لكل إجابة','الدليل متوفر','rtl']]){await pg.selectOption('#language',l);await pg.waitForTimeout(600);
  const r={title:await pg.locator('#ggEvMap h2').innerText(),dir:await pg.evaluate(()=>document.documentElement.dir),chips:await pg.locator('.gg-ev-chip').count(),badge:await pg.locator('.gg-ev-chip[data-for="rev"] .gg-ev-badge').innerText(),rev:await pg.inputValue('#rev'),c:await counts(),
   sup:await pg.locator('#ggEvidence .gg-evidence-card').first().locator('.gg-ev-supports').innerText(),en:/Evidence on file|Missing answer|Next actions/.test(await pg.locator('#ggEvMap').innerText())};
  await t.check('KM11-'+l,l+': report title, chips and evidence links translated, dir='+dir+', 21 chips, answers and counts unchanged, no English status text left',async()=>({ok:r.title===title&&r.badge===ok&&r.dir===dir&&r.chips===21&&r.rev==='5000'&&r.c.ok===5&&r.c.unv===4&&r.c.miss===11&&!r.en&&r.sup.length>5,expected:title+' / '+ok+' / '+dir,actual:JSON.stringify(r).slice(0,220)}))}
 await pg.selectOption('#language','en');await pg.waitForTimeout(400);
 // E12 print: section printed, interactive bits hidden
 {await pg.emulateMedia({media:'print'});const p={map:await pg.locator('#ggEvMap').isVisible(),btn:await pg.locator('#ggEvMapCsv').isVisible(),chip:await pg.locator('.gg-ev-chip').first().isVisible()};await pg.emulateMedia({media:'screen'});
  await t.check('KM12','print/PDF: the evidence readiness section is printed; CSV button and questionnaire chips are not',async()=>({ok:p.map&&!p.btn&&!p.chip,expected:'map yes, button no, chip no',actual:JSON.stringify(p)}))}
 // E13 existing report still intact
 {const ok=await pg.locator('#reportCover').isVisible()&&await pg.locator('#reportKpis').isVisible()&&(await pg.locator('table tr',{hasText:'Total energy'}).count())>0&&await pg.locator('#csvBtn').isVisible();
  await t.check('KM13','existing report (cover, KPIs, indicator table, CSV button) still rendered alongside the new section',async()=>({ok,expected:'intact',actual:String(ok)}))}
 // E14 no new storage, no network, no page errors
 {const keys1=await pg.evaluate(()=>Object.keys(localStorage).sort());const html=fs.readFileSync('GaonGreen_KISSB_Cloud_Beta.html','utf8');const blk=html.slice(html.indexOf('<script id="gg-evidence-map">'),html.indexOf('</script>',html.indexOf('<script id="gg-evidence-map">')));
  const newKeys=keys1.filter(k=>!keys0.includes(k)&&!/gaongreen-evidence-v1|gaongreen-language|kissb|gg-|sb-/i.test(k));
  await t.check('KM14','feature adds no storage key and no network code (no localStorage/sessionStorage/indexedDB/fetch/XMLHttpRequest/supabase in its script); no page errors; no external requests',async()=>({ok:blk.length>1000&&!/localStorage|sessionStorage|indexedDB|fetch\(|XMLHttpRequest|supabase|WebSocket|sendBeacon/.test(blk)&&pg.errors.length===0&&pg.external.length===0&&newKeys.length===0,expected:'clean',actual:JSON.stringify({errors:pg.errors,external:pg.external,newKeys})}))}
 await s.close();fs.writeFileSync(process.argv[2]||'func-kissb-evidence-map.json',JSON.stringify({run:new Date().toISOString(),build:'OFFLINE DEMO (fictional data; stand-in backend)',results:t.res},null,1));
 process.exit(t.res.every(x=>x.status==='PASS')?0:1)})().catch(e=>{console.error(e);process.exit(1)});
