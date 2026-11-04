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
(async()=>{await new Promise(r=>srv.listen(0,'127.0.0.1',r));const port=srv.address().port;
 const browser=await chromium.launch();const pages=fs.readdirSync(root).filter(f=>f.endsWith('.html')).sort();const res=[];
 for(const f of pages){const ctx=await browser.newContext();const pg=await ctx.newPage();const rec={page:f,pageErrors:[],consoleErrors:[],blockedExternal:[],stubbed:[],title:'',finalUrl:'',buttons:0,inputs:0};
  await ctx.route(u=>!/^http:\/\/127\.0\.0\.1/.test(u.toString())&&!/^(data|blob|about):/.test(u.toString()),route=>{const u=route.request().url();
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
 await browser.close();srv.close();fs.writeFileSync(out,JSON.stringify({run:new Date().toISOString(),commit:process.env.GIT_SHA||'',note:'stubbed Supabase/QR; external traffic blocked; page-level only',results:res},null,1));
 for(const r of res)console.log((r.loadError||r.pageErrors.length?'FAIL ':'ok   ')+r.page.padEnd(52)+` btn=${r.buttons} inp=${r.inputs} chars=${r.bodyChars??'-'} err=${r.pageErrors.length}/${r.consoleErrors.length} ext-blocked=${r.blockedExternal.length}`+(r.finalUrl&&r.finalUrl!==r.page?' -> '+r.finalUrl:''));})();
