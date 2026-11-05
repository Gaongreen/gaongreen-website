// Shared helpers for demo tests: static server for demo/ + strict network guard.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require(process.env.PW_PATH||'/home/claude/.npm-global/lib/node_modules/playwright');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript'};
// Strict allow-list for requests that may reach the network stack: URL-parsed, exact host 127.0.0.1 on THIS server's port, no userinfo; plus data:/blob:/about:.
// (Replaces a ^http://127.0.0.1 prefix regex that also matched 127.0.0.1.evil.example, 127.0.0.1@evil.example and other ports.)
const isAllowedUrl=exports.isAllowedUrl=(raw,port)=>{let u;try{u=new URL(String(raw))}catch{return false}
 if(u.protocol==='data:'||u.protocol==='blob:'||u.protocol==='about:')return true;
 return u.protocol==='http:'&&u.hostname==='127.0.0.1'&&u.port===String(port)&&u.username===''&&u.password==='';};
exports.start=async function(rootDir){const root=path.resolve(rootDir||'demo');
 const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';const f=path.join(root,p);
  if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end('nf')}r.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r)});
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));const port=srv.address().port;const browser=await chromium.launch();
 return{port,browser,base:`http://127.0.0.1:${port}/`,
  async page(){const ctx=await browser.newContext({acceptDownloads:true});const pg=await ctx.newPage();pg.external=[];pg.errors=[];
   await ctx.route('**/*',route=>{const u=route.request().url();if(isAllowedUrl(u,port))return route.continue();pg.external.push(u.slice(0,100));route.abort()});
   pg.on('pageerror',e=>pg.errors.push(e.message.slice(0,160)));return pg},
  async close(){await browser.close();srv.close()}}};
