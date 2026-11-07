/* GaonGreen inactivity timeout (see docs/SESSION_DESIGN.md). 30 minutes idle -> signed out; warning at 28 minutes.
   Idle time is measured from a timestamp kept in sessionStorage (gg-last-activity), compared with Date.now(), so throttled background timers cannot extend a session and a restored tab is judged by its real age.
   Before any automatic sign-out the page is asked to save pending local edits: window event 'gg-flush' (detail.lost = names of things that cannot be saved, shown to the user). Nothing is discarded silently.
   Client-side only: Supabase Free has no server-side inactivity timeout; a stolen token is not stopped by this timer. */
(function(){'use strict';
if(window.ggIdle)return;
var IDLE=30*60000,WARN=28*60000,STAMP='gg-last-activity',REVOKE='gg-revoke',TOKEN=/^sb-[A-Za-z0-9_-]+-auth-token$/;
var SS=null;try{SS=window.sessionStorage;SS.getItem('x')}catch(e){return}
var G=window.ggIdle={IDLE:IDLE,WARN:WARN,signingOut:false};
var T={en:{warn:'You will be signed out soon because of inactivity. Your work on this device is being saved.',left:'Time left:',stay:'Stay signed in',out:'Sign out now',lost:'Not saved automatically (will be discarded): '},
 ko:{warn:'비활동으로 곧 로그아웃됩니다. 이 기기의 작업 내용은 저장되고 있습니다.',left:'남은 시간:',stay:'로그인 유지',out:'지금 로그아웃',lost:'자동 저장되지 않음(삭제됨): '},
 ar:{warn:'سيتم تسجيل خروجك قريبًا بسبب عدم النشاط. يتم حفظ عملك على هذا الجهاز.',left:'الوقت المتبقي:',stay:'ابقَ مسجلاً',out:'تسجيل الخروج الآن',lost:'لا يُحفظ تلقائيًا (سيُحذف): '}};
function lang(){var l=(document.documentElement.lang||'en').slice(0,2);return T[l]?l:'en'}
function tokenKeys(){var r=[];try{for(var i=0;i<SS.length;i++){var k=SS.key(i);if(TOKEN.test(k))r.push(k)}}catch(e){}return r}
function has(){return tokenKeys().length>0}
var lastWrite=0;
G.stamp=function(force){var n=Date.now();if(!force&&n-lastWrite<5000)return;lastWrite=n;try{SS.setItem(STAMP,String(n))}catch(e){}};
function last(){var v=Number(SS.getItem(STAMP));return v>0?v:null}
/* A genuine sign-in starts the clock only when no clock exists. The SDK also re-emits SIGNED_IN when a tab regains focus; that must never count as user activity. */
G.stampIfNone=function(){if(last()===null)G.stamp(true)};
G.clearStamp=function(){try{SS.removeItem(STAMP)}catch(e){}lastWrite=0};
function onAuthPage(){return /GaonGreen_(Login|Register)\.html/.test(location.pathname)}
function loginUrl(reason,lost){var p=location.pathname,base=p.slice(0,p.lastIndexOf('/')+1);return base+'GaonGreen_Login.html?reason='+encodeURIComponent(reason)+(lost&&lost.length?'&lost='+encodeURIComponent(lost.join(', ').slice(0,200)):'')}
function flush(){var lost=[];try{window.dispatchEvent(new CustomEvent('gg-flush',{detail:{lost:lost}}))}catch(e){}return lost}
function removeToken(){tokenKeys().forEach(function(k){try{SS.removeItem(k)}catch(e){}});try{SS.removeItem(STAMP)}catch(e){}}
function leave(reason,lost){try{location.replace(loginUrl(reason,lost))}catch(e){}}
/* Session ended elsewhere (revoked, refresh token expired): the SDK already removed the session. Save local edits, then go to Login. */
G.endedElsewhere=function(){if(G.signingOut||onAuthPage())return;G.signingOut=true;var lost=flush();try{SS.removeItem(STAMP)}catch(e){}leave('ended',lost)};
function banner(lostList,secs){var b=document.getElementById('gg-idle-banner'),t=T[lang()];
 if(!b){b=document.createElement('div');b.id='gg-idle-banner';b.setAttribute('role','alertdialog');b.setAttribute('aria-live','assertive');b.setAttribute('aria-label',t.warn);
  b.style.cssText='position:fixed;left:16px;right:16px;bottom:16px;z-index:2147483000;background:#fff;color:#111;border:2px solid #b45309;border-radius:10px;padding:14px;box-shadow:0 6px 24px rgba(0,0,0,.3);font:16px/1.4 system-ui,sans-serif;max-width:560px;margin:0 auto';
  var m=document.createElement('div');m.id='gg-idle-msg';var l=document.createElement('div');l.id='gg-idle-lost';l.style.cssText='margin-top:6px;font-weight:600';var r=document.createElement('div');r.style.cssText='margin-top:10px;display:flex;gap:10px;flex-wrap:wrap';
  var s=document.createElement('button');s.id='gg-idle-stay';s.type='button';s.style.cssText='padding:10px 16px;font-size:16px;min-height:44px';s.onclick=function(){G.stamp(true);check()};
  var o=document.createElement('button');o.id='gg-idle-out';o.type='button';o.style.cssText='padding:10px 16px;font-size:16px;min-height:44px';o.onclick=function(){end('manual')};
  r.appendChild(s);r.appendChild(o);b.appendChild(m);b.appendChild(l);b.appendChild(r);(document.body||document.documentElement).appendChild(b)}
 b.dir=lang()==='ar'?'rtl':'ltr';b.querySelector('#gg-idle-msg').textContent=t.warn+' '+t.left+' '+Math.floor(secs/60)+':'+('0'+(secs%60)).slice(-2);
 b.querySelector('#gg-idle-lost').textContent=lostList.length?t.lost+lostList.join(', '):'';b.querySelector('#gg-idle-stay').textContent=t.stay;b.querySelector('#gg-idle-out').textContent=t.out}
function hide(){var b=document.getElementById('gg-idle-banner');if(b&&b.parentNode)b.parentNode.removeChild(b)}
/* Automatic or manual sign-out while the page is running. */
function end(reason){if(G.signingOut)return;G.signingOut=true;var lost=flush();var cl=window.ggClients||[],ps=[];
 cl.forEach(function(c){try{ps.push(Promise.resolve(c.auth.signOut({scope:'local'})).catch(function(){}))}catch(e){}});
 var rec=null;if(!cl.length){var k=tokenKeys()[0];if(k)try{rec=SS.getItem(k)}catch(e){}}
 var done=function(){if(rec){try{SS.setItem(REVOKE,rec)}catch(e){}}removeToken();leave(reason,lost)};
 var timer=setTimeout(done,5000);Promise.all(ps).then(function(){clearTimeout(timer);done()},function(){clearTimeout(timer);done()})}
G.end=end;
/* The SDK keeps a dead session in storage when its refresh token was revoked/expired (it does not emit SIGNED_OUT). An ACTIVE session is refreshed long before it expires, so a token that has been expired for 2+ minutes means refreshing has failed: end the session cleanly. */
function expiredSession(){try{var k=tokenKeys()[0];if(!k)return false;var j=JSON.parse(SS.getItem(k));var e=j&&(j.expires_at||(j.currentSession&&j.currentSession.expires_at));return typeof e==='number'&&Date.now()/1000>e+120}catch(x){return false}}
function endExpired(){if(G.signingOut)return;G.signingOut=true;var lost=flush();removeToken();leave('ended',lost)}
function check(){if(G.signingOut)return;if(!has()){hide();return}
 var l=last(),n=Date.now();if(l===null){end('idle');return}if(l>n){G.stamp(true);return}
 var idle=n-l;if(idle>=IDLE){end('idle');return}
 if(expiredSession()){endExpired();return}
 if(idle>=WARN){var lost=[];try{var ev=new CustomEvent('gg-probe',{detail:{lost:lost}});window.dispatchEvent(ev)}catch(e){}banner(lost,Math.max(0,Math.ceil((IDLE-idle)/1000)))}else hide()}
G.check=check;
/* Earliest possible check (this script runs in <head>, before page scripts): a tab restored by the browser, or with an unknown age, must not make a single data call. */
(function(){if(!has())return;var l=last(),n=Date.now();
 if(l===null||(n-l)>=IDLE){var k=tokenKeys()[0],rec=null;try{rec=SS.getItem(k)}catch(e){}if(rec){try{SS.setItem(REVOKE,rec)}catch(e){}}removeToken();if(!onAuthPage()){G.signingOut=true;leave('idle')}}})();
['pointerdown','keydown','touchstart','wheel','input','scroll'].forEach(function(ev){window.addEventListener(ev,function(e){if(e.isTrusted&&!G.signingOut&&has())G.stamp(false)},{capture:true,passive:true})});
window.addEventListener('focus',check);window.addEventListener('pageshow',check);document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')check()});
setInterval(check,30000);
})();
