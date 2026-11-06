// Builds dist-pinned/ : the canonical pages with (1) the Supabase SDK served from vendor/ with SRI instead of a floating CDN,
// (2) the QR library served locally, (3) a Content-Security-Policy built from the SHA-256 of each inline script (no 'unsafe-inline' for scripts).
// Source pages are never modified. REFUSES to build if vendor/supabase.umd.js is missing or does not match vendor/MANIFEST.json.
// Usage: node tools/build-pinned.js [--vendor vendor] [--out dist-pinned] [--qr vendor/qrcode-shim.js] [--allow-fixture (tests only)] [--target-url https://<20-char-ref>.supabase.co --target-key sb_publishable_...]
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const a=process.argv.slice(2),opt=(n,d)=>{const i=a.indexOf('--'+n);return i>=0?a[i+1]:d};
const root=process.cwd(),vendorDir=path.resolve(opt('vendor','vendor')),out=path.resolve(opt('out','dist-pinned')),qrSrc=path.resolve(opt('qr',path.join(vendorDir,'qrcode-shim.js')));
const die=m=>{console.error('BUILD REFUSED: '+m);process.exit(1)};
const sha=(alg,b,enc)=>crypto.createHash(alg).update(b).digest(enc);
const sdkPath=path.join(vendorDir,'supabase.umd.js'),manPath=path.join(vendorDir,'MANIFEST.json');
if(!fs.existsSync(sdkPath))die('vendor/supabase.umd.js is missing. Run tools/vendor-supabase.sh in an environment with npm access first.');
if(!fs.existsSync(manPath))die('vendor/MANIFEST.json is missing.');
const man=JSON.parse(fs.readFileSync(manPath,'utf8'));const sdk=fs.readFileSync(sdkPath);
if(sha('sha256',sdk,'hex')!==man.sha256)die('SDK file sha256 does not match MANIFEST.json (file changed after vendoring).');
if(sha('sha384',sdk,'base64')!==man.sha384)die('SDK file sha384 does not match MANIFEST.json.');
if(man.fixture&&!a.includes('--allow-fixture'))die('MANIFEST.json marks this vendor dir as a TEST FIXTURE, not a real SDK. Refusing to build a pseudo-release. (--allow-fixture exists only for the pipeline tests.)');
if(!fs.existsSync(qrSrc))die('QR library file missing: '+qrSrc);
const qr=fs.readFileSync(qrSrc);
const pages=['index.html','GaonGreen_Login.html','GaonGreen_Register.html','GaonGreen_Company_Settings_Cloud_Beta.html','GaonGreen_ESG_Dashboard_Cloud_Beta.html','GaonGreen_KISSB_Cloud_Beta.html','GaonGreen_K-RE100_Cloud_Beta.html','GaonGreen_EPR_Cloud_Beta.html','GaonGreen_Supplier_ESG_Scan_Cloud_Beta.html','GaonGreen_QR_ESG_Card_Cloud_Beta.html','GaonGreen_Evidence_Locker_Cloud_Beta.html','K-ISSB Reporting Wizard _ GaonGreen.html'];
// OPTIONAL retargeting for STAGING builds: swap the hard-coded production Supabase host + publishable key for a staging project's. Guards: https *.supabase.co (20-char ref),
// must differ from the production ref and from PRODUCTION_HOSTS, key must be a *publishable* key (secret/service_role keys are refused). Nothing is written to Supabase.
const PROD_HOST='https://uyhmbecltrswiljbyass.supabase.co';const tUrl=opt('target-url',null),tKey=opt('target-key',null);let retarget=null;
if(tUrl||tKey){if(!tUrl||!tKey)die('--target-url and --target-key must be given together.');
 if(!/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(tUrl))die('--target-url must look like https://<20-char-project-ref>.supabase.co');
 const refused=new Set([PROD_HOST,...String(process.env.PRODUCTION_HOSTS||'').split(',').filter(Boolean).map(x=>x.startsWith('http')?x:'https://'+x)]);
 if(refused.has(tUrl))die('--target-url is a PRODUCTION host; retargeting is only for staging projects.');
 if(/^sb_secret_|service_role/i.test(tKey))die('--target-key is a secret/service_role key. Only a publishable key may ever be placed in a page.');
 if(!/^sb_publishable_[A-Za-z0-9_-]{16,}$/.test(tKey))die('--target-key must be a publishable key (sb_publishable_...).');
 retarget={host:tUrl,keyPrefix:tKey.slice(0,22)+'...'}}
