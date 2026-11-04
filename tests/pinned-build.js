// Tests the PINNED BUILD PIPELINE (tools/vendor-copy.js, tools/build-pinned.js) using a FIXTURE in place of the real SDK.
// WHAT THIS PROVES: hash verification, refusal behaviour, SRI correctness, CSP-with-inline-hashes actually enforced, pages still run under that CSP.
// WHAT IT DOES NOT PROVE: anything about the real @supabase/supabase-js bundle (not obtainable offline) or real Supabase behaviour.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{spawnSync}=require('child_process');
const S=require('./lib/serve.js'),T=require('./lib/t.js');
const root=process.cwd(),tmp=fs.mkdtempSync('/tmp/claude-0/pinned-');const t=T.make();
const run=(cmd,args,cwd)=>spawnSync(cmd,args,{cwd:cwd||root,encoding:'utf8'});
const sha=(alg,b,enc)=>crypto.createHash(alg).update(b).digest(enc);
(async()=>{
 // fixture vendor dir
 const vd=path.join(tmp,'vendor');fs.mkdirSync(vd);const sdk=fs.readFileSync('demo/vendor/supabase-demo.umd.js');fs.writeFileSync(path.join(vd,'supabase.umd.js'),sdk);fs.copyFileSync('demo/vendor/qrcode-shim.js',path.join(vd,'qrcode-shim.js'));
 const man={name:'@supabase/supabase-js',version:'0.0.0-FIXTURE',fixture:true,file:'vendor/supabase.umd.js',sha256:sha('sha256',sdk,'hex'),sha384:sha('sha384',sdk,'base64')};fs.writeFileSync(path.join(vd,'MANIFEST.json'),JSON.stringify(man));
 const out=path.join(tmp,'out');
 const b=run('node',['tools/build-pinned.js','--vendor',vd,'--out',out]);
 await t.check('P1','Build succeeds for all 12 pages from a manifest-verified fixture',async()=>({ok:b.status===0&&/built 12 pages/.test(b.stdout),expected:'exit 0, 12 pages',actual:`exit ${b.status} ${(b.stdout+b.stderr).slice(-160)}`}));
 const pages=fs.readdirSync(out).filter(f=>f.endsWith('.html'));const html=f=>fs.readFileSync(path.join(out,f),'utf8');
 await t.check('P2','No page references external script/import code, no CDN host, no floating @2 SDK',async()=>{const bad=pages.filter(f=>/(?:<script[^>]+src=|import[^;\n]*from\s*|import\()\s*["']https?:/i.test(html(f))||/cdn\.jsdelivr|esm\.sh|cdnjs\.cloudflare|supabase-js@2/.test(html(f)));return{ok:bad.length===0&&pages.length===12,expected:'0 offending pages of 12',actual:JSON.stringify(bad)}});
 const sri='sha384-'+sha('sha384',sdk,'base64');
 await t.check('P3','Every page that uses the SDK loads it with an SRI attribute equal to the sha384 of the vendored file',async()=>{const users=pages.filter(f=>html(f).includes('supabase.umd.js'));const bad=users.filter(f=>!html(f).includes(`src="./vendor/supabase.umd.js" integrity="${sri}"`));return{ok:users.length===10&&bad.length===0,expected:'10 SDK pages, all with matching SRI',actual:`users=${users.length} bad=${JSON.stringify(bad)}`}});
 await t.check('P4','CSP: script-src has no unsafe-inline/unsafe-eval, only self + sha256 hashes; connect-src is self + the one Supabase host',async()=>{const bad=[];for(const f of pages){const m=html(f).match(/http-equiv="Content-Security-Policy" content="([^"]+)"/);if(!m){bad.push(f+':nocsp');continue}const c=m[1],ss=(c.match(/script-src ([^;]+)/)||[])[1]||'',cs=(c.match(/connect-src ([^;]+)/)||[])[1]||'';if(/unsafe-/.test(ss)||ss.split(' ').some(x=>x!=="'self'"&&!/^'sha256-[A-Za-z0-9+/=]+'$/.test(x)))bad.push(f+':script-src');if(!/^'self' https:\/\/[a-z0-9]+\.supabase\.co$/.test(cs))bad.push(f+':connect-src')}return{ok:bad.length===0,expected:'all pages compliant',actual:JSON.stringify(bad)}});
 // enforcement in a real browser: pages must run with this CSP and zero violations
 const srv=await S.start(out);let viol=0,jsErr=[],ext=[];const rows=[];
 for(const f of pages){const pg=await srv.page();pg.on('dialog',d=>d.dismiss());await pg.addInitScript(()=>{window.__v=[];document.addEventListener('securitypolicyviolation',e=>window.__v.push(e.violatedDirective+' '+String(e.blockedURI).slice(0,60)))});await pg.goto(srv.base+encodeURIComponent(f));await pg.waitForTimeout(900);const v=await pg.evaluate(()=>window.__v);viol+=v.length;if(pg.errors.length)jsErr.push(f+': '+pg.errors[0]);if(pg.external.length)ext.push(f);rows.push({f,v});await pg.context().close()}
 await t.check('P5','All 12 pages load under their own hash-based CSP: 0 CSP violations, 0 JS errors, 0 external requests',async()=>({ok:viol===0&&!jsErr.length&&!ext.length,expected:'0/0/0',actual:JSON.stringify({viol,jsErr,ext,sample:rows.filter(r=>r.v.length).slice(0,2)})}));
 const missingLib=[];for(const f of pages.filter(f=>html(f).includes('window.supabase'))){const q=await srv.page();await q.goto(srv.base+encodeURIComponent(f));await q.waitForTimeout(500);const ok=await q.evaluate(()=>!!(window.supabase&&typeof window.supabase.createClient==='function'));if(!ok)missingLib.push(f);await q.context().close()}
 const usesWin=pages.filter(f=>html(f).includes('window.supabase')).length;
 await t.check('P5b','Every page whose code uses window.supabase (including the dynamic-import page) has the library loaded: createClient is a function',async()=>({ok:usesWin>=5&&missingLib.length===0,expected:'0 pages missing the library',actual:`pagesUsingWindowSupabase=${usesWin} missing=${JSON.stringify(missingLib)}`}));
 let pg=await srv.page();await pg.goto(srv.base+'GaonGreen_K-RE100_Cloud_Beta.html');await pg.waitForTimeout(500);await pg.fill('#total','1200');await pg.fill('#target','100');await pg.fill('#m_ppa','300');await pg.fill('#m_rec','200');await pg.waitForTimeout(200);
 const kre=await pg.locator('#sum').innerText();await pg.context().close();
 pg=await srv.page();await pg.goto(srv.base+'GaonGreen_EPR_Cloud_Beta.html');await pg.waitForTimeout(500);const r=(k)=>pg.locator('#rows tr').first().locator('input').nth(k);await r(1).fill('50');await r(2).fill('1000');await r(3).fill('20');await pg.waitForTimeout(200);const epr=await pg.locator('#totalKg').innerText();await pg.context().close();
 await t.check('P6','Scripts really execute under the CSP: K-RE100 sum 500 and EPR total 50 kg computed',async()=>({ok:kre==='500'&&epr==='50',expected:'500/50',actual:`${kre}/${epr}`}));
 pg=await srv.page();await pg.goto(srv.base+'GaonGreen_Login.html');await pg.waitForTimeout(400);
 const inj=await pg.evaluate(async()=>{window.__v=[];window.__ran=0;document.addEventListener('securitypolicyviolation',e=>window.__v.push(e.violatedDirective));const s=document.createElement('script');s.textContent='window.__ran=1';document.head.appendChild(s);const d=document.createElement('div');d.innerHTML='<img src=x onerror="window.__ran=2">';document.body.appendChild(d);await new Promise(r=>setTimeout(r,400));return{ran:window.__ran,v:window.__v}});
 await t.check('P7','CSP is actually enforced: an injected inline <script> and an inline onerror handler do NOT run and are reported',async()=>({ok:inj.ran===0&&inj.v.length>=1,expected:'ran=0, >=1 violation',actual:JSON.stringify(inj)}));
 await pg.context().close();
 // fetch to a non-allowed host must be blocked by connect-src (browser-level, before any network)
 pg=await srv.page();await pg.goto(srv.base+'GaonGreen_Login.html');await pg.waitForTimeout(300);
 const cx=await pg.evaluate(async()=>{try{await fetch('https://attacker.example.invalid/x');return'allowed'}catch(e){return'blocked'}});
 await t.check('P8','connect-src blocks a fetch to a non-Supabase host',async()=>t.eq(cx,'blocked'));await pg.context().close();await srv.close();
 // tamper / missing
 fs.appendFileSync(path.join(vd,'supabase.umd.js'),'\n/*x*/');const bt=run('node',['tools/build-pinned.js','--vendor',vd,'--out',path.join(tmp,'out2')]);
 await t.check('P9','Tampered vendor file (1 appended byte) makes the build REFUSE (non-zero exit, no output dir)',async()=>({ok:bt.status!==0&&/does not match MANIFEST/.test(bt.stderr)&&!fs.existsSync(path.join(tmp,'out2')),expected:'refused',actual:`exit ${bt.status} ${bt.stderr.slice(0,100)}`}));
 fs.rmSync(path.join(vd,'supabase.umd.js'));const bm=run('node',['tools/build-pinned.js','--vendor',vd,'--out',path.join(tmp,'out3')]);
 await t.check('P10','Missing vendor SDK file makes the build REFUSE with instructions',async()=>({ok:bm.status!==0&&/vendor-supabase\.sh/.test(bm.stderr),expected:'refused',actual:`exit ${bm.status} ${bm.stderr.slice(0,100)}`}));
 // vendor-copy against a fake node_modules tree
 const ft=path.join(tmp,'fake');fs.mkdirSync(path.join(ft,'node_modules/@supabase/supabase-js/dist/umd'),{recursive:true});
 const mk=(pin,inst,lockInt)=>{fs.writeFileSync(path.join(ft,'package.json'),JSON.stringify({dependencies:{'@supabase/supabase-js':pin}}));fs.writeFileSync(path.join(ft,'node_modules/@supabase/supabase-js/package.json'),JSON.stringify({version:inst}));fs.writeFileSync(path.join(ft,'node_modules/@supabase/supabase-js/dist/umd/supabase.js'),'/*fake sdk*/');fs.writeFileSync(path.join(ft,'package-lock.json'),JSON.stringify({packages:{'node_modules/@supabase/supabase-js':{version:inst,integrity:lockInt}}}))};
 mk('^2.118.0','2.118.0','sha512-AAAA');const v1=run('node',['tools/vendor-copy.js',ft]);mk('2.118.0','2.119.0','sha512-AAAA');const v2=run('node',['tools/vendor-copy.js',ft]);mk('2.118.0','2.118.0','sha1-weak');const v3=run('node',['tools/vendor-copy.js',ft]);mk('2.118.0','2.118.0','sha512-AAAA');const v4=run('node',['tools/vendor-copy.js',ft]);
 const vm=(()=>{try{return JSON.parse(fs.readFileSync(path.join(ft,'vendor/MANIFEST.json'),'utf8'))}catch(e){return{}}})();
 await t.check('P11','vendor-copy refuses a range pin (^2.118.0), an installed/pinned version mismatch, and a non-sha512 lockfile entry',async()=>({ok:v1.status!==0&&v2.status!==0&&v3.status!==0&&/exact/.test(v1.stderr)&&/!=/.test(v2.stderr)&&/sha512/.test(v3.stderr),expected:'3 refusals',actual:[v1.status,v2.status,v3.status].join()}));
 await t.check('P12','vendor-copy succeeds on a consistent tree and records version, sha256, sha384 and the lockfile tarball integrity',async()=>({ok:v4.status===0&&vm.version==='2.118.0'&&vm.sha256===sha('sha256',Buffer.from('/*fake sdk*/'),'hex')&&vm.tarballIntegrity==='sha512-AAAA',expected:'manifest fields',actual:JSON.stringify(vm).slice(0,140)}));
 // the real build must refuse right now because the real SDK is not vendored yet (honesty check)
 const real=run('node',['tools/build-pinned.js']);
 await t.check('P13','Honesty check: with no real vendor/ in the repo, the default build REFUSES (no pseudo-release can be produced by accident)',async()=>({ok:real.status!==0&&!fs.existsSync('dist-pinned'),expected:'refused, no dist-pinned',actual:`exit ${real.status}; dist-pinned exists=${fs.existsSync('dist-pinned')}`}));
 fs.rmSync(tmp,{recursive:true,force:true});
 fs.writeFileSync(process.argv[2]||'pinned-build.json',JSON.stringify({run:new Date().toISOString(),build:'pipeline test with FIXTURE SDK (not the real SDK)',results:t.res},null,1));
 process.exit(t.res.some(r=>r.status!=='PASS')?1:0)})();
