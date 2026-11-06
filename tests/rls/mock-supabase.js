// A tiny MOCK of the Supabase REST surface, used ONLY to test the RLS suite's own logic (does it detect leaks?).
// It is not Supabase and says nothing about any real project. Modes: isolated | allowlist (isolated + MIME allow-list + 10 MB limit) | leaky-select | leaky-write | leaky-insert | leaky-storage | weak-jwt
const http=require('http'),crypto=require('crypto');
const ALLOW=['application/pdf','image/png','image/jpeg','image/webp','text/csv','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain'];
exports.start=(mode)=>new Promise(res=>{
 const SECRET='mock-secret',users={'a@example.com':{pw:'pa',id:'11111111-1111-4111-8111-111111111111'},'b@example.com':{pw:'pb',id:'22222222-2222-4222-8222-222222222222'}};
 const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url'),sign=s=>crypto.createHmac('sha256',SECRET).update(s).digest('base64url');
 const tables={},objects={};const OWN=['owner_id','user_id'];
 const who=req=>{const a=(req.headers.authorization||'').replace(/^Bearer /,'');const p=a.split('.');if(p.length!==3)return{anon:true};if(mode!=='weak-jwt'&&sign(p[0]+'.'+p[1])!==p[2])return{bad:true};try{return{uid:JSON.parse(Buffer.from(p[1],'base64url').toString()).sub}}catch{return{bad:true}}};
 const send=(r,code,body,raw)=>{r.writeHead(code,{'content-type':raw?'text/plain':'application/json'});r.end(raw?body:JSON.stringify(body))};
 const srv=http.createServer((q,r)=>{let body='';q.on('data',d=>body+=d);q.on('end',()=>{
  const u=new URL(q.url,'http://x');const w=who(q);
  if(u.pathname==='/auth/v1/token'){const j=JSON.parse(body||'{}'),us=users[j.email];if(!us||us.pw!==j.password)return send(r,400,{error:'invalid'});const h=b64({alg:'HS256'}),p=b64({sub:us.id,role:'authenticated'});return send(r,200,{access_token:h+'.'+p+'.'+sign(h+'.'+p),user:{id:us.id}})}
  if(w.bad)return send(r,401,{code:'PGRST301',message:'JWT invalid'});
  if(u.pathname.startsWith('/rest/v1/')){const t=u.pathname.slice(9);const T=tables[t]=tables[t]||[];const filt={};for(const [k,v] of u.searchParams)if(/^eq\./.test(v))filt[k]=v.slice(3);
   const own=r=>OWN.map(c=>r[c]).find(x=>x!==undefined);const match=r=>Object.entries(filt).every(([k,v])=>String(r[k])===v);
   const vis=r=>mode==='leaky-select'||(w.uid&&own(r)===w.uid);const writable=r=>mode==='leaky-write'||(w.uid&&own(r)===w.uid);
   if(q.method==='GET'){if(w.anon&&mode!=='leaky-select')return send(r,200,[]);return send(r,200,T.filter(x=>vis(x)&&match(x)))}
   if(q.method==='POST'){const j=JSON.parse(body);if(w.anon)return send(r,401,{code:'42501',message:'new row violates row-level security policy'});if(mode!=='leaky-insert'&&own(j)!==w.uid)return send(r,403,{code:'42501',message:'new row violates row-level security policy'});
    const oc=OWN.find(c=>j[c]!==undefined);const key=u.searchParams.get('on_conflict');const i=key?T.findIndex(x=>x[key]===j[key]):-1;if(i>=0){if(mode!=='leaky-write'&&own(T[i])!==w.uid)return send(r,403,{code:'42501',message:'row-level security'});T[i]={...T[i],...j};return send(r,201,[T[i]])}T.push(j);return send(r,201,[j])}
   if(q.method==='PATCH'){const hit=T.filter(x=>writable(x)&&match(x));const j=JSON.parse(body);hit.forEach(x=>Object.assign(x,j));return send(r,200,hit)}
   if(q.method==='DELETE'){const hit=T.filter(x=>writable(x)&&match(x));hit.forEach(x=>T.splice(T.indexOf(x),1));return send(r,200,hit)}}
  if(u.pathname.startsWith('/storage/v1/object/list/')){const pre=JSON.parse(body).prefix||'';const items=Object.keys(objects).filter(k=>k.startsWith(u.pathname.slice(24)+'/'+pre)).filter(k=>mode==='leaky-storage'||k.split('/')[1]===w.uid);return send(r,200,items.map(name=>({name})))}
  const m=u.pathname.match(/^\/storage\/v1\/object\/(?:(authenticated|public)\/)?([^/]+)\/(.+)$/);
  if(m){const [,route,bucket,p]=m;const key=bucket+'/'+p;const mine=w.uid&&p.split('/')[0]===w.uid;
   if(q.method==='POST'){if(!w.uid||(!mine&&mode!=='leaky-storage'))return send(r,403,{message:'new row violates row-level security policy',statusCode:'403'});if(mode==='allowlist'){const ct=String(q.headers['content-type']||'').split(';')[0];if(!ALLOW.includes(ct))return send(r,415,{message:'mime type '+ct+' is not supported',statusCode:'415'});if(Buffer.byteLength(body)>10485760)return send(r,413,{message:'The object exceeded the maximum allowed size',statusCode:'413'})}objects[key]=body;return send(r,200,{Key:key})}
   if(q.method==='GET'){if(route==='public'||(!w.uid&&mode!=='leaky-storage'))return send(r,400,{message:'Bucket not found'});if(!mine&&mode!=='leaky-storage')return send(r,404,{message:'Object not found'});return objects[key]===undefined?send(r,404,{message:'Object not found'}):send(r,200,objects[key],true)}}
  if(u.pathname.startsWith('/storage/v1/object/')&&q.method==='DELETE'){const b=u.pathname.slice(19);const ps=(JSON.parse(body).prefixes||[]);const gone=[];for(const p of ps){const key=b+'/'+p;if(objects[key]!==undefined&&(mode==='leaky-storage'||p.split('/')[0]===w.uid)){delete objects[key];gone.push({name:p})}}return send(r,200,gone)}
  send(r,404,{message:'mock: unhandled '+q.method+' '+u.pathname})})});
 srv.listen(0,'127.0.0.1',()=>res({url:'http://127.0.0.1:'+srv.address().port,close:()=>srv.close()}))});
