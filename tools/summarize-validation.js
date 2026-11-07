#!/usr/bin/env node
// Builds the SHAREABLE summary of a staging validation run by ALLOW-LISTING fields (not by scrubbing a raw log), then runs independent leak detectors over the result.
// Usage: node tools/summarize-validation.js --state state.txt --out share.txt [--rls rls.json] [--manifest RELEASE_MANIFEST.json] [--deploy deploy-summary.txt] [--secret-file f]...
// Secrets to look for (the two passwords) are read from env GG_SCAN_SECRETS (JSON array) — never from argv. Exit 0 = share.txt written and clean; 4 = leak detector fired, share.txt NOT written (a .WITHHELD note is).
const fs=require('fs');const arg=(k)=>{const i=process.argv.indexOf(k);return i>0?process.argv[i+1]:null};
const read=(p)=>{try{return p?fs.readFileSync(p,'utf8'):null}catch(e){return null}};
const scrub=(s)=>String(s==null?'':s).replace(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}\.?[A-Za-z0-9_-]*/g,'[jwt]').replace(/sb_(secret|publishable)_[A-Za-z0-9_-]+/g,'[key]').replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}/gi,'[email]').replace(/[A-Za-z0-9_\-+/=]{24,}/g,'[long-token]').replace(/\s+/g,' ').slice(0,160);
const lines=[];const L=(x='')=>lines.push(x);
const state={};(read(arg('--state'))||'').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)state[m[1]]=m[2]});
L('GAONGREEN STAGING VALIDATION — shareable summary (allow-listed fields only)');
L('generated: '+new Date().toISOString());
for(const k of ['RESULT','COMMIT','TREE_DIRTY','PRECHECK','OFFLINE','BUILD','GUARD','RLS','DEPLOY'])if(state[k]!==undefined)L(k.padEnd(11)+scrub(state[k]));
const man=read(arg('--manifest'));if(man){try{const m=JSON.parse(man);L();L('build manifest (allow-listed): sdk '+scrub(m.sdk&&m.sdk.version)+' fixture='+!!(m.sdk&&m.sdk.fixture)+' sha256 '+String(m.sdk&&m.sdk.sha256||'').replace(/[^0-9a-f]/g,'').slice(0,64)+' target '+scrub(m.target&&m.target.host))}catch(e){L('build manifest: unreadable')}}
const rls=read(arg('--rls'));if(rls){try{const r=JSON.parse(rls);L();L('live RLS/storage test: '+Number(r.total)+' checks, '+Number(r.failed)+' failed, target '+scrub(r.target));(r.results||[]).forEach(x=>L('  '+(x.status==='PASS'?'PASS':'FAIL')+' '+scrub(x.id).slice(0,40)+' '+scrub(x.name).slice(0,120)+(x.status==='PASS'?'':'  :: '+scrub(x.detail))))}catch(e){L('live RLS result: unreadable')}}
const dep=read(arg('--deploy'));const exempt=[];
if(dep){L();dep.split('\n').filter(Boolean).slice(0,12).forEach(x=>{
 // exact-format allow-list: Netlify deploy ids are 24 hex chars; the draft URL is <id>--<this site>.netlify.app; anything else is scrubbed
 let m;if((m=x.match(/^DRAFT deploy id: ([0-9a-f]{24})$/))){L('deploy: DRAFT deploy id: '+m[1]);exempt.push(m[1]);return}
 if((m=x.match(/^DRAFT deploy URL: (https:\/\/[0-9a-f]{24}--incredible-biscotti-bcf58a\.netlify\.app)(?: |$)/))){L('deploy: DRAFT deploy URL: '+m[1]);exempt.push(m[1]);return}
 if((m=x.match(/^(verified: live site still serves|live site currently serves deploy) ([0-9a-f]{24})\b/))){L('deploy: '+m[1]+' '+m[2]);exempt.push(m[2]);return}
 L('deploy: '+scrub(x))})}
const out=lines.join('\n')+'\n';let scan=out;exempt.forEach(e=>{scan=scan.split(e).join('')});
// independent detectors over the final text
const secrets=(()=>{try{return JSON.parse(process.env.GG_SCAN_SECRETS||'[]')}catch(e){return[]}})().filter(s=>typeof s==='string'&&s.length>=4);
const hits=[];for(const s of secrets){for(const v of [s,Buffer.from(s).toString('base64'),encodeURIComponent(s),Buffer.from(s).toString('hex')])if(scan.includes(v))hits.push('a supplied password (or its encoding) appears')}
if(/eyJ[A-Za-z0-9_-]{8,}\./.test(scan))hits.push('JWT-like token');if(/sb_secret_|service_role|Bearer\s+\S/i.test(scan))hits.push('secret/Bearer pattern');
if(/(?:^|[^0-9a-f])[0-9a-f]{65,}/.test(scan)||/[A-Za-z0-9_\-+/=]{40,}/.test(scan.replace(/[0-9a-f]{64}/g,'')))hits.push('long high-entropy string');
if(/\/(home|Users|workspaces)\/[^\s]+/.test(scan))hits.push('local path');
if(hits.length){fs.writeFileSync(arg('--out')+'.WITHHELD','withheld: '+[...new Set(hits)].join('; ')+'\n');console.error('SHARE FILE WITHHELD: '+[...new Set(hits)].join('; '));process.exit(4)}
fs.writeFileSync(arg('--out'),out);console.log(out);process.exit(0);
