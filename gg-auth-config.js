/* GaonGreen session-only sign-in (see docs/SESSION_DESIGN.md). Load BEFORE any page script that creates a Supabase client.
   - ggAuth(opts): auth options with storage = sessionStorage (the session is per tab, discarded when the tab/window closes, never written to disk by the SDK).
   - ggCreateClient(createClient, url, key, opts): the ONLY way pages create a client. Forces the storage, registers the client (so gg-idle.js can sign it out with scope 'local'),
     stamps activity on sign-in, and reports a session that ended elsewhere (revoked / expired refresh token) so the tab can flush local edits and go to Login.
   - One-time migration: persistent tokens left in localStorage by earlier versions are deleted (their holders sign in once more). */
(function(){'use strict';
if(window.ggAuth)return;
var TOKEN=/^sb-[A-Za-z0-9_-]+-auth-token$/;
try{var L=window.localStorage,del=[];for(var i=0;i<L.length;i++){var k=L.key(i);if(TOKEN.test(k))del.push(k)}del.forEach(function(k){L.removeItem(k)})}catch(e){}
var SS=null;try{SS=window.sessionStorage;SS.getItem('x')}catch(e){SS=null}
window.ggClients=[];
function has(){try{for(var i=0;i<SS.length;i++)if(TOKEN.test(SS.key(i)))return true}catch(e){}return false}
var hadSession=SS?has():false;
function changed(){window.dispatchEvent(new Event('gg-auth-state'))}
/* Back/forward cache: a restored page keeps its old DOM and scripts. If the sign-in state differs from when it loaded, reload so it never shows a previous account's information. */
window.addEventListener('pageshow',function(e){if(e.persisted&&SS&&has()!==hadSession)location.reload()});
window.ggAuth=function(o){var a={persistSession:true,autoRefreshToken:true};if(o)for(var k in o)a[k]=o[k];a.storage=SS||undefined;if(!SS)a.persistSession=false;return a};
window.ggCreateClient=function(create,url,key,opts){var o={};if(opts)for(var k in opts)o[k]=opts[k];o.auth=window.ggAuth(o.auth);var c=create(url,key,o);window.ggClients.push(c);
 try{c.auth.onAuthStateChange(function(ev,session){
  if(ev==='SIGNED_IN'||ev==='SIGNED_OUT'){changed()}
  if(!window.ggIdle)return;
  if(ev==='SIGNED_IN'&&session)window.ggIdle.stampIfNone();
  if(ev==='SIGNED_OUT'){window.ggIdle.clearStamp();if(!window.ggIdle.signingOut)setTimeout(function(){window.ggIdle.endedElsewhere()},0)}})}catch(e){}
 return c};
})();
