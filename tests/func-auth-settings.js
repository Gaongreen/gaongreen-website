// Login / Register / Company Settings checks on the OFFLINE DEMO build.
// STAND-IN ONLY: sign-in "succeeds" for any email+password>=8 chars; no real Supabase auth, email, or rate limits are involved.
const S=require('./lib/serve.js'),T=require('./lib/t.js'),fs=require('fs');
(async()=>{const s=await S.start('demo'),t=T.make();
 const open=async f=>{const pg=await s.page();pg.on('dialog',d=>d.accept());await pg.goto(s.base+f);await pg.waitForTimeout(600);return pg};
 const vis=(pg,id)=>pg.evaluate(i=>!document.getElementById(i).classList.contains('hidden'),id);
 const msg=async pg=>({text:(await pg.locator('#status').innerText()).trim(),cls:await pg.locator('#status').getAttribute('class')});
 // ---- Login
 let pg=await open('GaonGreen_Login.html');
 await t.check('A1','Login: demo starts signed in and shows the account email',async()=>({ok:await vis(pg,'signedIn')&&(await pg.locator('#sessionEmail').innerText())==='demo.user@example.invalid',expected:'signedIn section visible with demo email',actual:await pg.locator('#sessionEmail').innerText()}));
 await pg.click('#logout');await pg.waitForTimeout(400);
 await t.check('A2','Login: sign out returns to the sign-in form with a success notice',async()=>{const m=await msg(pg);return{ok:await vis(pg,'authForm')&&!(await vis(pg,'signedIn'))&&/ok/.test(m.cls),expected:'authForm shown, ok notice',actual:JSON.stringify(m)}});
 // Browser-level validation (required / minlength=8) blocks the submit before page JS runs:
 const formState=()=>pg.evaluate(()=>{const f=document.getElementById('form');return{valid:f.checkValidity(),tooShort:document.getElementById('password').validity.tooShort,valueMissing:document.getElementById('email').validity.valueMissing}});
 await t.check('A3','Login: empty form is invalid at browser level (required) and clicking Sign in does not sign in',async()=>{await pg.click('#submit');await pg.waitForTimeout(300);const f=await formState();return{ok:f.valid===false&&f.valueMissing&&await vis(pg,'authForm'),expected:'invalid, still signed out',actual:JSON.stringify(f)}});
 await pg.fill('#email','person@example.invalid');await pg.fill('#password','1234567');await pg.click('#submit');await pg.waitForTimeout(300);
 await t.check('A4','Login: 7-character password is blocked by the browser (minlength=8) and no sign-in happens',async()=>{const f=await formState();return{ok:f.tooShort&&await vis(pg,'authForm'),expected:'tooShort, still signed out',actual:JSON.stringify(f)}});
 // Page-level backup guard (reachable if browser validation is bypassed): dispatch submit directly.
 await pg.evaluate(()=>document.getElementById('form').dispatchEvent(new Event('submit',{cancelable:true,bubbles:true})));await pg.waitForTimeout(300);
 await t.check('A4b','Login: the page JS also rejects a 7-character password if browser validation is bypassed',async()=>{const m=await msg(pg);return{ok:/error/.test(m.cls)&&await vis(pg,'authForm'),expected:'error notice, still signed out',actual:JSON.stringify(m)}});
 await pg.fill('#password','12345678');await pg.click('#submit');await pg.waitForTimeout(500);
 await t.check('A5','Login: password of exactly 8 characters is accepted (boundary) and signs in',async()=>({ok:await vis(pg,'signedIn'),expected:'signedIn visible',actual:JSON.stringify(await msg(pg))}));
 await pg.click('#logout');await pg.waitForTimeout(300);await pg.fill('#email','person@example.invalid');await pg.click('#forgot');await pg.waitForTimeout(200);
 await t.check('A6','Login: "Forgot password" opens the reset form with the email prefilled',async()=>({ok:await vis(pg,'resetForm')&&(await pg.inputValue('#resetEmail'))==='person@example.invalid',expected:'resetForm visible + prefilled',actual:await pg.inputValue('#resetEmail')}));
 await pg.locator('#reset button[type=submit], #reset button').first().click();await pg.waitForTimeout(400);
 await t.check('A7','Login: submitting the reset form shows a success notice',async()=>{const m=await msg(pg);return{ok:/ok/.test(m.cls),expected:'ok notice',actual:JSON.stringify(m)}});
 await pg.context().close();
 // ---- Register
 pg=await open('GaonGreen_Register.html');await pg.click('#logout');await pg.waitForTimeout(300);
 await pg.fill('#email','new.person@example.invalid');await pg.fill('#password','12345678');await pg.fill('#confirm','12345679');await pg.click('#submit');await pg.waitForTimeout(300);
 await t.check('A8','Register: mismatched confirmation is rejected',async()=>{const m=await msg(pg);return{ok:/error/.test(m.cls),expected:'error notice',actual:JSON.stringify(m)}});
 await pg.fill('#confirm','12345678');await pg.click('#submit');await pg.waitForTimeout(500);
 await t.check('A9','Register: matching 8-char password shows success and clears the form',async()=>{const m=await msg(pg);return{ok:/ok/.test(m.cls)&&(await pg.inputValue('#email'))==='',expected:'ok notice + form reset',actual:JSON.stringify(m)+' email='+await pg.inputValue('#email')}});
 await pg.context().close();
 // ---- Signed-out behaviour of a tool page: cloud save must be refused and write nothing
 pg=await open('GaonGreen_Login.html');await pg.click('#logout');await pg.waitForTimeout(300);
 await pg.goto(s.base+'GaonGreen_EPR_Cloud_Beta.html');await pg.waitForTimeout(600);
 const before=await pg.evaluate(()=>localStorage.getItem('gaongreen_demo_v1:table:epr_drafts'));
 await pg.locator('#rows tr').first().locator('input').nth(1).fill('50');await pg.click('#cloudSave');await pg.waitForTimeout(500);
 const after=await pg.evaluate(()=>localStorage.getItem('gaongreen_demo_v1:table:epr_drafts'));
 await t.check('A10','EPR: when signed out, cloud save is refused and no draft row is written',async()=>({ok:before===after&&/sign|log/i.test(await pg.locator('#cloudStatus').innerText()),expected:'table unchanged + sign-in prompt',actual:`changed=${before!==after} status=${await pg.locator('#cloudStatus').innerText()}`}));
 await pg.context().close();
 // ---- Company Settings
 pg=await open('GaonGreen_Company_Settings_Cloud_Beta.html');
 await pg.fill('#company','Settings Test Co (fictional)');await pg.fill('#country','KR');await pg.fill('#industry','Packaging');await pg.selectOption('#currency',{index:1});
 await pg.click('#add');await pg.waitForTimeout(200);const inp=pg.locator('#entries tr').first().locator('input');await inp.nth(0).fill('Fictional expense');await inp.nth(1).fill('1500');
 await pg.click('#save');await pg.waitForTimeout(300);
 const cur=await pg.inputValue('#currency');
 await t.check('S1','Settings: adding an expense creates one row with the entered values',async()=>({ok:(await pg.locator('#entries tr').count())===1&&(await inp.nth(1).inputValue())==='1500',expected:'1 row, amount 1500',actual:`${await pg.locator('#entries tr').count()} rows`}));
 let exported='';try{const [dl]=await Promise.all([pg.waitForEvent('download',{timeout:5000}),pg.click('#export')]);exported=fs.readFileSync(await dl.path(),'utf8')}catch(e){exported='ERR '+e.message.slice(0,50)}
 let j={};try{j=JSON.parse(exported)}catch(e){}
 await t.check('S2','Settings: JSON export is valid and carries company, currency and expense',async()=>({ok:j.company==='Settings Test Co (fictional)'&&j.currency===cur&&Array.isArray(j.entries)&&j.entries.length===1&&String(j.entries[0].amount)==='1500',expected:'company/currency/entries[1]',actual:exported.slice(0,140)}));
 await pg.click('#clear');await pg.waitForTimeout(300);
 await t.check('S3','Settings: clear empties company and expenses',async()=>({ok:(await pg.inputValue('#company'))===''&&(await pg.locator('#entries tr').count())===0,expected:'empty',actual:await pg.inputValue('#company')}));
 fs.writeFileSync('/tmp/claude-0/settings-export.json',exported);await pg.setInputFiles('#file','/tmp/claude-0/settings-export.json');await pg.click('#import');await pg.waitForTimeout(500);
 await t.check('S4','Settings: JSON import of the exported file restores everything (round trip)',async()=>({ok:(await pg.inputValue('#company'))==='Settings Test Co (fictional)'&&(await pg.inputValue('#currency'))===cur&&(await pg.locator('#entries tr').count())===1,expected:'restored',actual:`${await pg.inputValue('#company')}|${await pg.inputValue('#currency')}|${await pg.locator('#entries tr').count()}`}));
 await pg.click('#cloudSave');await pg.waitForTimeout(600);await pg.click('#clear');await pg.waitForTimeout(300);await pg.click('#cloudLoad');await pg.waitForTimeout(700);
 await t.check('S5','Settings: cloud save, clear, cloud load restores company and expense (stand-in)',async()=>({ok:(await pg.inputValue('#company'))==='Settings Test Co (fictional)'&&(await pg.locator('#entries tr').count())===1,expected:'restored',actual:`${await pg.inputValue('#company')}|${await pg.locator('#entries tr').count()}`}));
 await pg.setInputFiles('#file',{name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{not json')});await pg.click('#import');await pg.waitForTimeout(400);
 await t.check('S6','Settings: importing a malformed file does not erase current data',async()=>({ok:(await pg.inputValue('#company'))==='Settings Test Co (fictional)',expected:'unchanged',actual:await pg.inputValue('#company')}));
 await pg.context().close();await s.close();
 fs.writeFileSync(process.argv[2]||'func-auth-settings.json',JSON.stringify({run:new Date().toISOString(),build:'demo (offline stand-in; NOT real Supabase)',results:t.res},null,1));
 process.exit(t.res.some(r=>r.status!=='PASS')?1:0)})();
