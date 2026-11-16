const S=require('../tests/lib/serve.js');
(async()=>{const s=await S.start('demo');
 for(const f of process.argv.slice(2)){const pg=await s.page();await pg.goto(s.base+encodeURIComponent(f));await pg.waitForTimeout(800);
  const info=await pg.evaluate(()=>{const lab=e=>{const l=e.id&&document.querySelector('label[for="'+e.id+'"]');return (l?l.textContent:(e.closest('label')?.textContent||e.getAttribute('aria-label')||e.placeholder||'')).trim().replace(/\s+/g,' ').slice(0,34)};
   return{inputs:[...document.querySelectorAll('input,select,textarea')].slice(0,40).map(e=>`${e.id||e.name||'?'}[${e.tagName[0]}${e.tagName==='INPUT'?':'+e.type:''}]«${lab(e)}»`),
    buttons:[...document.querySelectorAll('button')].map(b=>`${b.id||'?'}:${b.textContent.trim().slice(0,20)}`),
    outputs:[...document.querySelectorAll('[id]')].filter(e=>!/^(INPUT|SELECT|TEXTAREA|BUTTON|SCRIPT|STYLE|META|LINK|HEAD|BODY|HTML)$/.test(e.tagName)&&e.children.length<4&&e.textContent.trim().length&&e.textContent.trim().length<44).slice(0,24).map(e=>e.id+'='+e.textContent.trim().replace(/\s+/g,' ').slice(0,28))}});
  console.log('\n=== '+f);console.log('INPUTS:',info.inputs.join(' | '));console.log('BUTTONS:',info.buttons.join(' | '));console.log('OUT:',info.outputs.join(' | '));await pg.context().close()}
 await s.close()})();
