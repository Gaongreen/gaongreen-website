// Smoke test: load every HTML page in Chromium with ALL non-localhost traffic blocked.
// Supabase SDK and qrcodejs are replaced by in-memory stubs, so results describe page logic only,
// NOT real Supabase behaviour. Fictional/no data. Read-only: serves files from the repo root.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require(process.env.PW_PATH||'/home/claude/.npm-global/lib/node_modules/playwright');
const root=process.cwd(); const out=process.argv[2]||'smoke-result.json';
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';
 const f=path.join(root,p);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end('nf')}
 r.writeHead(200,{'content-type':f.endsWith('.html')?'text/html; charset=utf-8':'application/octet-stream'});fs.createReadStream(f).pipe(r)});
const chain=`const q=()=>{const o={data:[],error:null,then:(a)=>a({data:[],error:null})};return new Proxy(o,{get:(t,k)=>k in t?t[k]:(...a)=>q()})};
const c={auth:{getSession:async()=>({data:{session:null},error:null}),getUser:async()=>({data:{user:null},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signInWithPassword:async()=>({data:{},error:{message:'stub'}}),signUp:async()=>({data:{},error:{message:'stub'}}),signOut:async()=>({error:null})},from:()=>q(),storage:{from:()=>q()},rpc:async()=>({data:null,error:null})};`;
const umd=`window.__STUB_SUPABASE=true;${chain}window.supabase={createClient:()=>c};`;
const esm=`${chain}export const createClient=()=>c;export default {createClient};`;
const qr=`window.QRCode=function(el,o){el.innerHTML='<canvas data-stub-qr></canvas>';};window.QRCode.CorrectLevel={L:1,M:0,Q:3,H:2};`;
// Strict allow-list for requests that may reach the network stack unmodified: URL-parsed, exact host 127.0.0.1 on the test server's own port
// (no userinfo), plus data:/blob:/about:. Everything else is intercepted: SDK/QR stubbed, the rest aborted.
const isAllowedUrl=(raw,port)=>{let u;try{u=new URL(String(raw))}catch{return false}
 if(u.protocol==='data:'||u.protocol==='blob:'||u.protocol==='about:')return true;
 return u.protocol==='http:'&&u.hostname==='127.0.0.1'&&u.port===String(port)&&u.username===''&&u.password==='';};
