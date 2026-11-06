// Offline. The QR decoder helper must fail LOUDLY and distinguishably (exit codes 1/2/3 + stderr marker) instead of producing empty output.
const {spawnSync}=require('child_process'),fs=require('fs'),os=require('os'),path=require('path'),T=require('./lib/t.js');const t=T.make();
const PY=process.env.PYTHON_BIN||'python3',tmp=fs.mkdtempSync(path.join(os.tmpdir(),'qrdiag-'));
// 1x1 white PNG (no QR in it)
const white=path.join(tmp,'white.png');fs.writeFileSync(white,Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64'));
const run=(args)=>spawnSync(PY,['-I',...args],{encoding:'utf8'});
(async()=>{
 await t.check('Q-D1','cv2 not importable -> exit 3 and DECODER-UNAVAILABLE on stderr (simulated with python -S, which drops site-packages)',async()=>{const r=run(['-S','tools/decode_qr.py',white]);return{ok:r.status===3&&/DECODER-UNAVAILABLE/.test(r.stderr)&&r.stdout==='',expected:'exit 3 + marker',actual:`exit ${r.status} ${r.stderr.trim().slice(0,100)}`}});
 await t.check('Q-D2','unreadable/missing image -> exit 2 and DECODER-IMAGE-UNREADABLE',async()=>{const r=run(['tools/decode_qr.py',path.join(tmp,'nope.png')]);return{ok:r.status===2&&/DECODER-IMAGE-UNREADABLE/.test(r.stderr),expected:'exit 2 + marker',actual:`exit ${r.status} ${r.stderr.trim().slice(0,100)}`}});
 await t.check('Q-D3','image with no QR -> exit 1 and DECODER-NO-QR-FOUND (distinct from unavailable)',async()=>{const r=run(['tools/decode_qr.py',white]);return{ok:r.status===1&&/DECODER-NO-QR-FOUND/.test(r.stderr)&&r.stdout==='',expected:'exit 1 + marker',actual:`exit ${r.status} ${r.stderr.trim().slice(0,100)}`}});
 fs.rmSync(tmp,{recursive:true,force:true});fs.writeFileSync(process.argv[2]||'qr-decoder-diagnostics.json',JSON.stringify({run:new Date().toISOString(),build:'OFFLINE decoder-helper diagnostics',results:t.res},null,1));process.exit(t.res.some(r=>r.status!=='PASS')?1:0)})();
