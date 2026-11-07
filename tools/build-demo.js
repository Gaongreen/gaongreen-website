// Generates demo/*.html from the canonical pages. Originals are never modified.
const fs=require('fs'),path=require('path');
const root=process.cwd(),out=path.join(root,'demo');
const core=fs.readFileSync(path.join(root,'tools/supabase-demo-core.js'),'utf8');
const fixtures=`self.GAONGREEN_DEMO_FIXTURES=${JSON.stringify({company_profiles:[{owner_id:'00000000-0000-4000-8000-000000000001',company_name:'Example Exporter Co. (fictional)',country:'KR',industry:'Packaging (fictional)',currency:'KRW',expenses:[]}]})};\n`;
fs.mkdirSync(path.join(out,'vendor'),{recursive:true});
fs.writeFileSync(path.join(out,'vendor/demo-fixtures.js'),fixtures);
for(const asset of ['gg-nav.js','gg-nav.css','gg-l10n.js','gg-account-guard.js'])fs.copyFileSync(path.join(root,asset),path.join(out,asset)); // shared navigation strip
fs.writeFileSync(path.join(out,'vendor/supabase-demo.umd.js'),'(function(){\n'+core+'\nself.supabase={createClient};\n})();\n');
fs.writeFileSync(path.join(out,'vendor/supabase-demo.mjs'),core+'\nexport{createClient};export default{createClient};\n');
const pages=['index.html','GaonGreen_Login.html','GaonGreen_Register.html','GaonGreen_Company_Settings_Cloud_Beta.html','GaonGreen_ESG_Dashboard_Cloud_Beta.html','GaonGreen_KISSB_Cloud_Beta.html','GaonGreen_K-RE100_Cloud_Beta.html','GaonGreen_EPR_Cloud_Beta.html','GaonGreen_Supplier_ESG_Scan_Cloud_Beta.html','GaonGreen_QR_ESG_Card_Cloud_Beta.html','GaonGreen_Evidence_Locker_Cloud_Beta.html','K-ISSB Reporting Wizard _ GaonGreen.html'];
const CSP="default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-src 'self'; form-action 'self'; base-uri 'self'";
const banner=`<div id="gg-demo-banner" style="background:#fff3cd;color:#5c4400;border-bottom:2px solid #e0b400;padding:8px 14px;font:600 13px/1.4 system-ui,sans-serif;text-align:center">DEMO &mdash; fictional data only. Runs offline in this browser; no real Supabase, accounts or customer data. <button type="button" id="gg-demo-reset" style="margin-left:10px;font:inherit;cursor:pointer">Reset demo data</button></div>
<script>document.getElementById('gg-demo-reset').onclick=async function(){if(!confirm('Delete the demo database and demo files stored by this demo in this browser? (Tool-local drafts saved by the tools themselves are not touched.)'))return;var n='gaongreen_demo_v1:';try{Object.keys(localStorage).filter(function(k){return k.indexOf(n)===0}).forEach(function(k){localStorage.removeItem(k)});Object.keys(sessionStorage).filter(function(k){return k.indexOf(n)===0}).forEach(function(k){sessionStorage.removeItem(k)})}catch(e){}try{await new Promise(function(r){var q=indexedDB.deleteDatabase(n+'objects');q.onsuccess=q.onerror=q.onblocked=r})}catch(e){}location.reload()}</script>`;
let bad=0;
for(const f of pages){let h=fs.readFileSync(path.join(root,f),'utf8');const swaps=[];
 const swap=(re,to,label)=>{const n=(h.match(re)||[]).length;if(n){h=h.replace(re,to);swaps.push(label+'x'+n)}};
 swap(/<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@2\/dist\/umd\/supabase\.min\.js"[^>]*><\/script>/g,'<script src="./vendor/supabase-demo.umd.js"></script>','umd-sdk');
 swap(/https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@2\/\+esm/g,'./vendor/supabase-demo.mjs','esm-sdk(jsdelivr)');
 swap(/https:\/\/esm\.sh\/@supabase\/supabase-js@2/g,'./vendor/supabase-demo.mjs','esm-sdk(esm.sh)');
 swap(/<script src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/qrcodejs\/1\.0\.0\/qrcode\.min\.js"[^>]*><\/script>/g,'<script src="./vendor/qrcode-shim.js"></script>','qr-lib');
 h=h.replace(/<head[^>]*>/i,m=>m+`<meta http-equiv="Content-Security-Policy" content="${CSP}"><script src="./vendor/demo-fixtures.js"></script>`);
 h=h.replace(/<body[^>]*>/i,m=>m+banner);
 const ext=[...h.matchAll(/(?:<script[^>]+src=|import[^;\n]*from\s*|import\()\s*["'](https?:[^"']+)["']/gi)].map(m=>m[1]);
 if(ext.length){bad++;console.log('ERR',f,ext.join(' '))}else console.log('ok ',f.padEnd(48),swaps.join(' ')||'(no external code)');
 fs.writeFileSync(path.join(out,f),h)}
process.exit(bad?1:0);
