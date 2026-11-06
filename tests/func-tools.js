// Functional checks: Supplier, QR (decoded from pixels), Evidence Locker (hash round-trip), cloud save/load round-trips, cross-page.
// Runs on the OFFLINE DEMO build: results show page logic against a stand-in backend, NOT real Supabase behaviour.
const S=require('./lib/serve.js'),T=require('./lib/t.js'),fs=require('fs'),crypto=require('crypto'),{execFileSync,spawnSync}=require('child_process');
const tmp=process.env.TMPDIR_T||'/tmp/claude-0';
(async()=>{const s=await S.start('demo'),t=T.make();
 const open=async f=>{const pg=await s.page();pg.on('dialog',d=>d.accept());await pg.goto(s.base+f);await pg.waitForTimeout(600);return pg};
 const g=(pg,id)=>pg.locator('#'+id).innerText();
 // --- Supplier: e1-e5 yes(2 pts each=10), s1-s5 partial (1 each=5), g1,g2 no (0), g3-g5 unknown. known=12; points=15; score=round(100*15/(2*12))=round(62.5)=63; coverage 12/15; flagged(no/partial/unknown)=5+2+3=10.
 let pg=await open('GaonGreen_Supplier_ESG_Scan_Cloud_Beta.html');
 const set=async(ids,v)=>{for(const id of ids)await pg.selectOption('#'+id,v)};
 await set(['e1','e2','e3','e4','e5'],'yes');await set(['s1','s2','s3','s4','s5'],'partial');await set(['g1','g2'],'no');await set(['g3','g4','g5'],'unknown');await pg.waitForTimeout(200);
 await t.check('F-S1','Supplier mixed answers: score 63%, coverage 12/15, 10 flagged',async()=>t.eq([await g(pg,'score'),await g(pg,'coverage'),await g(pg,'priority')].join('|'),'63%|12/15|10'));
 await set(['e1','e2','e3','e4','e5','s1','s2','s3','s4','s5','g1','g2','g3','g4','g5'],'yes');await pg.waitForTimeout(200);
 await t.check('F-S2','Supplier all yes: 100%, 15/15, 0 flagged',async()=>t.eq([await g(pg,'score'),await g(pg,'coverage'),await g(pg,'priority')].join('|'),'100%|15/15|0'));
 await pg.fill('#supplier','Fictional Supplier Ltd');await pg.click('#cloudSave');await pg.waitForTimeout(500);await pg.click('#new');await pg.fill('#supplier','');await pg.waitForTimeout(200);
 await pg.click('#cloudLoad');await pg.waitForTimeout(600);
 await t.check('F-S3','Supplier cloud save then load restores answers (score back to 100%)',async()=>t.eq(await g(pg,'score'),'100%'));
 await pg.context().close();
 // --- QR: payload decoded from the rendered pixels must carry the entered fictional company and website.
 pg=await open('GaonGreen_QR_ESG_Card_Cloud_Beta.html');
 for(const [id,v] of Object.entries({company:'Example Exporter Co.',website:'https://example.com/esg',year:'2026',energy:'40',emissions:'120',recycling:'65',employees:'50',initiatives:'Fictional initiative'}))await pg.fill('#'+id,v);
 await pg.click('#generate');await pg.waitForTimeout(600);
 await pg.locator('#qr').screenshot({path:tmp+'/qr-test.png'});
 // Decoder runs with python3 -I (isolated: ignores user site-packages). PYTHON_BIN may point at a venv python that has opencv. Failures are REPORTED, never swallowed.
 const dec=spawnSync(process.env.PYTHON_BIN||'python3',['-I','tools/decode_qr.py',tmp+'/qr-test.png'],{encoding:'utf8'});const decoded=(dec.stdout||'').trim();
 const decDiag=`decoder exit=${dec.status} spawnError=${dec.error?dec.error.code:'none'} stderr="${(dec.stderr||'').trim().slice(0,160)}"`;
 await t.check('F-Q0','QR decoder (python3 -I + OpenCV) is available and ran',async()=>({ok:!dec.error&&dec.status!==3&&dec.status!==2,expected:'decoder runs (exit 0 or 1)',actual:decDiag}));
 await t.check('F-Q1','QR image decodes to a GaonGreen profile link',async()=>({ok:/#profile=/.test(decoded),expected:'link with #profile=',actual:decoded.slice(0,60)||'NO DECODED OUTPUT: '+decDiag}));
 let payload={},parseErr='';try{const b=decoded.split('#profile=')[1];payload=JSON.parse(Buffer.from(decodeURIComponent(b).replace(/-/g,'+').replace(/_/g,'/'),'base64').toString('utf8'))}catch(e){parseErr=String(e.message).slice(0,80)}
 await t.check('F-Q2','Decoded QR payload carries company, website and numbers entered',async()=>({ok:payload.data&&payload.data.company==='Example Exporter Co.'&&payload.data.website==='https://example.com/esg'&&String(payload.data.energy)==='40',expected:'company/website/energy=40',actual:payload.data?JSON.stringify(payload.data).slice(0,120):`NO PAYLOAD (decoded ${decoded.length} chars; parse: ${parseErr||'n/a'}; ${decDiag})`}));
 await pg.fill('#energy','150');await pg.click('#generate');await pg.waitForTimeout(400);
 await t.check('F-Q3','QR rejects renewable electricity 150% (no card generated)',async()=>({ok:/correct/i.test(await g(pg,'status')),expected:'correction message',actual:await g(pg,'status')}));
 await pg.fill('#energy','40');await pg.fill('#website','javascript:alert(1)');await pg.click('#generate');await pg.waitForTimeout(400);
 await t.check('F-Q4','QR card renders NO clickable link for a javascript: website (unsafe URL dropped at render)',async()=>{const hrefs=await pg.evaluate(()=>[...document.querySelectorAll('#pLinks a')].map(a=>a.getAttribute('href')));return{ok:!hrefs.some(h=>/^javascript:/i.test(h)),expected:'no javascript: href',actual:JSON.stringify(hrefs)}});
 // Hostile shared link: payload with HTML in company and javascript: URLs must not execute or create unsafe links in the public view.
 const evil=Buffer.from(JSON.stringify({v:1,data:{company:'<img src=x onerror="window.__xss=1">Evil Co',sector:'<script>window.__xss=2</script>',country:'KR',website:'javascript:window.__xss=3',evidence:'data:text/html,x',year:'2026',energy:'10',initiatives:'<b onmouseover="window.__xss=4">x</b>'}}),'utf8').toString('base64url');
 const pg2=await s.page();let dlg=0;pg2.on('dialog',d=>{dlg++;d.dismiss()});await pg2.goto(s.base+'GaonGreen_QR_ESG_Card_Cloud_Beta.html#profile='+encodeURIComponent(evil));await pg2.waitForTimeout(900);
 await t.check('F-Q5','Hostile shared profile link: no script execution, no unsafe links, text shown inert',async()=>{const x=await pg2.evaluate(()=>({xss:window.__xss,imgs:document.querySelectorAll('#publicCard img[src="x"],img[src="x"]').length,unsafe:[...document.querySelectorAll('a')].filter(a=>/^(javascript|data):/i.test(a.getAttribute('href')||'')).length,banner:getComputedStyle(document.getElementById('publicBanner')).display,name:document.getElementById('pCompany').textContent}));return{ok:x.banner!=='none'&&/Evil Co/.test(x.name)&&x.xss===undefined&&x.imgs===0&&x.unsafe===0&&dlg===0,expected:'public view loaded (banner shown, name contains Evil Co as inert text), xss undefined, 0 injected imgs, 0 unsafe links',actual:JSON.stringify(x)}});
 await pg2.context().close();
 await pg.context().close();
 // --- Evidence Locker: cloud upload/download hash round-trip and delete (demo storage stand-in).
 const content=Buffer.from('GaonGreen fictional evidence file\n'+'x'.repeat(2000));const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
 pg=await open('GaonGreen_Evidence_Locker_Cloud_Beta.html');
 await pg.fill('#cloudCompany','Example Exporter Co.');await pg.fill('#cloudTitle','Fictional utility bill');await pg.fill('#cloudYear','2026');
 await pg.setInputFiles('#cloudFile',{name:'bill.txt',mimeType:'text/plain',buffer:content});await pg.click('#cloudUpload');await pg.waitForTimeout(900);
 await t.check('F-L1','Evidence cloud upload lists the document',async()=>({ok:/Fictional utility bill/.test(await pg.locator('#cloudRecords').innerText()),expected:'title listed',actual:(await pg.locator('#cloudRecords').innerText()).slice(0,80)}));
 let h='';try{const [dl]=await Promise.all([pg.waitForEvent('download',{timeout:5000}),pg.locator('#cloudRecords button').first().click()]);const p=await dl.path();h=sha(fs.readFileSync(p))}catch(e){h='ERR '+e.message.slice(0,60)}
 await t.check('F-L2','Evidence download bytes equal uploaded bytes (SHA-256)',async()=>t.eq(h,sha(content)));
 await pg.locator('#cloudRecords button').nth(1).click();await pg.waitForTimeout(800);
 await t.check('F-L3','Evidence delete removes the document from the list',async()=>({ok:!/Fictional utility bill/.test(await pg.locator('#cloudRecords').innerText()),expected:'not listed',actual:(await pg.locator('#cloudRecords').innerText()).slice(0,60)}));
 await pg.fill('#company','Example Exporter Co.');await pg.fill('#docTitle','Fictional local doc');await pg.setInputFiles('#file',{name:'local.txt',mimeType:'text/plain',buffer:content});await pg.click('#addButton');await pg.waitForTimeout(800);
 await t.check('F-L4','Evidence local save increments the document total to 1',async()=>t.eq(await g(pg,'total'),'1'));
 await pg.context().close();
 // --- Cloud round trips for K-RE100 and EPR
 pg=await open('GaonGreen_K-RE100_Cloud_Beta.html');await pg.fill('#total','1200');await pg.fill('#m_ppa','300');await pg.click('#cloudSave');await pg.waitForTimeout(500);await pg.click('#clear');await pg.waitForTimeout(200);
 const cleared=await pg.inputValue('#total');await pg.click('#cloudLoad');await pg.waitForTimeout(600);
 await t.check('F-C1','K-RE100 cloud save, clear, cloud load restores total=1200 and PPA=300',async()=>({ok:cleared===''&&await pg.inputValue('#total')==='1200'&&await pg.inputValue('#m_ppa')==='300',expected:'cleared then restored',actual:`cleared=${JSON.stringify(cleared)} total=${await pg.inputValue('#total')}`}));
 await pg.context().close();
 pg=await open('GaonGreen_EPR_Cloud_Beta.html');const r=(i,k)=>pg.locator('#rows tr').nth(i).locator('input').nth(k);
 await r(0,0).fill('Fictional box');await r(0,1).fill('50');await r(0,2).fill('1000');await r(0,3).fill('20');await pg.click('#cloudSave');await pg.waitForTimeout(500);await pg.click('#reset');await pg.waitForTimeout(300);
 const z=await g(pg,'totalKg');await pg.click('#cloudLoad');await pg.waitForTimeout(600);
 await t.check('F-C2','EPR cloud save, clear, cloud load restores total 50 kg',async()=>({ok:z==='0'&&await g(pg,'totalKg')==='50',expected:'0 then 50',actual:`${z} then ${await g(pg,'totalKg')}`}));
 await pg.context().close();
 // --- Cross-page: dashboard reads the fictional company profile
 pg=await open('GaonGreen_ESG_Dashboard_Cloud_Beta.html');
 await t.check('F-X1','Dashboard shows the fictional company profile',async()=>({ok:/Example Exporter Co\. \(fictional\)/.test(await pg.locator('body').innerText()),expected:'company name on page',actual:(await pg.locator('body').innerText()).slice(0,90).replace(/\n/g,' ')}));
 await pg.context().close();
 await s.close();fs.writeFileSync(process.argv[2]||'func-tools.json',JSON.stringify({run:new Date().toISOString(),build:'demo (offline stand-in; page-logic only)',results:t.res},null,1));
 process.exit(t.res.some(r=>r.status!=='PASS')?1:0)})();
