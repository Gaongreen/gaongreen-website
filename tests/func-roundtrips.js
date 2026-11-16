// JSON/CSV export + import round trips for K-RE100, EPR, Supplier, QR, Evidence Locker, plus CSV formula-injection check.
// OFFLINE DEMO build; exports/imports are browser-local so these results are meaningful for the real pages too, but the cloud parts are not exercised here.
const S=require('./lib/serve.js'),T=require('./lib/t.js'),fs=require('fs');const tmp=process.env.TMPDIR_T||'/tmp/claude-0';
(async()=>{const s=await S.start('demo'),t=T.make();
 const open=async f=>{const pg=await s.page();pg.on('dialog',d=>d.accept());await pg.goto(s.base+f);await pg.waitForTimeout(500);return pg};
 const dl=async(pg,sel)=>{const [d]=await Promise.all([pg.waitForEvent('download',{timeout:5000}),pg.click(sel)]);return{name:d.suggestedFilename(),text:fs.readFileSync(await d.path(),'utf8')}};
 const parseCsv=txt=>{const rows=[];let row=[],cell='',q=false;txt=txt.replace(/^﻿/,'');for(let i=0;i<txt.length;i++){const c=txt[i];if(q){if(c==='"'&&txt[i+1]==='"'){cell+='"';i++}else if(c==='"')q=false;else cell+=c}else if(c==='"')q=true;else if(c===','){row.push(cell);cell=''}else if(c==='\r'){}else if(c==='\n'){row.push(cell);rows.push(row);row=[];cell=''}else cell+=c}if(cell||row.length){row.push(cell);rows.push(row)}return rows};
 const val=(pg,id)=>pg.inputValue('#'+id);
 // ---- K-RE100
 let pg=await open('GaonGreen_K-RE100_Cloud_Beta.html');
 for(const [id,v] of Object.entries({company:'RT Co',total:'1200',m_ppa:'300',r_ppa:'PPA-1',m_rec:'200',additional:'400'}))await pg.fill('#'+id,v);
 const kj=await dl(pg,'#json');let kjj={};try{kjj=JSON.parse(kj.text)}catch(e){}
 await t.check('R-K1','K-RE100 JSON export: app, version, company, PPA 300, REC 200, evidence reference',async()=>({ok:kjj.version===1&&kjj.data&&kjj.data.company==='RT Co'&&kjj.data.methods.ppa==='300'&&kjj.data.methods.rec==='200'&&JSON.stringify(kjj.data).includes('PPA-1'),expected:'fields present',actual:kj.text.slice(0,100).replace(/\s+/g,' ')}));
 await pg.click('#clear');await pg.waitForTimeout(300);const cleared=await val(pg,'total');
 fs.writeFileSync(tmp+'/kre.json',kj.text);await pg.setInputFiles('#importFile',tmp+'/kre.json');await pg.click('#importBtn');await pg.waitForTimeout(500);
 await t.check('R-K2','K-RE100 JSON clear then import restores values and recalculates (sum 500, projected 75%)',async()=>({ok:cleared===''&&await val(pg,'total')==='1200'&&await val(pg,'m_ppa')==='300'&&(await pg.locator('#sum').innerText())==='500'&&(await pg.locator('#projected').innerText())==='75%',expected:'restored + sum 500 + 75%',actual:`${cleared}|${await val(pg,'total')}|${await pg.locator('#sum').innerText()}|${await pg.locator('#projected').innerText()}`}));
 const kc=await dl(pg,'#csv');const kr=parseCsv(kc.text);const kmap=Object.fromEntries(kr.filter(r=>r.length>=2).map(r=>[r[0],r[1]]));
 await t.check('R-K3','K-RE100 CSV: BOM, Field/Value header, company, 500 MWh entered, gap 700, projected share 75',async()=>({ok:kc.text.charCodeAt(0)===0xFEFF&&kr[0].join()==='Field,Value'&&kmap['Company']==='RT Co'&&kmap['Renewable MWh entered']==='500'&&kmap['Gap to target (MWh)']==='700'&&kmap['Projected share']==='75',expected:'values',actual:JSON.stringify(kmap).slice(0,160)}));
 await pg.setInputFiles('#importFile',{name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{oops')});await pg.click('#importBtn');await pg.waitForTimeout(400);
 await t.check('R-K4','K-RE100: malformed import leaves current data intact and raises no JS error',async()=>({ok:await val(pg,'total')==='1200'&&pg.errors.length===0,expected:'unchanged',actual:`${await val(pg,'total')} err=${pg.errors.length}`}));
 await t.check('R-K5','K-RE100 CSV shows share 41.666666666666664 unrounded (presentation observation, recorded as PASS only if rounded to <=2 dp)',async()=>({ok:/^\d+(\.\d{1,2})?$/.test(kmap['Estimated renewable share']),expected:'<=2 decimals',actual:kmap['Estimated renewable share']}));
 await pg.context().close();
 // ---- EPR
 pg=await open('GaonGreen_EPR_Cloud_Beta.html');const r=(i,k)=>pg.locator('#rows tr').nth(i).locator('input').nth(k);
 await pg.fill('#company','RT Co');await r(0,0).fill('Box');await r(0,1).fill('50');await r(0,2).fill('1000');await r(0,3).fill('20');
 const ej=await dl(pg,'#json');let ejj={};try{ejj=JSON.parse(ej.text)}catch(e){}
 await t.check('R-E1','EPR JSON export carries company, row weight/quantity/recycled and scenario reduction',async()=>({ok:ejj.company==='RT Co'&&ejj.rows&&ejj.rows[0].weight==='50'&&ejj.rows[0].quantity==='1000'&&ejj.rows[0].recycled==='20'&&ejj.reduction===10,expected:'fields',actual:ej.text.slice(0,90).replace(/\s+/g,' ')}));
 await pg.click('#reset');await pg.waitForTimeout(300);const z=await pg.locator('#totalKg').innerText();
 fs.writeFileSync(tmp+'/epr.json',ej.text);await pg.setInputFiles('#importFile',tmp+'/epr.json');await pg.waitForTimeout(600);
 await t.check('R-E2','EPR JSON clear then import restores the row and total 50 kg',async()=>({ok:z==='0'&&(await pg.locator('#totalKg').innerText())==='50'&&await val(pg,'company')==='RT Co',expected:'0 then 50',actual:`${z} -> ${await pg.locator('#totalKg').innerText()}`}));
 const ec=await dl(pg,'#csv');const er=parseCsv(ec.text);
 await t.check('R-E3','EPR CSV: BOM, Total kg 50, Scenario kg 45, component row with annual mass 50',async()=>({ok:ec.text.charCodeAt(0)===0xFEFF&&er.some(x=>x[0]==='Total kg'&&x[1]==='50')&&er.some(x=>x[0]==='Scenario kg'&&x[1]==='45')&&er.some(x=>x[0]==='Box'&&x[5]==='50'),expected:'rows present',actual:ec.text.slice(0,120)}));
 await pg.setInputFiles('#importFile',{name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"version":1,"rows":"not-an-array"}')});await pg.waitForTimeout(500);
 await t.check('R-E4','EPR: structurally wrong import does not break the page (total stays 50) and raises no JS error',async()=>({ok:(await pg.locator('#totalKg').innerText())==='50'&&pg.errors.length===0,expected:'50, no error',actual:`${await pg.locator('#totalKg').innerText()} err=${pg.errors.join('|').slice(0,80)}`}));
 await pg.context().close();
 // ---- Supplier
 pg=await open('GaonGreen_Supplier_ESG_Scan_Cloud_Beta.html');await pg.fill('#supplier','RT Supplier');await pg.selectOption('#e1','yes');await pg.selectOption('#e2','no');await pg.waitForTimeout(200);
 const sj=await dl(pg,'#json');let sjj={};try{sjj=JSON.parse(sj.text.replace(/^﻿/,''))}catch(e){}
 await t.check('R-S1','Supplier JSON export: typed, supplier name, e1=yes, e2=no',async()=>({ok:sjj.type==='GaonGreenSupplierESGScan'&&sjj.data.profile.supplier==='RT Supplier'&&sjj.data.answers.e1==='yes'&&sjj.data.answers.e2==='no',expected:'fields',actual:sj.text.slice(0,80).replace(/\s+/g,' ')}));
 await pg.click('#new');await pg.waitForTimeout(300);const sc=await pg.locator('#score').innerText();
 fs.writeFileSync(tmp+'/sup.json',sj.text);await pg.setInputFiles('#importFile',tmp+'/sup.json');await pg.click('#importBtn');await pg.waitForTimeout(500);
 await t.check('R-S2','Supplier JSON new then import restores answers: score 50% (1 yes, 1 no => 2/4), coverage 2/15',async()=>({ok:sc==='—'&&(await pg.locator('#score').innerText())==='50%'&&(await pg.locator('#coverage').innerText())==='2/15',expected:'— then 50% 2/15',actual:`${sc} -> ${await pg.locator('#score').innerText()} ${await pg.locator('#coverage').innerText()}`}));
 const scv=await dl(pg,'#csv');const sr=parseCsv(scv.text);
 await t.check('R-S3','Supplier CSV: header rows, e1 "Yes", e2 "No", supplier name',async()=>({ok:sr[0][1]==='RT Supplier'&&sr.some(x=>x[1]==='e1'&&x[3]==='Yes')&&sr.some(x=>x[1]==='e2'&&x[3]==='No'),expected:'rows',actual:scv.text.slice(0,100)}));
 await pg.setInputFiles('#importFile',{name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"type":"Other","data":{}}')});await pg.click('#importBtn');await pg.waitForTimeout(400);
 await t.check('R-S4','Supplier: wrong-type import is refused (score stays 50%)',async()=>t.eq(await pg.locator('#score').innerText(),'50%'));
 await pg.context().close();
 // ---- QR
 pg=await open('GaonGreen_QR_ESG_Card_Cloud_Beta.html');
 for(const [id,v] of Object.entries({company:'RT Co',year:'2026',energy:'40'}))await pg.fill('#'+id,v);
 const qb=await dl(pg,'#backup');await pg.click('#clear');await pg.waitForTimeout(300);const qc=await val(pg,'company');
 fs.writeFileSync(tmp+'/qr.json',qb.text);await pg.setInputFiles('#file',tmp+'/qr.json');await pg.waitForTimeout(300);
 if((await val(pg,'company'))==='')await Promise.all([pg.waitForEvent('filechooser',{timeout:2000}).then(fc=>fc.setFiles(tmp+'/qr.json')).catch(()=>{}),pg.click('#restore')]);await pg.waitForTimeout(500);
 await t.check('R-Q1','QR backup, clear, restore round trip returns company, year and energy',async()=>({ok:qc===''&&await val(pg,'company')==='RT Co'&&await val(pg,'energy')==='40',expected:'RT Co/40',actual:`${qc}|${await val(pg,'company')}|${await val(pg,'energy')}`}));
 await pg.context().close();
 // ---- Evidence Locker exports
 pg=await open('GaonGreen_Evidence_Locker_Cloud_Beta.html');await pg.fill('#company','RT Co');await pg.fill('#docTitle','Doc A');await pg.setInputFiles('#file',{name:'a.txt',mimeType:'text/plain',buffer:Buffer.from('hello')});await pg.click('#addButton');await pg.waitForTimeout(600);
 const vj=await dl(pg,'#exportManifest');let vjj={};try{vjj=JSON.parse(vj.text)}catch(e){}
 await t.check('R-L1','Evidence index JSON: metadata only, one document with title, filename and size 5',async()=>({ok:vjj.documents&&vjj.documents.length===1&&vjj.documents[0].title==='Doc A'&&vjj.documents[0].filename==='a.txt'&&vjj.documents[0].size===5&&/no attachments/i.test(vjj.note),expected:'1 doc',actual:vj.text.slice(0,100).replace(/\s+/g,' ')}));
 const vc=await dl(pg,'#exportCsv');const vr=parseCsv(vc.text);
 await t.check('R-L2','Evidence index CSV: header + 1 row with company, title, filename, size',async()=>({ok:vr.length===2&&vr[0][1]==='title'&&vr[1][0]==='RT Co'&&vr[1][1]==='Doc A'&&vr[1][6]==='a.txt'&&vr[1][7]==='5',expected:'2 rows',actual:vc.text.slice(0,120)}));
 await pg.context().close();
 // ---- CSV formula injection: a user-typed value beginning with = + - @ must not start a cell
 const inj='=HYPERLINK("http://example.invalid","x")';const startsFormula=c=>/^[=+\-@\t\r]/.test(c);
 pg=await open('GaonGreen_K-RE100_Cloud_Beta.html');await pg.fill('#company',inj);const k2=parseCsv((await dl(pg,'#csv')).text).flat();await pg.context().close();
 await t.check('R-X1','CSV injection: K-RE100 CSV does not emit a user-typed "=..." value as a formula-leading cell',async()=>({ok:!k2.some(c=>startsFormula(c)&&c.includes('HYPERLINK')),expected:'neutralised',actual:JSON.stringify(k2.filter(c=>c.includes('HYPERLINK')))}));
 pg=await open('GaonGreen_EPR_Cloud_Beta.html');const r2=(i,k)=>pg.locator('#rows tr').nth(i).locator('input').nth(k);await pg.fill('#company',inj);await r2(0,0).fill(inj);const e2=parseCsv((await dl(pg,'#csv')).text).flat();await pg.context().close();
 await t.check('R-X2','CSV injection: EPR CSV neutralises user-typed "=..." in company and component name',async()=>({ok:!e2.some(c=>startsFormula(c)&&c.includes('HYPERLINK')),expected:'neutralised',actual:JSON.stringify(e2.filter(c=>c.includes('HYPERLINK')))}));
 pg=await open('GaonGreen_Supplier_ESG_Scan_Cloud_Beta.html');await pg.fill('#supplier',inj);const s2=parseCsv((await dl(pg,'#csv')).text).flat();await pg.context().close();
 await t.check('R-X3','CSV injection: Supplier CSV neutralises a user-typed "=..." supplier name',async()=>({ok:!s2.some(c=>startsFormula(c)&&c.includes('HYPERLINK')),expected:'neutralised',actual:JSON.stringify(s2.filter(c=>c.includes('HYPERLINK')))}));
 pg=await open('GaonGreen_Evidence_Locker_Cloud_Beta.html');await pg.fill('#company','C');await pg.fill('#docTitle',inj);await pg.setInputFiles('#file',{name:'a.txt',mimeType:'text/plain',buffer:Buffer.from('x')});await pg.click('#addButton');await pg.waitForTimeout(600);const v2=parseCsv((await dl(pg,'#exportCsv')).text).flat();await pg.context().close();
 await t.check('R-X4','CSV injection: Evidence index CSV neutralises a user-typed "=..." document title',async()=>({ok:!v2.some(c=>startsFormula(c)&&c.includes('HYPERLINK')),expected:'neutralised',actual:JSON.stringify(v2.filter(c=>c.includes('HYPERLINK')))}));
 await s.close();fs.writeFileSync(process.argv[2]||'func-roundtrips.json',JSON.stringify({run:new Date().toISOString(),build:'demo (offline stand-in; export/import logic is browser-local)',results:t.res},null,1));
 process.exit(t.res.some(r=>r.status!=='PASS')?1:0)})();
