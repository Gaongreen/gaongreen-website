/* GaonGreen shared navigation strip + sign-out link. Same-origin script (CSP script-src 'self'); no inline handlers, no eval, no network access.
   Sign-out is delegated to the Login page (?action=signout), which owns the Supabase client, so no second auth client is created here. */
(function(){
  'use strict';
  if(document.querySelector('nav.gg-nav'))return;
  var L={
    en:{label:'GaonGreen navigation',home:'Home',dash:'Dashboard',kissb:'K-ISSB',re100:'K-RE100',epr:'EPR',sup:'Supplier ESG',qr:'QR Card',ev:'Evidence Locker',set:'Settings',out:'Sign out'},
    ko:{label:'가온그린 내비게이션',home:'홈',dash:'대시보드',kissb:'K-ISSB',re100:'K-RE100',epr:'EPR',sup:'공급사 ESG',qr:'QR 카드',ev:'증빙 보관함',set:'설정',out:'로그아웃'},
    ar:{label:'التنقل في GaonGreen',home:'الرئيسية',dash:'لوحة المتابعة',kissb:'K-ISSB',re100:'K-RE100',epr:'EPR',sup:'تقييم الموردين',qr:'بطاقة QR',ev:'خزنة الأدلة',set:'الإعدادات',out:'تسجيل الخروج'}
  };
  var ITEMS=[['home','./index.html'],['dash','./GaonGreen_ESG_Dashboard_Cloud_Beta.html'],['kissb','./GaonGreen_KISSB_Cloud_Beta.html'],['re100','./GaonGreen_K-RE100_Cloud_Beta.html'],['epr','./GaonGreen_EPR_Cloud_Beta.html'],['sup','./GaonGreen_Supplier_ESG_Scan_Cloud_Beta.html'],['qr','./GaonGreen_QR_ESG_Card_Cloud_Beta.html'],['ev','./GaonGreen_Evidence_Locker_Cloud_Beta.html'],['set','./GaonGreen_Company_Settings_Cloud_Beta.html']];
  var SIGNOUT='./GaonGreen_Login.html?action=signout';
  function lang(){var l=(document.documentElement.getAttribute('lang')||'en').toLowerCase().slice(0,2);return L[l]?l:'en';}
  function here(href){var f=href.replace('./','');try{return decodeURIComponent(location.pathname).split('/').pop()===f||(f==='index.html'&&/\/$/.test(location.pathname));}catch(e){return false;}}
  var nav=document.createElement('nav');nav.className='gg-nav';
  var links=ITEMS.map(function(it){var a=document.createElement('a');a.href=it[1];a.setAttribute('data-gg',it[0]);if(here(it[1]))a.setAttribute('aria-current','page');nav.appendChild(a);return a;});
  var out=document.createElement('a');out.href=SIGNOUT;out.className='gg-nav-out';out.setAttribute('data-gg','out');nav.appendChild(out);
  function label(){var l=lang(),t=L[l];nav.setAttribute('aria-label',t.label);nav.setAttribute('dir',l==='ar'?'rtl':'ltr');links.concat([out]).forEach(function(a){a.textContent=t[a.getAttribute('data-gg')];});}
  label();
  function mount(){if(document.body&&!nav.parentNode)document.body.insertBefore(nav,document.body.firstChild);}
  if(document.body)mount();else document.addEventListener('DOMContentLoaded',mount);
  try{new MutationObserver(label).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});}catch(e){}
})();
