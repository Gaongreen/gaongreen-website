/* GaonGreen OFFLINE DEMO stand-in for the Supabase JS client.
 * NOT Supabase. No network, no real auth, no real RLS. Fictional data only.
 * Implements only the calls the GaonGreen pages use.
 * Data lives in this browser: localStorage (tables) + IndexedDB (storage objects), keys prefixed gaongreen_demo_v1. */
const NS='gaongreen_demo_v1:';
const DEMO_USER={id:'00000000-0000-4000-8000-000000000001',email:'demo.user@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{demo:true}};
const ls=()=>{try{return window.localStorage}catch(e){return null}};
const ss=()=>{try{return window.sessionStorage}catch(e){return null}};
const clone=v=>v===undefined?v:JSON.parse(JSON.stringify(v));
const uuid=()=>(self.crypto&&crypto.randomUUID)?crypto.randomUUID():'00000000-0000-4000-8000-'+String(Date.now()).padStart(12,'0').slice(-12);
const err=(message,code)=>({message,code:code||'DEMO',details:null,hint:null});
let signedOut=ss()&&ss().getItem(NS+'signedOut')==='1';
const mirror=()=>{try{const k='sb-demo-auth-token';if(signedOut)ss()&&ss().removeItem(k);else {ss()&&ss().setItem(k,JSON.stringify({demo:true}));if(ss()&&!ss().getItem('gg-last-activity'))ss().setItem('gg-last-activity',String(Date.now()))}}catch(e){}};mirror(); // like the real SDK: a session token key exists in sessionStorage only while signed in
const listeners=new Set();
const session=()=>signedOut?null:{access_token:'demo-not-a-real-token',refresh_token:'demo-not-a-real-token',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:clone(DEMO_USER)};
const emit=ev=>{const s=session();listeners.forEach(cb=>{try{cb(ev,s)}catch(e){console.error(e)}})};
function readTable(t){const s=ls();let raw=s&&s.getItem(NS+'table:'+t);if(raw==null){const fx=(self.GAONGREEN_DEMO_FIXTURES||{})[t];const rows=clone(fx)||[];writeTable(t,rows);return rows}try{return JSON.parse(raw)}catch(e){return[]}}
function writeTable(t,rows){const s=ls();if(s)s.setItem(NS+'table:'+t,JSON.stringify(rows))}
const ownerOk=r=>{const o=r.owner_id!==undefined?r.owner_id:r.user_id;return o===undefined||o===DEMO_USER.id};
class Query{
  constructor(t){this.t=t;this.op='select';this.filters=[];this.ord=null;this.lim=null;this.mode='many';this.payload=null;this.opts={};this.returning=false}
  select(){this.returning=true;return this}
  insert(v){this.op='insert';this.payload=v;return this}
  upsert(v,o){this.op='upsert';this.payload=v;this.opts=o||{};return this}
  update(v){this.op='update';this.payload=v;return this}
  delete(){this.op='delete';return this}
  eq(c,v){this.filters.push(r=>r[c]===v);return this}
  neq(c,v){this.filters.push(r=>r[c]!==v);return this}
  gt(c,v){this.filters.push(r=>r[c]>v);return this}
  gte(c,v){this.filters.push(r=>r[c]>=v);return this}
  lt(c,v){this.filters.push(r=>r[c]<v);return this}
  lte(c,v){this.filters.push(r=>r[c]<=v);return this}
  in(c,a){this.filters.push(r=>a.includes(r[c]));return this}
  is(c,v){this.filters.push(r=>r[c]===v);return this}
  order(c,o){this.ord={c,asc:!(o&&o.ascending===false)};return this}
  limit(n){this.lim=n;return this}
  single(){this.mode='single';return this}
  maybeSingle(){this.mode='maybe';return this}
  then(res,rej){return Promise.resolve().then(()=>this.run()).then(res,rej)}
  run(){
    if(signedOut)return{data:null,error:err('JWT required: not signed in (demo)','401')};
    if(backendDown)return{data:null,error:down()};
    const all=readTable(this.t);const match=r=>this.filters.every(f=>f(r));
    const shape=rows=>{rows=clone(rows);
      if(this.mode==='single'){return rows.length===1?{data:rows[0],error:null}:{data:null,error:err('JSON object requested, multiple (or no) rows returned','PGRST116')}}
      if(this.mode==='maybe'){return rows.length<=1?{data:rows[0]||null,error:null}:{data:null,error:err('multiple rows returned','PGRST116')}}
      return{data:rows,error:null}};
    if(this.op==='select'){let rows=all.filter(r=>ownerOk(r)&&match(r));
      if(this.ord){const{c,asc}=this.ord;rows.sort((a,b)=>(a[c]>b[c]?1:a[c]<b[c]?-1:0)*(asc?1:-1))}
      if(this.lim!=null)rows=rows.slice(0,this.lim);return shape(rows)}
    const incoming=[].concat(this.payload===null?[]:this.payload);
    if(this.op==='insert'||this.op==='upsert'){
      for(const r of incoming){if(!ownerOk(r))return{data:null,error:err('new row violates row-level security policy for table "'+this.t+'" (demo emulation)','42501')}}
      const key=this.opts.onConflict||'id';const out=[];const now=new Date().toISOString();
      for(const r0 of incoming){const r=clone(r0);if(r.created_at===undefined)r.created_at=now;
        const i=r[key]===undefined?-1:all.findIndex(x=>x[key]===r[key]);
        if(i>=0){if(this.op==='insert')return{data:null,error:err('duplicate key value violates unique constraint (demo)','23505')};all[i]=Object.assign({},all[i],r);out.push(all[i])}
        else{all.push(r);out.push(r)}}
      writeTable(this.t,all);return this.returning?shape(out):{data:null,error:null}}
    if(this.op==='update'){const out=[];all.forEach((r,i)=>{if(ownerOk(r)&&match(r)){all[i]=Object.assign({},r,clone(this.payload));out.push(all[i])}});writeTable(this.t,all);return this.returning?shape(out):{data:null,error:null}}
    if(this.op==='delete'){const keep=[],gone=[];all.forEach(r=>(ownerOk(r)&&match(r)?gone:keep).push(r));writeTable(this.t,keep);return this.returning?shape(gone):{data:null,error:null}}
    return{data:null,error:err('unsupported operation in demo stub')}}
}
const idb=()=>new Promise((res,rej)=>{const q=indexedDB.open(NS+'objects',1);q.onupgradeneeded=()=>q.result.createObjectStore('o',{keyPath:'k'});q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)});
const tx=async(mode,fn)=>{const db=await idb();return new Promise((res,rej)=>{const t=db.transaction('o',mode);const st=t.objectStore('o');let out;const rq=fn(st);if(rq)rq.onsuccess=()=>{out=rq.result};t.oncomplete=()=>{db.close();res(out)};t.onerror=()=>{db.close();rej(t.error)}})};
// TEST-ONLY fault injection for the OFFLINE STAND-IN (never present in real pages): lets automated tests simulate an expired session and a backend outage.
let backendDown=false;
const down=()=>err('Service unavailable (demo fault injection)','503');
self.__ggDemoTest={expireSession(){signedOut=true;ss()&&ss().setItem(NS+'signedOut','1')},failBackend(on){backendDown=!!on}};
const bucket=b=>({
  async upload(path,file,opts){if(signedOut)return{data:null,error:err('not signed in (demo)','401')};if(backendDown)return{data:null,error:down()};const k=b+'/'+path;const ex=await tx('readonly',s=>s.get(k));
    if(ex&&!(opts&&opts.upsert))return{data:null,error:{message:'The resource already exists',statusCode:'409'}};
    await tx('readwrite',s=>s.put({k,blob:file,type:(opts&&opts.contentType)||file.type||'application/octet-stream',size:file.size,at:Date.now()}));return{data:{path,id:uuid(),fullPath:k},error:null}},
  async download(path){if(backendDown)return{data:null,error:down()};const o=await tx('readonly',s=>s.get(b+'/'+path));return o?{data:o.blob,error:null}:{data:null,error:{message:'Object not found',statusCode:'404'}}},
  async remove(paths){if(backendDown)return{data:null,error:down()};for(const p of paths)await tx('readwrite',s=>s.delete(b+'/'+p));return{data:paths.map(name=>({name})),error:null}},
  async list(prefix){if(backendDown)return{data:null,error:down()};const all=await tx('readonly',s=>s.getAll());const pre=b+'/'+(prefix||'');return{data:(all||[]).filter(o=>o.k.startsWith(pre)).map(o=>({name:o.k.slice(b.length+1),metadata:{size:o.size,mimetype:o.type}})),error:null}},
  async createSignedUrl(path){const o=await tx('readonly',s=>s.get(b+'/'+path));return o?{data:{signedUrl:URL.createObjectURL(o.blob)},error:null}:{data:null,error:{message:'Object not found'}}},
  getPublicUrl(path){return{data:{publicUrl:'about:blank#demo-no-public-urls/'+encodeURIComponent(path)}}}
});
function createClient(url,key,opts){
  return{
    __gaongreenDemo:true,
    auth:{
      async getSession(){return{data:{session:session()},error:null}},
      async getUser(){return signedOut?{data:{user:null},error:err('Auth session missing! (demo signed out)','401')}:{data:{user:clone(DEMO_USER)},error:null}},
      onAuthStateChange(cb){listeners.add(cb);setTimeout(()=>{try{cb('INITIAL_SESSION',session())}catch(e){console.error(e)}},0) /* supabase-js always reports INITIAL_SESSION on subscribe (session may be null); it does not emit SIGNED_OUT here */;return{data:{subscription:{unsubscribe(){listeners.delete(cb)}}}}},
      async signInWithPassword(c){if(!c||!c.email||!c.password)return{data:{user:null,session:null},error:err('Email and password required (demo accepts any fictional values)','400')};signedOut=false;ss()&&ss().removeItem(NS+'signedOut');mirror();emit('SIGNED_IN');return{data:{user:clone(DEMO_USER),session:session()},error:null}},
      async signUp(c){if(!c||!c.email||!c.password)return{data:{user:null,session:null},error:err('Email and password required','400')};signedOut=false;ss()&&ss().removeItem(NS+'signedOut');mirror();emit('SIGNED_IN');return{data:{user:clone(DEMO_USER),session:session()},error:null}},
      async signOut(){signedOut=true;ss()&&ss().setItem(NS+'signedOut','1');mirror();emit('SIGNED_OUT');return{error:null}},
      async updateUser(){return signedOut?{data:{user:null},error:err('not signed in','401')}:{data:{user:clone(DEMO_USER)},error:null}},
      async resetPasswordForEmail(){return{data:{},error:null}},
      async refreshSession(){return{data:{session:session(),user:signedOut?null:clone(DEMO_USER)},error:signedOut?err('not signed in','401'):null}}
    },
    from:t=>new Query(t),
    storage:{from:bucket},
    async rpc(){return{data:null,error:err('rpc not available in demo')}}
  };
}
