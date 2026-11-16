// Regression: the network guard in tests/lib/serve.js must treat only http://127.0.0.1:<own port> (+ data:/blob:/about:) as local.
// Offline. Checks the predicate directly AND in a real Chromium context that every deceptive URL is intercepted (aborted + recorded), never passed through.
const fs=require('fs'),S=require('./lib/serve.js'),T=require('./lib/t.js');const t=T.make();
(async()=>{const s=await S.start('demo');const P=s.port,A=S.isAllowedUrl;
 const allow=[`http://127.0.0.1:${P}/`,`http://127.0.0.1:${P}/index.html?x=1#h`,`http://127.0.0.1:${P}`,'data:text/plain,hi','blob:null/abc','about:blank'];
 const deny={ // category: urls
  'hostname suffix':['http://127.0.0.1.evil.example/',`http://127.0.0.1.evil.example:${P}/`,'http://127.0.0.1evil.example/',`http://sub.127.0.0.1.evil.example:${P}/`,`http://127.0.0.1.nip.io:${P}/`],
  'embedded credentials':['http://127.0.0.1@evil.example/',`http://127.0.0.1:${P}@evil.example/`,`http://user:pw@127.0.0.1:${P}/`,`http://127.0.0.1:${P}:x@evil.example/`],
  'wrong port':['http://127.0.0.1/','http://127.0.0.1:1/',`http://127.0.0.1:${P+1}/`,`http://127.0.0.1:${P-1}/`,`http://127.0.0.1:0${P}x/`],
  'other host or scheme':['http://127.0.0.2/','http://localhost/',`http://localhost:${P}/`,`http://[::1]:${P}/`,`http://0x7f.0.0.1:${P}/x`.replace('0x7f','evil'),`https://127.0.0.1:${P}/`,`ws://127.0.0.1:${P}/`,`ftp://127.0.0.1/`,`http://evil.example/?u=http://127.0.0.1:${P}/`,`http://evil.example/http://127.0.0.1:${P}/`,'//127.0.0.1/','not a url','']};
 for(const u of allow)await t.check('U-ALLOW '+u.slice(0,40),'legitimate URL is allowed: '+u.slice(0,60),async()=>({ok:A(u,P)===true,expected:'allowed',actual:String(A(u,P))}));
 for(const [cat,list] of Object.entries(deny))await t.check('U-DENY '+cat,`all ${list.length} "${cat}" URLs are rejected as non-local`,async()=>{const bad=list.filter(u=>A(u,P)!==false);return{ok:!bad.length,expected:'none allowed',actual:JSON.stringify(bad)}});
 // Real browser: requests to deceptive hosts must reach the abort handler (recorded in pg.external) and must NOT succeed.
 await t.check('U-BROWSER','in Chromium, deceptive hostname-suffix and wrong-port requests are intercepted and aborted',async()=>{const pg=await s.page();await pg.goto('about:blank'); // about:blank has no CSP, so requests reach the route guard (demo pages' own CSP would block them first and hide the guard)
  const probes=['http://127.0.0.1.evil.example/p1',`http://127.0.0.1.evil.example:${P}/p2`,'http://127.0.0.1:1/p3',`http://127.0.0.1:${P+1}/p4`];
  const out=await pg.evaluate(async ps=>{const r=[];for(const u of ps){try{await fetch(u,{mode:'no-cors'});r.push('reached')}catch{r.push('blocked')}}return r},probes);
  const seen=probes.every(u=>pg.external.includes(u.slice(0,100)));return{ok:seen&&out.every(x=>x==='blocked'),expected:'4 intercepted, 4 blocked',actual:JSON.stringify({out,seen,external:pg.external})}});
 await t.check('U-OWN','the guard still lets the page load and use its own server (existing functionality preserved)',async()=>{const pg=await s.page();await pg.goto(s.base+'index.html');const n=await pg.locator('body').innerText();return{ok:n.length>100&&pg.external.length===0,expected:'page loads, 0 external',actual:`chars=${n.length} external=${pg.external.length}`}});
 await s.close();fs.writeFileSync(process.argv[2]||'url-guard.json',JSON.stringify({run:new Date().toISOString(),build:'OFFLINE; guard predicate + Chromium interception',results:t.res},null,1));process.exit(t.res.some(r=>r.status!=='PASS')?1:0)})();
