// Offline test of tools/staging-draft-deploy.sh with a STUB netlify binary (nothing is sent anywhere). Builds fixture pinned outputs with node tools/build-pinned.js.
const fs=require('fs'),os=require('os'),path=require('path'),crypto=require('crypto'),{spawnSync}=require('child_process');const T=require('./lib/t.js');const t=T.make();
const root=process.cwd(),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sdd-'));const sh=(c,a,o={})=>spawnSync(c,a,{encoding:'utf8',...o});const sha=(b)=>crypto.createHash('sha256').update(b).digest('hex');
const ST='https://abcdefghijklmnopqrst.supabase.co';const REAL='https://gdmejzbycgpuabvutkdk.supabase.co';
const vd=path.join(tmp,'vendor');fs.mkdirSync(vd);const sdk=fs.readFileSync('demo/vendor/supabase-demo.umd.js');fs.writeFileSync(path.join(vd,'supabase.umd.js'),sdk);fs.copyFileSync('demo/vendor/qrcode-shim.js',path.join(vd,'qrcode-shim.js'));
fs.writeFileSync(path.join(vd,'MANIFEST.json'),JSON.stringify({name:'@supabase/supabase-js',version:'0.0.0-FIXTURE',fixture:true,file:'vendor/supabase.umd.js',sha256:sha(sdk),sha384:crypto.createHash('sha384').update(sdk).digest('base64')}));
const build=(name,extra)=>{const o=path.join(tmp,name);const r=sh('node',['tools/build-pinned.js','--vendor',vd,'--out',o,'--allow-fixture',...extra],{cwd:root});if(r.status)throw new Error(r.stderr);return o};
// stub netlify: records its args, prints JSON like the real CLI with --json
const bin=path.join(tmp,'bin');fs.mkdirSync(bin);const log=path.join(tmp,'calls.log');
const stub=(url)=>fs.writeFileSync(path.join(bin,'netlify'),`#!/usr/bin/env bash\necho "$@" >> "${log}"\necho '{"site_id":"x","deploy_id":"d","deploy_url":"${url}","logs":"l"}'\n`,{mode:0o755});
const run=(dist,extra=[],env={})=>sh('bash',[path.join(root,'tools/staging-draft-deploy.sh'),'--dist',dist,...extra],{cwd:tmp,env:{...process.env,PATH:bin+':'+process.env.PATH,...env}});
(async()=>{
 // A "real-looking" staging build = fixture build whose manifest we flip to non-fixture and retarget to the REAL staging host (simulates the user's build)
 const good=build('good',['--target-url',REAL,'--target-key','sb_publishable_FICTIONALKEY0123456789abcd']);
 const flip=d=>{const p=path.join(d,'RELEASE_MANIFEST.json');const m=JSON.parse(fs.readFileSync(p,'utf8'));m.sdk.fixture=false;fs.writeFileSync(p,JSON.stringify(m));fs.rmSync(path.join(d,'FIXTURE_NOT_REAL_SDK.txt'),{force:true})};flip(good);
 const keep=path.join(tmp,'validate-backup-only.html');fs.writeFileSync(keep,'<html>preserved</html>');
 stub('https://6a1b2c3d4e5f6a1b2c3d4e5f--incredible-biscotti-bcf58a.netlify.app');
 let r=run(good,['--keep-file',keep]);
 await t.check('D1','default run is a dry run: checks pass, preserved file counted, the Netlify CLI is NOT called',async()=>({ok:r.status===0&&/checks passed/.test(r.stdout)&&/validate-backup-only\.html/.test(r.stdout)&&/dry run: nothing deployed/.test(r.stdout)&&!fs.existsSync(log),expected:'exit 0, no CLI call',actual:`exit ${r.status} ${r.stderr.slice(0,100)}`}));
 r=run(good,['--keep-file',keep,'--deploy']);const call=fs.existsSync(log)?fs.readFileSync(log,'utf8'):'';
 await t.check('D2','--deploy calls the CLI for the existing site id WITHOUT --prod/--alias, deploys a temp copy that contains the preserved page, and reports a draft URL',async()=>({ok:r.status===0&&/^deploy --dir /.test(call)&&!/--prod|--alias/.test(call)&&/--site 48c18d02-eb99-46b4-a68d-96f724940fd9/.test(call)&&/DRAFT deploy URL: https:\/\/[0-9a-f]+--incredible/.test(r.stdout),expected:'draft deploy, no --prod',actual:`exit ${r.status} call=${call.slice(0,120)} ${r.stdout.slice(-120)}`}));
 await t.check('D3','the dist folder itself is not modified (preserved file only added to the temp copy)',async()=>({ok:!fs.existsSync(path.join(good,'validate-backup-only.html')),expected:'absent in dist',actual:String(fs.existsSync(path.join(good,'validate-backup-only.html')))}));
 const bad=[];const REF=[];
 const fixture=build('fixture',['--target-url',REAL,'--target-key','sb_publishable_FICTIONALKEY0123456789abcd']);REF.push(['fixture build',fixture,/FIXTURE|fixture/]);
 const other=build('other',['--target-url',ST,'--target-key','sb_publishable_FICTIONALKEY0123456789abcd']);flip(other);REF.push(['target is another project',other,/target is/]);
 const notarget=build('notarget',[]);flip(notarget);REF.push(['production-targeted build (no --target-url)',notarget,/target is/]);
 const prod=build('prod',['--target-url',REAL,'--target-key','sb_publishable_FICTIONALKEY0123456789abcd']);flip(prod);fs.writeFileSync(path.join(prod,'leak.txt'),'uyhmbecltrswiljbyass');REF.push(['production ref present',prod,/production project ref/]);
 const sec=build('sec',['--target-url',REAL,'--target-key','sb_publishable_FICTIONALKEY0123456789abcd']);flip(sec);fs.writeFileSync(path.join(sec,'leak.txt'),'sb_secret_abcdefghijklmnopqrstuvwx');REF.push(['secret pattern',sec,/secret/]);
 const nohdr=build('nohdr',['--target-url',REAL,'--target-key','sb_publishable_FICTIONALKEY0123456789abcd']);flip(nohdr);fs.rmSync(path.join(nohdr,'_headers'));REF.push(['no _headers',nohdr,/_headers/]);
 fs.rmSync(log,{force:true});
 await t.check('D4','refuses (exit 2, CLI never called): fixture build, other staging project, production-targeted build, production ref in a file, secret pattern, missing _headers',async()=>{for(const [n,d,re] of REF){const x=run(d,['--deploy']);if(x.status!==2||!re.test(x.stderr))bad.push(n+': '+x.status+' '+x.stderr.slice(0,70))}return{ok:!bad.length&&!fs.existsSync(log),expected:'6/6 refused, no call',actual:JSON.stringify(bad)}});
 await t.check('D5','--prod, --alias and --prod-if-unlocked are refused outright',async()=>{const x=['--prod','--alias','--prod-if-unlocked'].map(f=>run(good,['--deploy',f]).status);return{ok:x.every(s=>s===2)&&!fs.existsSync(log),expected:'[2,2,2]',actual:JSON.stringify(x)}});
 stub('https://incredible-biscotti-bcf58a.netlify.app');r=run(good,['--deploy']);
 await t.check('D6','if the CLI result does not look like a draft URL (could be the live site), the script exits 4 and warns instead of claiming success',async()=>({ok:r.status===4&&/could not confirm a draft URL/.test(r.stderr),expected:'exit 4 + warning',actual:`exit ${r.status} ${r.stderr.slice(0,100)}`}));
 fs.writeFileSync(process.argv[2]||'staging-draft-deploy.json',JSON.stringify({run:new Date().toISOString(),build:'OFFLINE with a stub Netlify CLI',results:t.res},null,1));process.exit(t.res.every(x=>x.status==='PASS')?0:1)})().catch(e=>{console.error(e);process.exit(1)});
