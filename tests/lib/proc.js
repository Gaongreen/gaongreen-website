// Child-process helper with full diagnostics. Never throws; always reports status, signal, spawn error, timeout, and redacted stdout/stderr.
const {spawn}=require('child_process');
const redactor=(secrets)=>{const lit=(secrets||[]).filter(x=>x&&String(x).length>=3).map(String).sort((a,b)=>b.length-a.length);
 return s=>{s=String(s||'');for(const v of lit)s=s.split(v).join('[REDACTED]');
  return s.replace(/eyJ[\w-]{5,}\.[\w-]{5,}\.[\w-]*/g,'[REDACTED-JWT]').replace(/sb_(publishable|secret)_\w+/g,'sb_$1_[REDACTED]').replace(/(password|secret|apikey|api_key|authorization)(["']?\s*[:=]\s*["']?)[^\s"',}]+/gi,'$1$2[REDACTED]')}};
exports.redactor=redactor;
exports.run=(cmd,args,{env,timeoutMs=60000,secrets,maxBytes=4000}={})=>new Promise(res=>{
 const red=redactor(secrets);let so='',se='',spawnError=null,timedOut=false,done=false;
 const fin=(status,signal)=>{if(done)return;done=true;clearTimeout(tm);const cut=x=>{x=red(x);return x.length>maxBytes?x.slice(0,maxBytes/2)+'\n...[truncated '+(x.length-maxBytes)+' chars]...\n'+x.slice(-maxBytes/2):x};
  res({status,signal:signal||null,spawnError:spawnError&&{code:spawnError.code,message:red(spawnError.message)},timedOut,stdout:cut(so),stderr:cut(se)})};
 let c;try{c=spawn(cmd,args,{env,stdio:['ignore','pipe','pipe']})}catch(e){spawnError=e;return fin(null,null)}
 const tm=setTimeout(()=>{timedOut=true;try{c.kill('SIGKILL')}catch{}},timeoutMs);
 c.stdout.on('data',d=>so+=d);c.stderr.on('data',d=>se+=d);
 c.on('error',e=>{spawnError=e;fin(null,null)});c.on('close',(code,sig)=>fin(code,sig))});
// One-line human summary of a run, for check "actual" fields.
exports.describe=r=>`status=${r.status} signal=${r.signal} spawnError=${r.spawnError?r.spawnError.code||r.spawnError.message:'none'} timedOut=${r.timedOut}`+(r.stderr?` stderr="${r.stderr.replace(/\s+/g,' ').slice(0,200)}"`:'');
