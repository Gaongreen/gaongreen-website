// K-ISSB Wizard functional checks on the OFFLINE DEMO build (page logic vs stand-in backend; not real Supabase).
// Inputs: 100 employees, revenue 5000 KRW m, 1,000,000 kWh electricity (250,000 renewable), 500 GJ fuel, Scope1 120, Scope2 300 tCO2e.
// Hand calc: S1+S2=420; per revenue 420/5000=0.084->0.08; per employee 4.2; energy=1,000,000 kWh*0.0036 GJ/kWh=3,600 + 500 = 4,100 GJ; /5000=0.82; renewable share 25%.
const S=require('./lib/serve.js'),T=require('./lib/t.js'),fs=require('fs');
(async()=>{const s=await S.start('demo'),t=T.make();
 const pg=await s.page();pg.on('dialog',d=>d.accept());await pg.goto(s.base+'GaonGreen_KISSB_Cloud_Beta.html');await pg.waitForTimeout(600);
 const next=async n=>{for(let i=0;i<n;i++)await pg.click('#ggV3Next')},prev=async n=>{for(let i=0;i<n;i++)await pg.click('#ggV3Prev')};
 await pg.fill('#name','Example Exporter Co.');await pg.selectOption('#industry',{index:1});await pg.fill('#year','2025');await pg.fill('#emp','100');await pg.fill('#rev','5000');await next(1);
 for(const [id,v] of Object.entries({elec:'1000000',renew:'250000',fuel:'500',s1:'120',s2:'300'}))await pg.fill('#'+id,v);
 await pg.click('#ggSave');await pg.waitForTimeout(300);await next(3);await pg.getByRole('button',{name:/Build my dashboard/}).click();await pg.waitForTimeout(700);
 const row=async label=>{const r=pg.locator('table tr',{hasText:label}).first();return (await r.locator('td').nth(1).innerText()).trim()};
 await t.check('F-I1','K-ISSB total Scope 1+2 = 420 tCO2e',async()=>t.eq(await row('Total Scope 1 + 2 emissions'),'420'));
 await t.check('F-I2','K-ISSB emissions per employee = 4.2',async()=>t.eq(await row('GHG emissions per employee'),'4.2'));
 await t.check('F-I3','K-ISSB GHG intensity per revenue = 0.08 (0.084 rounded)',async()=>t.eq(await row('GHG intensity per revenue'),'0.08'));
 await t.check('F-I4','K-ISSB total energy = 4,100 GJ',async()=>t.eq(await row('Total energy'),'4,100'));
 await t.check('F-I5','K-ISSB energy intensity = 0.82 GJ/KRW m',async()=>t.eq(await row('Energy intensity per revenue'),'0.82'));
 await t.check('F-I6','K-ISSB renewable share = 25%',async()=>t.eq(await row('Renewable electricity share'),'25'));
 await t.check('F-I7','K-ISSB unfilled water/waste indicators show Missing (not 0)',async()=>t.eq(await row('Water intensity per revenue'),'Missing'));
 // validation: renewable > total electricity
 await prev(3);await pg.fill('#renew','2000000');await next(3);await pg.getByRole('button',{name:/Build my dashboard/}).click();await pg.waitForTimeout(400);
 await t.check('F-I8','K-ISSB rejects renewable electricity > total electricity',async()=>({ok:/cannot exceed/i.test(await pg.locator('#validation').innerText()),expected:'cannot exceed message',actual:await pg.locator('#validation').innerText()}));
 await prev(3);await pg.fill('#renew','250000');
 // local save then load after changing a field
 await prev(1);await pg.fill('#name','Changed Name');await pg.click('#ggLoad');await pg.waitForTimeout(500);
 await t.check('F-I9','K-ISSB local "Resume saved" restores the saved company name',async()=>t.eq(await pg.inputValue('#name'),'Example Exporter Co.'));
 // cloud round trip
 await pg.fill('#name','Cloud Co (fictional)');await pg.click('#ggCloudSave');await pg.waitForTimeout(600);await pg.fill('#name','x');await pg.click('#ggCloudLoad');await pg.waitForTimeout(700);
 await t.check('F-I10','K-ISSB cloud save then load restores the company name',async()=>t.eq(await pg.inputValue('#name'),'Cloud Co (fictional)'));
 // language / direction
 await pg.selectOption('#language','ar');await pg.waitForTimeout(400);
 const dir=await pg.evaluate(()=>({h:document.documentElement.dir,b:document.body.dir,lang:document.documentElement.lang}));
 await t.check('F-I11','K-ISSB Arabic switches the page to right-to-left',async()=>({ok:dir.h==='rtl'||dir.b==='rtl',expected:'rtl',actual:JSON.stringify(dir)}));
 await pg.selectOption('#language','ko');await pg.waitForTimeout(300);
 await t.check('F-I12','K-ISSB Korean renders Hangul in the page title',async()=>({ok:/[가-힣]/.test(await pg.locator('#title').innerText()),expected:'Hangul',actual:await pg.locator('#title').innerText()}));
 await pg.context().close();await s.close();
 fs.writeFileSync(process.argv[2]||'func-kissb.json',JSON.stringify({run:new Date().toISOString(),build:'demo (offline stand-in; page-logic only)',results:t.res},null,1));
 process.exit(t.res.some(r=>r.status!=='PASS')?1:0)})();
