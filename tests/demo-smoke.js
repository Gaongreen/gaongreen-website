// Strict offline check of demo/: ANY non-localhost request fails the run. Also: CSP violations, JS errors, banner, link resolution, storage scan.
const S=require('./lib/serve.js'),fs=require('fs'),path=require('path');
(async()=>{const s=await S.start('demo');const root=path.resolve('demo');let fail=0;const res=[];
 const pages=fs.readdirSync(root).filter(x=>x.endsWith('.html')).sort();
 for(const f of pages){const pg=await s.page();pg.on('dialog',d=>d.dismiss());
  await pg.addInitScript(()=>{window.__csp=[];document.addEventListener('securitypolicyviolation',e=>window.__csp.push(e.violatedDirective+' '+String(e.blockedURI).slice(0,80)))});
  await pg.goto(s.base+encodeURIComponent(f));await pg.waitForTimeout(1000);
  const info=await pg.evaluate(()=>({csp:window.__csp,banner:document.querySelectorAll('#gg-demo-banner').length,links:[...document.querySelectorAll('a[href]')].map(a=>a.getAttribute('href')).filter(h=>h&&!/^(#|mailto:|javascript:|https?:)/.test(h))}));
  const broken=info.links.map(h=>decodeURIComponent(h.split('#')[0].split('?')[0].replace(/^\.\//,''))).filter(h=>h&&!fs.existsSync(path.join(root,h)));
  const ok=!pg.external.length&&!pg.errors.length&&!info.csp.length&&info.banner===1&&!broken.length;if(!ok)fail++;
  res.push({page:f,external:pg.external,jsErrors:pg.errors,cspViolations:info.csp,banner:info.banner,brokenLinks:broken,status:ok?'PASS':'FAIL'});
  console.log((ok?'PASS ':'FAIL ')+f.padEnd(48)+`ext=${pg.external.length} jsErr=${pg.errors.length} csp=${info.csp.length} brokenLinks=${broken.length}`);await pg.context().close()}
 // storage scan: after a demo sign-in, no token-looking string may sit in localStorage/sessionStorage/IndexedDB names
 const pg=await s.page();await pg.goto(s.base+'GaonGreen_Login.html');await pg.waitForTimeout(500);
 const st=await pg.evaluate(async()=>{const c=await window.supabase.createClient('u','k').auth.signInWithPassword({email:'demo.user@example.invalid',password:'fictional-demo-pass'});
  const all={...localStorage,...sessionStorage};return{signedIn:!!(c.data&&c.data.session),leaks:Object.entries(all).filter(([k,v])=>!(k==='sb-demo-auth-token'&&v==='{"demo":true}')&&/token|jwt|password|fictional-demo-pass|eyJ/i.test(k+' '+v)).map(([k])=>k)}});
 const okS=st.signedIn&&!st.leaks.length;if(!okS)fail++;res.push({page:'(storage scan)',status:okS?'PASS':'FAIL',detail:st});console.log((okS?'PASS ':'FAIL ')+'storage scan after demo sign-in: no token/password-like entries in localStorage/sessionStorage  '+JSON.stringify(st));
 await s.close();fs.writeFileSync(process.argv[2]||'demo-smoke.json',JSON.stringify({run:new Date().toISOString(),results:res},null,1));process.exit(fail?1:0)})();
