#!/usr/bin/env node
// READ-ONLY check of a DEPLOYED copy of dist-pinned/ (e.g. the Netlify STAGING site). Sends GET requests only; changes nothing.
// Usage: node tools/check-headers.js <https://staging-site> [--manifest dist-pinned/RELEASE_MANIFEST.json] [--out result.json]
// Verifies per page: HTTP 200; body sha256 == RELEASE_MANIFEST; response CSP header == the page's meta CSP + frame-ancestors 'none';
// baseline hardening headers; and every vendored script's served bytes match the SRI in the page. Exit 0 all pass, 1 any failure, 2 refused/usage.
// Refuses: non-https (except 127.0.0.1/localhost for offline tests) and the PRODUCTION Supabase project host or any PRODUCTION_HOSTS entry as a site.
const fs=require('fs'),crypto=require('crypto');
const die=(m,c=2)=>{console.error('check-headers: '+m);process.exit(c)};
const a=process.argv.slice(2);if(!a[0]||a[0].startsWith('--'))die('usage: node tools/check-headers.js <https://site> [--manifest file] [--out file]');
const opt=n=>{const i=a.indexOf(n);return i>0?a[i+1]:null};
let base;try{base=new URL(a[0])}catch{die('invalid URL')}
const local=['127.0.0.1','localhost'].includes(base.hostname);
if(base.protocol!=='https:'&&!(local&&base.protocol==='http:'))die('only https sites are checked (http allowed for 127.0.0.1/localhost only)');
if(base.username||base.password)die('credentials in URL are refused');
const prodHosts=['uyhmbecltrswiljbyass.supabase.co',...String(process.env.PRODUCTION_HOSTS||'').split(',').map(s=>s.trim()).filter(Boolean)];
if(prodHosts.includes(base.hostname)||base.hostname.includes('uyhmbecltrswiljbyass'))die('refusing: that is the PRODUCTION host');
const manPath=opt('--manifest')||'dist-pinned/RELEASE_MANIFEST.json';let man;try{man=JSON.parse(fs.readFileSync(manPath,'utf8'))}catch(e){die('cannot read manifest '+manPath+': '+e.message)}
if(!man.pages||!Object.keys(man.pages).length)die('manifest has no pages');
const sha=(alg,b,enc)=>crypto.createHash(alg).update(b).digest(enc);
const res=[];const rec=(id,ok,detail)=>{res.push({id,status:ok?'PASS':'FAIL',detail});console.log((ok?'PASS ':'FAIL ')+id+(ok?'':'  '+detail))};
const get=async p=>{const r=await fetch(new URL(p,base),{redirect:'manual',method:'GET'});return{status:r.status,h:r.headers,body:Buffer.from(await r.arrayBuffer())}};
const BASE=[['x-content-type-options',v=>v.toLowerCase()==='nosniff'],['x-frame-options',v=>v.toUpperCase()==='DENY'],['referrer-policy',v=>v==='strict-origin-when-cross-origin'],['permissions-policy',v=>/camera=\(\)/.test(v)],['cross-origin-opener-policy',v=>v==='same-origin'],['strict-transport-security',v=>/max-age=\d{7,}/.test(v)]];
(async()=>{
 for(const [f,want] of Object.entries(man.pages)){
  const p='/'+encodeURIComponent(f).replace(/%2F/g,'/');let r;
  try{r=await get(p)}catch(e){rec(f+' fetch',false,String(e.message));continue}
  rec(f+' status',r.status===200,'HTTP '+r.status);if(r.status!==200)continue;
  rec(f+' body-sha256',sha('sha256',r.body,'hex')===want,'served body differs from RELEASE_MANIFEST (not the audited build, or modified by the host)');
  const html=r.body.toString('utf8');const meta=(html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)||[])[1];const hc=r.h.get('content-security-policy')||'';
  rec(f+' csp-header',!!meta&&hc===meta+"; frame-ancestors 'none'",'header='+hc.slice(0,120));
  const miss=BASE.filter(([n,ok])=>!(r.h.get(n)&&ok(r.h.get(n)))).map(x=>x[0]);rec(f+' baseline-headers',!miss.length,'missing/wrong: '+miss.join(','));
  for(const m of html.matchAll(/<script[^>]+src="([^"]+)"[^>]*integrity="(sha384-[^"]+)"/g)){let v;try{v=await get(new URL(m[1],new URL(p,base)).pathname)}catch(e){rec(f+' sri '+m[1],false,String(e.message));continue}
   rec(f+' sri '+m[1],v.status===200&&'sha384-'+sha('sha384',v.body,'base64')===m[2],'served script does not match SRI (status '+v.status+')')}
 }
 const bad=res.filter(x=>x.status!=='PASS').length;console.log(`check-headers: ${res.length-bad} PASS, ${bad} FAIL against ${base.origin}`);
 const o=opt('--out');if(o)fs.writeFileSync(o,JSON.stringify({site:base.origin,checked:new Date().toISOString(),note:'Read-only GET checks of a deployed site. Proves served bytes/headers only; says nothing about Supabase.',results:res},null,1));process.exit(bad?1:0)})().catch(e=>die(String(e.message),2));
