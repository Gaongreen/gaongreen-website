// Copies the pinned Supabase UMD bundle out of node_modules into vendor/ and records hashes.
// Refuses to continue if the installed version differs from the exact pin in package.json.
// Usage: node tools/vendor-copy.js [rootDir]   (rootDir defaults to cwd; used by tests with a fake tree)
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(process.argv[2]||process.cwd());const die=m=>{console.error('VENDOR-COPY REFUSED: '+m);process.exit(1)};
const rd=f=>fs.readFileSync(path.join(root,f));const hash=(a,b)=>crypto.createHash(a).update(b).digest(b==='hex'?'hex':'hex');
const pkg=JSON.parse(rd('package.json'));const pin=pkg.dependencies&&pkg.dependencies['@supabase/supabase-js'];
if(!pin||!/^\d+\.\d+\.\d+$/.test(pin))die('package.json must pin @supabase/supabase-js to an exact x.y.z (found '+pin+')');
const nm='node_modules/@supabase/supabase-js';if(!fs.existsSync(path.join(root,nm,'package.json')))die('node_modules not installed (run npm ci)');
const inst=JSON.parse(rd(nm+'/package.json'));if(inst.version!==pin)die(`installed ${inst.version} != pinned ${pin}`);
if(!fs.existsSync(path.join(root,'package-lock.json')))die('package-lock.json missing (commit it)');
const lock=JSON.parse(rd('package-lock.json'));const ent=lock.packages&&lock.packages[nm];
if(!ent||ent.version!==pin||!/^sha512-/.test(ent.integrity||''))die('lockfile entry for supabase-js missing, wrong version, or no sha512 integrity');
const src=path.join(root,nm,'dist/umd/supabase.js');if(!fs.existsSync(src)){const d=path.join(root,nm,'dist/umd');die('dist/umd/supabase.js not found; present: '+(fs.existsSync(d)?fs.readdirSync(d).join(', '):'(no dist/umd)'))}
const bytes=fs.readFileSync(src);fs.mkdirSync(path.join(root,'vendor'),{recursive:true});fs.writeFileSync(path.join(root,'vendor/supabase.umd.js'),bytes);
const deps=Object.entries(lock.packages).filter(([k])=>k.startsWith('node_modules/')).map(([k,v])=>({name:k.slice(13),version:v.version,integrity:v.integrity||null}));
const manifest={name:'@supabase/supabase-js',version:pin,file:'vendor/supabase.umd.js',source:'node_modules/@supabase/supabase-js/dist/umd/supabase.js',bytes:bytes.length,
 sha256:crypto.createHash('sha256').update(bytes).digest('hex'),sha384:crypto.createHash('sha384').update(bytes).digest('base64'),tarballIntegrity:ent.integrity,
 lockedDependencies:deps,generatedBy:'tools/vendor-copy.js',note:'Provenance = npm registry tarball integrity recorded in package-lock.json (sha512). See docs/PINNED_SDK.md for what this does and does not prove.'};
fs.writeFileSync(path.join(root,'vendor/MANIFEST.json'),JSON.stringify(manifest,null,1));console.log(`vendored supabase-js ${pin}: ${bytes.length} bytes sha256=${manifest.sha256}`);