const src={};const hosts=new Set();for(const f of pages){src[f]=fs.readFileSync(path.join(root,f),'utf8');
 if(retarget){const before=src[f];src[f]=src[f].split(PROD_HOST).join(tUrl).replace(/sb_publishable_[A-Za-z0-9_-]+/g,tKey);if(src[f]!==before&&src[f].includes(PROD_HOST))die(f+': production host still present after retargeting')}
for(const m of src[f].matchAll(/https:\/\/([a-z0-9]+)\.supabase\.co/g))hosts.add(m[0])}
if(hosts.size!==1)die('expected exactly one Supabase project host in the pages, found '+hosts.size+': '+[...hosts].join(', '));
const projectHost=[...hosts][0];
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(path.join(out,'vendor'),{recursive:true});
fs.writeFileSync(path.join(out,'vendor/supabase.umd.js'),sdk);fs.writeFileSync(path.join(out,'vendor/MANIFEST.json'),JSON.stringify(man,null,1));fs.writeFileSync(path.join(out,'vendor/qrcode.js'),qr);
const NAVASSETS={};for(const asset of ['gg-nav.js','gg-nav.css','gg-l10n.js']){const b=fs.readFileSync(path.join(root,asset));fs.writeFileSync(path.join(out,asset),b);NAVASSETS[asset]='sha256-'+sha('sha256',b,'hex')} // shared navigation strip (same-origin, covered by script-src 'self')
const sriSdk='sha384-'+sha('sha384',sdk,'base64'),sriQr='sha384-'+sha('sha384',qr,'base64');
const report=[];const outputs={};const cspByPage={};
for(const f of pages){let h=src[f];const sw=[];const rep=(re,to,l)=>{const n=(h.match(re)||[]).length;if(n){h=h.replace(re,to);sw.push(l+'x'+n)}};
 const sdkTag=`<script src="./vendor/supabase.umd.js" integrity="${sriSdk}"></script>`;
 let usedSdk=false;
 rep(/<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@2\/dist\/umd\/supabase\.min\.js"[^>]*><\/script>/g,()=>{usedSdk=true;return sdkTag},'umd-cdn->local+SRI');
 const imp=/import\s*\{\s*createClient\s*\}\s*from\s*['"]https:\/\/(?:cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@2\/\+esm|esm\.sh\/@supabase\/supabase-js@2)['"]\s*;?/g;
 if(imp.test(h)){usedSdk=true;h=h.replace(imp,'const { createClient } = window.supabase;');sw.push('esm-import->window.supabase')}
 if(/import\(\s*['"]https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@2\/\+esm['"]\s*\)/.test(h))usedSdk=true;
 rep(/import\(\s*['"]https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@2\/\+esm['"]\s*\)/g,'Promise.resolve(window.supabase)','dynamic-import->window.supabase');
 if(usedSdk&&!h.includes('./vendor/supabase.umd.js'))h=h.replace(/<head[^>]*>/i,m=>m+sdkTag);
 rep(/<script src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/qrcodejs\/1\.0\.0\/qrcode\.min\.js"[^>]*><\/script>/g,`<script src="./vendor/qrcode.js" integrity="${sriQr}" defer></script>`,'qrcode-cdn->local+SRI');
 const ext=[...h.matchAll(/(?:<script[^>]+src=|import[^;\n]*from\s*|import\()\s*["'](https?:[^"']+)["']/gi)].map(m=>m[1]);
 if(ext.length)die(f+': external code still referenced: '+ext.join(' '));
 const inl=[...h.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi)].map(m=>"'sha256-"+sha('sha256',Buffer.from(m[2],'utf8'),'base64')+"'");
 const csp=["default-src 'none'","script-src 'self' "+[...new Set(inl)].join(' '),"style-src 'self' 'unsafe-inline'","img-src 'self' data: blob:","font-src 'self' data:","connect-src 'self' "+projectHost,"form-action 'self'","base-uri 'self'","object-src 'none'","frame-src 'none'"].join('; ');
 h=h.replace(/<head[^>]*>/i,m=>m+`<meta http-equiv="Content-Security-Policy" content="${csp}">`);
 cspByPage[f]=csp;
 fs.writeFileSync(path.join(out,f),h);outputs[f]=sha('sha256',Buffer.from(h),'hex');report.push({page:f,swaps:sw,inlineScripts:inl.length});console.log('ok  '+f.padEnd(48)+(sw.join(' ')||'(no external code)')+`  inline-script hashes=${[...new Set(inl)].length}`)}
// Netlify `_headers`: the same per-page CSP plus frame-ancestors (which a meta tag cannot set) and baseline hardening headers. Syntax follows Netlify's documented format; its behaviour is
// UNVERIFIED until checked on the real staging site with tools/check-headers.js.
const hl=['# Generated by tools/build-pinned.js - do not edit by hand','/*','  X-Content-Type-Options: nosniff','  X-Frame-Options: DENY','  Referrer-Policy: strict-origin-when-cross-origin','  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()','  Cross-Origin-Opener-Policy: same-origin','  Strict-Transport-Security: max-age=31536000',''];
for(const [f,c] of Object.entries(cspByPage)){const pth=f.includes(' ')?'/'+f.split(' ')[0]+'*':'/'+f;hl.push(pth,'  Content-Security-Policy: '+c+"; frame-ancestors 'none'",'')}
fs.writeFileSync(path.join(out,'_headers'),hl.join('\n'));
const rel={built:new Date().toISOString(),target:retarget,assets:NAVASSETS,sdk:{name:man.name,version:man.version,sha256:man.sha256,sri:sriSdk,fixture:!!man.fixture},qr:{file:'vendor/qrcode.js',sri:sriQr,source:'see header of the file'},projectHost,pages:outputs,limits:['meta-tag CSP cannot set frame-ancestors; use a host that sends headers for that','script-src hashes must be regenerated whenever an inline script changes (this build does that)','inline style attributes still require style-src unsafe-inline']};
fs.writeFileSync(path.join(out,'RELEASE_MANIFEST.json'),JSON.stringify(rel,null,1));if(man.fixture)fs.writeFileSync(path.join(out,'FIXTURE_NOT_REAL_SDK.txt'),'This output was built from a TEST FIXTURE standing in for the SDK. Never deploy it.\n');
console.log(`built ${pages.length} pages -> ${path.relative(root,out)}  (sdk ${man.version}${man.fixture?' FIXTURE':''})`);