(async()=>{await new Promise(r=>srv.listen(0,'127.0.0.1',r));const port=srv.address().port;
 // Regression: deceptive URLs must NOT count as local (the old prefix check let the 127.0.0.1.evil.example, 127.0.0.1@evil.example and 127.0.0.1:1-style URLs through) and must be intercepted in a real browser context.
 const regression=[];const reg=(n,ok,d)=>{regression.push({name:n,status:ok?'PASS':'FAIL',detail:d});console.log((ok?'PASS ':'FAIL ')+'REGRESSION '+n+(ok?'':' '+d))};
 const cases=[[`http://127.0.0.1:${port}/x.html`,true],[`http://127.0.0.1:${port}`,true],['data:text/plain,hi',true],['blob:null/abc',true],['about:blank',true],
  ['http://127.0.0.1.evil.example/',false],['http://127.0.0.1.evil.example:'+port+'/',false],['http://127.0.0.1@evil.example/',false],[`http://127.0.0.1:${port}@evil.example/`,false],['http://evil.example/http://127.0.0.1/',false],
  ['http://127.0.0.1:1/',false],[`http://127.0.0.1:${port+1}/`,false],['http://127.0.0.2/',false],['http://localhost/',false],[`https://127.0.0.1:${port}/`,false],['ftp://127.0.0.1/',false],['http://127.0.0.1.:'+port+'/',true],['not a url',false],['',false]];
 for(const [u,exp] of cases)reg('isAllowedUrl('+JSON.stringify(u)+') === '+exp,isAllowedUrl(u,port)===exp,'got '+isAllowedUrl(u,port));
 {const ctx=await (await chromium.launch()).newContext();const hit=[];const pg=await ctx.newPage();
  await ctx.route(u=>!isAllowedUrl(u,port),route=>{hit.push(route.request().url());route.abort()});await pg.goto('about:blank');
  const bad=['http://127.0.0.1.evil.example/a','http://127.0.0.1:1/c']; // credentialed URLs (127.0.0.1@evil) are blocked by Chromium itself for subresources, so they are covered by the unit cases above
  for(const u of bad)await pg.evaluate(u=>new Promise(r=>{const i=new Image();i.onload=i.onerror=r;i.src=u;setTimeout(r,1500)}),u); // Image, not fetch(): fetch() rejects credentialed URLs before they reach the network layer
  reg('browser: deceptive URLs reach the abort handler (not passed through as local)',bad.every(u=>hit.includes(u)),JSON.stringify(hit));
  await ctx.browser().close()}
 if(regression.some(r=>r.status!=='PASS'))process.exitCode=1;
 const browser=await chromium.launch();const pages=fs.readdirSync(root).filter(f=>f.endsWith('.html')).sort();const res=[];
 for(const f of pages){const ctx=await browser.newContext();const pg=await ctx.newPage();const rec={page:f,pageErrors:[],consoleErrors:[],blockedExternal:[],stubbed:[],title:'',finalUrl:'',buttons:0,inputs:0};
  await ctx.route(u=>!isAllowedUrl(u,port),route=>{const u=route.request().url();
   if(/@supabase\/supabase-js[^ ]*\/\+esm/.test(u)){rec.stubbed.push('supabase(esm)');return route.fulfill({contentType:'application/javascript',body:esm})}
   if(/esm\.sh\/@supabase/.test(u)){rec.stubbed.push('supabase(esm.sh)');return route.fulfill({contentType:'application/javascript',body:esm})}
   if(/supabase\.min\.js/.test(u)){rec.stubbed.push('supabase(umd)');return route.fulfill({contentType:'application/javascript',body:umd})}
   if(/qrcode/.test(u)){rec.stubbed.push('qrcodejs');return route.fulfill({contentType:'application/javascript',body:qr})}
   rec.blockedExternal.push(u.slice(0,100));route.abort()});
  pg.on('pageerror',e=>rec.pageErrors.push(String(e.message).slice(0,160)));pg.on('console',m=>{if(m.type()==='error')rec.consoleErrors.push(m.text().slice(0,160))});
  try{await pg.goto(`http://127.0.0.1:${port}/${encodeURIComponent(f)}`,{waitUntil:'load',timeout:15000});await pg.waitForTimeout(1500);
   rec.title=await pg.title();rec.finalUrl=decodeURIComponent(pg.url().replace(`http://127.0.0.1:${port}/`,''));rec.buttons=await pg.locator('button').count();rec.inputs=await pg.locator('input,select,textarea').count();
   rec.bodyChars=(await pg.locator('body').innerText()).length;}catch(e){rec.loadError=String(e.message).slice(0,120)}
  rec.stubbed=[...new Set(rec.stubbed)];res.push(rec);await ctx.close()}
 await browser.close();srv.close();fs.writeFileSync(out,JSON.stringify({run:new Date().toISOString(),commit:process.env.GIT_SHA||'',note:'stubbed Supabase/QR; external traffic blocked; page-level only',results:res,regression},null,1));
 for(const r of res)console.log((r.loadError||r.pageErrors.length?'FAIL ':'ok   ')+r.page.padEnd(52)+` btn=${r.buttons} inp=${r.inputs} chars=${r.bodyChars??'-'} err=${r.pageErrors.length}/${r.consoleErrors.length} ext-blocked=${r.blockedExternal.length}`+(r.finalUrl&&r.finalUrl!==r.page?' -> '+r.finalUrl:''));})();
