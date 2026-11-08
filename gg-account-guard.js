/* GaonGreen account guard — keeps browser-local tool data from crossing accounts.
   ROOT CAUSE it fixes: the tools keep working copies in localStorage under fixed, account-less keys (e.g. gaongreen-company-settings-v1).
   Signing out and signing in as someone else on the same browser left those keys in place, so the next account saw the previous account's data.
   MODEL (no data is ever moved or deleted, so there is nothing to race between tabs): for the product keys below, every read/write/remove is redirected to "<key>::<owner>",
   where <owner> is the signed-in user id (read synchronously from the SDK's persisted session, key sb-*-auth-token) or "anon" when nobody is signed in.
   Pages keep calling localStorage with the plain key; they simply get their own account's copy. IndexedDB databases get the same treatment (see IDB_NAMES). Data that predates this guard (the raw, unsuffixed key / database name) is visible to "anon" only and is
   superseded the first time anon writes. A page loaded as one identity while the browser session has become another (stale tab) reads null, its writes are dropped, and it reloads itself.
   Loaded synchronously in <head> before the page scripts. Plain ES5. No network. Opt out of auto-reload with <html data-gg-guard="no-reload"> (Login/Register). */
(function(){'use strict';
var KEYS=['gaongreen-company-settings-v1','gaongreen-epr-scorecard-v1','gaongreen-kre100-helper-v1','gaongreen-kissb-draft-v1','gaongreen-evidence-v1','gaongreen-qr-esg-card-v1','gaongreen-supplier-scan-v1','gaongreen-supplier-draft-v1','gaongreen-evidence-form-v1'];
var IDB_NAMES=['gaongreen-epr-backup-v1','gaongreen-evidence-locker-v1'];   /* IndexedDB databases (EPR local backup, local Evidence Locker documents): same redirect, signed-in users get "<name>::<user id>", anon keeps the original name */
var TOKEN=/^sb-[A-Za-z0-9_-]+-auth-token$/,ID=/^[A-Za-z0-9-]{8,64}$/;
var L=null;try{L=window.localStorage;L.getItem('x')}catch(e){L=null}
if(!L||!window.Storage)return;
var SP=Storage.prototype,rawGet=SP.getItem,rawSet=SP.setItem,rawRemove=SP.removeItem;
var G=window.ggAccountGuard={KEYS:KEYS.slice(),loadedAs:null,reloadRequested:false};
function isKey(k){return KEYS.indexOf(k)>=0}
var SS=null;try{SS=window.sessionStorage;SS.getItem('x')}catch(e){SS=null}   /* the auth session lives in sessionStorage (session-only sign-in, see gg-auth-config.js); localStorage tokens are never trusted */
function sessionUser(){try{if(!SS)return null;for(var i=0;i<SS.length;i++){var k=SS.key(i);if(TOKEN.test(k)){var s=JSON.parse(rawGet.call(SS,k));var id=s&&((s.user&&s.user.id)||(s.currentSession&&s.currentSession.user&&s.currentSession.user.id));if(typeof id==='string'&&ID.test(id))return id}}}catch(e){}return null}
function nsKey(k,u){return k+'::'+(u||'anon')}
function wantsReload(){var h=document.documentElement;return !(h&&h.getAttribute('data-gg-guard')==='no-reload')}
function requestReload(){if(G.reloadRequested||document.readyState==='loading'||!wantsReload())return;G.reloadRequested=true;var ev=null;try{ev=new CustomEvent('gg-account-changed',{cancelable:true,detail:{from:G.loadedAs,to:sessionUser()}})}catch(e){}var go=ev?window.dispatchEvent(ev):true;if(go)setTimeout(function(){try{location.reload()}catch(e){}},50)}
function check(){if(sessionUser()!==G.loadedAs){requestReload();return true}return false}
G.loadedAs=sessionUser();
G.IDB_NAMES=IDB_NAMES.slice();
var F=window.IDBFactory&&IDBFactory.prototype;
if(F){var rawOpen=F.open,rawDelete=F.deleteDatabase;
 function idbName(n){var u=sessionUser();if(u!==G.loadedAs){requestReload();return n+'::stale-discard'}return u?n+'::'+u:n}
 F.open=function(n){if(IDB_NAMES.indexOf(n)>=0){var a=Array.prototype.slice.call(arguments);a[0]=idbName(n);return rawOpen.apply(this,a)}return rawOpen.apply(this,arguments)};
 F.deleteDatabase=function(n){if(IDB_NAMES.indexOf(n)>=0){var a=Array.prototype.slice.call(arguments);a[0]=idbName(n);return rawDelete.apply(this,a)}return rawDelete.apply(this,arguments)};}
SP.getItem=function(k){
 if(this===L&&isKey(k)){var u=sessionUser();if(u!==G.loadedAs){requestReload();return null}var v=rawGet.call(L,nsKey(k,u));if(v===null&&u===null)v=rawGet.call(L,k);return v}
 return rawGet.apply(this,arguments)};
SP.setItem=function(k,v){
 if(this===L){
  if(isKey(k)){var u=sessionUser();if(u!==G.loadedAs){requestReload();return}rawSet.call(L,nsKey(k,u),String(v));if(u===null&&rawGet.call(L,k)!==null)rawRemove.call(L,k);return}
  var r=rawSet.apply(this,arguments);if(TOKEN.test(k))setTimeout(check,0);return r}
 return rawSet.apply(this,arguments)};
SP.removeItem=function(k){
 if(this===L){
  if(isKey(k)){var u=sessionUser();if(u!==G.loadedAs){requestReload();return}rawRemove.call(L,nsKey(k,u));if(u===null)rawRemove.call(L,k);return}
  var r=rawRemove.apply(this,arguments);if(TOKEN.test(k))setTimeout(check,0);return r}
 return rawRemove.apply(this,arguments)};
window.addEventListener('focus',check);
window.addEventListener('pageshow',function(e){if(e.persisted)check()});
document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')check()});
G.sessionUser=sessionUser;G.nsKey=nsKey;G.check=check;
})();
