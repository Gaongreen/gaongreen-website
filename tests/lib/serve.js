// Shared helpers for demo tests: static server for demo/ + strict network guard.
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require(process.env.PW_PATH||'/home/claude/.npm-global/lib/node_modules/playwright');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript'};
exports.start=async function(rootDir){const root=path.resolve(rootDir||'demo');
 const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';const f=path.join(root,p);
  if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end('nf')}r.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r)});
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));const port=srv.address().port;const browser=await chromium.launch();
 return{port,browser,base:`http://127.0.0.1:${port}/`,
  async page(){const ctx=await browser.newContext({acceptDownloads:true});const pg=await ctx.newPage();pg.external=[];pg.errors=[];
   await ctx.route('**/*',route=>{const u=route.request().url();if(/^http:\/\/127\.0\.0\.1/.test(u)||/^(data|blob|about):/.test(u))return route.continue();pg.external.push(u.slice(0,100));route.abort()});
   pg.on('pageerror',e=>pg.errors.push(e.message.slice(0,160)));return pg},
  async close(){await browser.close();srv.close()}}};
