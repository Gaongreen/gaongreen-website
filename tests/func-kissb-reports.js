// K-ISSB evidence checklist, CSV, backup and report-button checks on the OFFLINE DEMO build (page logic; no real Supabase involved).
const S=require('./lib/serve.js'),T=require('./lib/t.js'),fs=require('fs');
const tmp=process.env.TMPDIR_T||'/tmp/claude-0';
(async()=>{const s=await S.start('demo'),t=T.make();
 const pg=await s.page();pg.on('dialog',d=>d.accept());await pg.goto(s.base+'GaonGreen_KISSB_Cloud_Beta.html');await pg.waitForTimeout(600);
 const sels=pg.locator('select').filter({has:pg.locator('option',{hasText:/Available/})});
 const dl=async(btn)=>{const [d]=await Promise.all([pg.waitForEvent('download',{timeout:5000}),pg.click(btn)]);return{name:d.suggestedFilename(),text:fs.readFileSync(await d.path(),'utf8')}};
 const progress=()=>pg.locator('#ggEvidenceProgress').innerText();
 await t.check('K-E1','Evidence checklist has 13 items, all start "Not reviewed", progress 0 / 13',async()=>({ok:(await sels.count())===13&&(await progress())==='Available evidence: 0 / 13',expected:'13 items, 0 / 13',actual:`${await sels.count()} items, ${await progress()}`}));
 await sels.nth(0).selectOption('1');await sels.nth(1).selectOption('1');await sels.nth(2).selectOption('2');await sels.nth(3).selectOption('3');await sels.nth(4).selectOption('4');
 await pg.getByLabel(/Document reference/).first().fill('DOC-001 fictional');await pg.waitForTimeout(200);
 await t.check('K-E2','Only "Available" counts toward progress (2 available, 1 missing, 1 needs review, 1 N/A -> 2 / 13)',async()=>t.eq(await progress(),'Available evidence: 2 / 13'));
 await pg.click('#ggEvidenceSave');await pg.waitForTimeout(300);
 const ev=await dl('#ggEvidenceExport');let ej={};try{ej=JSON.parse(ev.text)}catch(e){}
 await t.check('K-E3','Evidence export is typed JSON with 13 entries, statuses [1,1,2,3,4,...] and the reference kept',async()=>({ok:ej.type==='GaonGreenEvidence'&&Array.isArray(ej.data)&&ej.data.length===13&&ej.data.slice(0,5).map(x=>x.status).join()==='1,1,2,3,4'&&ej.data[0].reference==='DOC-001 fictional',expected:'GaonGreenEvidence/13/1,1,2,3,4/ref',actual:ev.text.slice(0,120).replace(/\s+/g,' ')}));
 await pg.click('#ggEvidenceClear');await pg.waitForTimeout(300);
 const clearedProgress=await progress();
 fs.writeFileSync(tmp+'/evidence-export.json',ev.text);await pg.setInputFiles('#ggEvidenceFile',tmp+'/evidence-export.json');await pg.click('#ggEvidenceImport');await pg.waitForTimeout(500);
 await t.check('K-E4','Evidence clear then import restores progress, statuses and reference (round trip)',async()=>({ok:clearedProgress==='Available evidence: 0 / 13'&&(await progress())==='Available evidence: 2 / 13'&&(await pg.getByLabel(/Document reference/).first().inputValue())==='DOC-001 fictional'&&(await sels.nth(3).inputValue())==='3',expected:'0/13 then 2/13 + ref + status 3',actual:`${clearedProgress} -> ${await progress()}`}));
 await pg.setInputFiles('#ggEvidenceFile',{name:'wrong.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({type:'SomethingElse',version:1,data:[{status:1}]}))});await pg.click('#ggEvidenceImport');await pg.waitForTimeout(400);
 await t.check('K-E5','Evidence import of a wrong-type file is refused and leaves progress unchanged',async()=>t.eq(await progress(),'Available evidence: 2 / 13'));
 await pg.setInputFiles('#ggEvidenceFile',{name:'junk.json',mimeType:'application/json',buffer:Buffer.from('{not json')});await pg.click('#ggEvidenceImport');await pg.waitForTimeout(400);
 await t.check('K-E6','Evidence import of malformed JSON does not crash or change progress',async()=>({ok:(await progress())==='Available evidence: 2 / 13'&&pg.errors.length===0,expected:'unchanged, no JS error',actual:`${await progress()} errors=${pg.errors.length}`}));
 // main form + CSV + backup round trip
 await pg.fill('#name','Example Exporter Co.');await pg.selectOption('#industry',{index:1});await pg.fill('#year','2025');await pg.fill('#emp','100');await pg.fill('#rev','5000');await pg.click('#ggV3Next');
 for(const [id,v] of Object.entries({elec:'1000000',renew:'250000',fuel:'500',s1:'120',s2:'300'}))await pg.fill('#'+id,v);
 for(let i=0;i<3;i++)await pg.click('#ggV3Next');await pg.getByRole('button',{name:/Build my dashboard/}).click();await pg.waitForTimeout(600);
 const csv=await dl('#csvBtn');const lines=csv.text.replace(/^﻿/,'').split('\r\n').filter(Boolean);
 await t.check('K-R1','CSV: UTF-8 BOM, CRLF, header Indicator,Value,Unit,Note, quoted cells',async()=>({ok:csv.text.charCodeAt(0)===0xFEFF&&lines[0]==='"Indicator","Value","Unit","Note"',expected:'BOM + header',actual:JSON.stringify(csv.text.slice(0,40))}));
 await t.check('K-R2','CSV carries the verified indicator values (420, 0.08, 4.2, 4,100, 0.82, 25) and Missing for blanks',async()=>{const want=['"Total Scope 1 + 2 emissions","420"','"GHG intensity per revenue","0.08"','"GHG emissions per employee","4.2"','"Total energy","4,100"','"Energy intensity per revenue","0.82"','"Renewable electricity share","25"','"Water intensity per revenue","Missing"'];const miss=want.filter(w=>!lines.some(l=>l.startsWith(w)));return{ok:!miss.length,expected:'all rows present',actual:'missing: '+JSON.stringify(miss)}});
 await t.check('K-R3','CSV: no cell begins with = + - @ (formula-injection guard on this indicator export)',async()=>({ok:!lines.slice(1).some(l=>/^"[=+\-@]/.test(l)||/","[=+\-@]/.test(l.replace(/","-?[0-9.,]+"/g,''))),expected:'no formula-leading cells',actual:'checked '+lines.length+' rows'}));
 await t.check('K-R4','CSV file name is GaonGreen_ESG_Indicators.csv',async()=>t.eq(csv.name,'GaonGreen_ESG_Indicators.csv'));
 const bk=await dl('#ggExport');let bj={};try{bj=JSON.parse(bk.text)}catch(e){}
 await t.check('K-B1','Backup JSON carries version, language and the entered fields',async()=>({ok:bj.version===1&&bj.language==='en'&&bj.data&&bj.data.name==='Example Exporter Co.'&&bj.data.elec==='1000000'&&bj.data.s2==='300',expected:'v1/en/name/elec/s2',actual:bk.text.slice(0,120).replace(/\s+/g,' ')}));
 await pg.click('#ggClear');await pg.waitForTimeout(400);await pg.click('#editBtn').catch(()=>{});
 fs.writeFileSync(tmp+'/kissb-backup.json',bk.text);await pg.setInputFiles('#ggFile',tmp+'/kissb-backup.json');await pg.click('#ggImport');await pg.waitForTimeout(600);
 const val=async id=>{for(let i=0;i<4;i++){if(await pg.locator('#'+id).isVisible())return pg.inputValue('#'+id);await pg.click('#ggV3Prev').catch(()=>{})}return pg.evaluate(i=>document.getElementById(i).value,id)};
 await t.check('K-B2','Backup: clear then import restores company, electricity and Scope 2 (round trip)',async()=>{const v=[await pg.evaluate(()=>document.getElementById('name').value),await pg.evaluate(()=>document.getElementById('elec').value),await pg.evaluate(()=>document.getElementById('s2').value)];return{ok:v.join('|')==='Example Exporter Co.|1000000|300',expected:'Example Exporter Co.|1000000|300',actual:v.join('|')}});
 await pg.setInputFiles('#ggFile',{name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"version":99,"data":"x"}')});await pg.click('#ggImport');await pg.waitForTimeout(400);
 await t.check('K-B3','Backup: a file with an unsupported shape does not wipe the form',async()=>({ok:(await pg.evaluate(()=>document.getElementById('name').value))==='Example Exporter Co.'&&pg.errors.length===0,expected:'unchanged, no JS error',actual:`${await pg.evaluate(()=>document.getElementById('name').value)} errors=${pg.errors.length}`}));
 // report generation buttons: must not throw; record what they do
 await pg.evaluate(()=>{window.__printed=0;window.print=()=>{window.__printed++};window.__opened=[];const o=window.open;window.open=(...a)=>{window.__opened.push(String(a[0]||'').slice(0,40));return o?o.apply(window,a):null}});
 // Dashboard must be rebuilt after the import before the report buttons are visible.
 for(let i=0;i<4;i++)await pg.click('#ggV3Next',{timeout:1500}).catch(()=>{});await pg.getByRole('button',{name:/Build my dashboard/}).click({timeout:5000}).catch(()=>{});await pg.waitForTimeout(500);
 const before=pg.errors.length;const vis1=await pg.locator('#pdfBtn').isVisible(),vis2=await pg.locator('#brandedPdfBtn').isVisible();
 let clickErr='';await pg.locator('#pdfBtn').click({timeout:4000}).catch(e=>clickErr=e.message.slice(0,60));await pg.waitForTimeout(300);const p1=await pg.evaluate(()=>window.__printed);
 await pg.locator('#brandedPdfBtn').click({timeout:4000}).catch(e=>clickErr+=' '+e.message.slice(0,60));await pg.waitForTimeout(300);const p2=await pg.evaluate(()=>window.__printed);
 await t.check('K-R5','Both report buttons are visible after building the dashboard and each calls the browser print dialog (print stubbed; PDF file not produced by this test)',async()=>({ok:vis1&&vis2&&p1===1&&p2===2&&pg.errors.length===before,expected:'visible,visible, print x1 then x2, no JS error',actual:JSON.stringify({vis1,vis2,p1,p2,clickErr,newErrors:pg.errors.length-before})}));
 await pg.context().close();await s.close();
 fs.writeFileSync(process.argv[2]||'func-kissb-reports.json',JSON.stringify({run:new Date().toISOString(),build:'demo (offline stand-in; NOT real Supabase)',results:t.res},null,1));
 process.exit(t.res.some(r=>r.status!=='PASS')?1:0)})();
