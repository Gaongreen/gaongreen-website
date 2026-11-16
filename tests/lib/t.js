// Tiny test recorder: each check = {id,name,status,expected,actual}. Results written to JSON for evidence.
exports.make=()=>{const res=[];return{res,
 async check(id,name,fn){try{const r=await fn();const ok=r.ok!==undefined?r.ok:r.actual===r.expected;res.push({id,name,status:ok?'PASS':'FAIL',expected:r.expected,actual:r.actual});console.log((ok?'PASS ':'FAIL ')+id+' '+name+(ok?'':`  expected=${JSON.stringify(r.expected)} actual=${JSON.stringify(r.actual)}`))}catch(e){res.push({id,name,status:'ERROR',error:String(e.message).slice(0,200)});console.log('ERR  '+id+' '+name+'  '+String(e.message).slice(0,160))}},
 eq:(a,e)=>({actual:a,expected:e})}};
