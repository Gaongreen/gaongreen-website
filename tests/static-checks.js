// Static checks over the CANONICAL page set (pages reachable from index.html).
// Reports policy gaps and broken navigation. Exit 1 if any check fails. Reads files only.
const fs=require('fs'),path=require('path');const root=process.cwd();
const rd=f=>fs.readFileSync(path.join(root,f),'utf8');
const local=h=>[...h.matchAll(/(?:href|src)\s*=\s*["']([^"'#?]+\.html?)(?:[#?][^"']*)?["']|location\.(?:href|assign|replace)[^"']*["']\.?\/?([^"'#?]+\.html)/gi)].map(m=>decodeURIComponent((m[1]||m[2]).replace(/^\.\//,'')));
const seen=new Set(),q=['index.html'],broken=[];
while(q.length){const f=q.shift();if(seen.has(f))continue;if(!fs.existsSync(path.join(root,f))){broken.push(f);continue}seen.add(f);for(const t of local(rd(f)))if(!/^https?:/.test(t))q.push(t)}
const pages=[...seen];const res=[];const add=(id,name,fail,detail)=>res.push({id,name,status:fail.length?'FAIL':'PASS',detail:fail.length?fail:undefined});
add('S1','Canonical set resolves (every local link target exists)',broken,{pages:pages.length});
const grep=(re,files=pages)=>files.filter(f=>re.test(rd(f)));
add('S2','No floating SDK version (supabase-js must be pinned x.y.z)',grep(/supabase-js@2(?![\d.])/));
add('S3','Every external script has integrity= (SRI)',pages.filter(f=>[...rd(f).matchAll(/<script[^>]+src=["']https?:[^>]*>/gi)].some(m=>!/integrity=/.test(m[0]))));
add('S4','No ES-module import of third-party code from a CDN URL',grep(/import[^;\n]*from\s*['"]https?:\/\//));
add('S5','Auth sessions are not persisted (persistSession:false or absent client)',grep(/persistSession\s*:\s*true/));
add('S6','detectSessionInUrl is not enabled',grep(/detectSessionInUrl\s*:\s*true/));
add('S7','No secret/service-role key material',grep(/sb_secret_|service_role|BEGIN [A-Z ]*PRIVATE KEY/));
add('S8','A Content-Security-Policy is declared',pages.filter(f=>!/Content-Security-Policy/i.test(rd(f))));
add('S9','Supabase project URL/key are not duplicated inline (single config module)',grep(/sb_publishable_/));
for(const r of res)console.log(r.status.padEnd(5)+r.id+'  '+r.name+(r.detail?`  [${r.detail.length} page(s): ${r.detail.slice(0,3).join(' | ')}${r.detail.length>3?' ...':''}]`:''));
fs.writeFileSync(process.argv[2]||'static-result.json',JSON.stringify({run:new Date().toISOString(),canonicalPages:pages,brokenLinks:broken,results:res},null,1));
process.exit(res.some(r=>r.status==='FAIL')?1:0);
