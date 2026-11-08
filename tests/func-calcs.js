// Functional checks for K-RE100 and EPR on the OFFLINE DEMO build. Expected values are hand-computed (see comments).
const S=require('./lib/serve.js'),T=require('./lib/t.js'),fs=require('fs');
(async()=>{const s=await S.start('demo'),t=T.make();
 // --- K-RE100: total=1200 MWh, target=100% => 1200 MWh needed; PPA 300 + REC 200 => 500 MWh; share=500/1200=41.67%; gap=1200-500=700; +400 additional => (900/1200)=75%
 let pg=await s.page();await pg.goto(s.base+'GaonGreen_K-RE100_Cloud_Beta.html');await pg.waitForTimeout(600);
 await pg.fill('#total','1200');await pg.fill('#target','100');await pg.fill('#m_ppa','300');await pg.fill('#m_rec','200');await pg.fill('#additional','400');await pg.waitForTimeout(200);
 const g=id=>pg.locator('#'+id).innerText();
 await t.check('F-K1','K-RE100 total renewable MWh = 500',async()=>t.eq(await g('sum'),'500'));
 await t.check('F-K2','K-RE100 share = 41.67%',async()=>t.eq(await g('share'),'41.67%'));
 await t.check('F-K3','K-RE100 gap to target = 700',async()=>t.eq(await g('gap'),'700'));
 await t.check('F-K4','K-RE100 projected share with +400 = 75%',async()=>t.eq(await g('projected'),'75%'));
 await pg.fill('#m_ppa','-5');await pg.waitForTimeout(200);
 await t.check('F-K5','K-RE100 negative MWh is rejected (sum shows em dash)',async()=>t.eq(await g('sum'),'—'));
 await pg.context().close();
 // --- EPR: row1 50 g x 1000 units = 50 kg (20% recycled = 10 kg); row2 20 g x 500 units = 10 kg paper. total 60 kg = 0.06 t.
 // scenario default: reduction 10% => 60*0.9=54 kg; savings 6 kg; change -10%. With quantity +20%: 60*0.9*1.2=64.8 kg; savings -4.8; change +8%.
 pg=await s.page();await pg.goto(s.base+'GaonGreen_EPR_Cloud_Beta.html');await pg.waitForTimeout(600);
 const row=(i,k)=>pg.locator('#rows tr').nth(i).locator('input').nth(k);
 await row(0,0).fill('Fictional box');await row(0,1).fill('50');await row(0,2).fill('1000');await row(0,3).fill('20');
 await pg.click('#addRow');await row(1,0).fill('Fictional wrap');await row(1,1).fill('20');await row(1,2).fill('500');await row(1,3).fill('0');
 await pg.locator('#rows tr').nth(1).locator('select').selectOption('paper').catch(()=>{});await pg.waitForTimeout(200);
 await t.check('F-E1','EPR total packaging = 60 kg',async()=>t.eq(await g('totalKg'),'60'));
 await t.check('F-E2','EPR total = 0.06 t',async()=>t.eq(await g('totalT'),'0.06'));
 await t.check('F-E3','EPR recycled content = 10 kg',async()=>t.eq(await g('recycledKg'),'10'));
 await t.check('F-E4','EPR scenario (10% reduction) = 54 kg, saving 6 kg, -10%',async()=>t.eq([await g('scenarioKg'),await g('savingsKg'),await g('changePct')].join('|'),'54|6|-10%'));
 await pg.fill('#newQuantity','20');await pg.waitForTimeout(200);
 await t.check('F-E5','EPR scenario with +20% units = 64.8 kg, +8%',async()=>t.eq([await g('scenarioKg'),await g('changePct')].join('|'),'64.8|8%'));
 await row(0,3).fill('150');await pg.waitForTimeout(200);
 await t.check('F-E6','EPR recycled >100% is flagged invalid',async()=>({ok:/invalid|check|valid/i.test(await g('validation')),expected:'validation message',actual:await g('validation')}));
 await pg.context().close();
 await s.close();fs.writeFileSync(process.argv[2]||'func-calcs.json',JSON.stringify({run:new Date().toISOString(),build:'demo (offline stand-in; page-logic only)',results:t.res},null,1));
 process.exit(t.res.some(r=>r.status!=='PASS')?1:0)})();
