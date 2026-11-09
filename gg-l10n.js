/* GaonGreen shared Korean/Arabic strings for text that the individual pages did not translate (cloud panels, a few buttons, placeholders, status lines).
   Elements opt in with data-l10n="key" (text) or data-l10n-ph="key" (placeholder); scripts call ggTr(key, englishFallback) for runtime messages.
   Follows <html lang>; re-applies when the page changes it. Loaded synchronously in <head> so ggTr exists before page scripts run. No network, no storage. */
(function(){
var D={
 signedIn:{en:'Signed in: ',ko:'로그인: ',ar:'تم تسجيل الدخول: '},
 cloudError:{en:'Cloud error: ',ko:'클라우드 오류: ',ar:'خطأ سحابي: '},
 signinLogin:{en:'Sign in / Login',ko:'로그인',ar:'تسجيل الدخول'},
 energyTools:{en:'/ Energy Tools',ko:'/ 에너지 도구',ar:'/ أدوات الطاقة'},
 saveProgress:{en:'Save Progress',ko:'진행 상황 저장',ar:'حفظ التقدم'},
 testStorage:{en:'Test Browser Storage',ko:'브라우저 저장소 테스트',ar:'اختبار تخزين المتصفح'},
 cs_notSigned:{en:'Not signed in. Please log in first.',ko:'로그인되어 있지 않습니다. 먼저 로그인하세요.',ar:'لم يتم تسجيل الدخول. يرجى تسجيل الدخول أولاً.'},
 ev_cloudTitle:{en:'5. Cloud Evidence Locker',ko:'5. 클라우드 증빙자료',ar:'5. خزانة الأدلة السحابية'},
 ev_company_ph:{en:'Company name',ko:'회사명',ar:'اسم الشركة'},
 ev_title_ph:{en:'Electricity bill — January',ko:'전기요금 고지서 — 1월',ar:'فاتورة الكهرباء — يناير'},
 ev_notes_ph:{en:'e.g. Meter ID, source, approval details',ko:'예: 계량기 번호, 출처, 승인 내역',ar:'مثال: رقم العداد، المصدر، تفاصيل الموافقة'},
 re_notes_ph:{en:'Next steps...',ko:'다음 단계...',ar:'الخطوات التالية...'},
 sector_ph:{en:'Manufacturing',ko:'제조업',ar:'التصنيع'},
 sup_cloudTitle:{en:'5. Cloud backup',ko:'5. 클라우드 백업',ar:'5. النسخ الاحتياطي السحابي'},
 sup_desc:{en:"Sign in first. Save or restore your current draft and all locally saved supplier assessments. Cloud loading replaces this browser's supplier collection after confirmation. Use fictional data while testing.",ko:'먼저 로그인하세요. 현재 초안과 이 브라우저에 저장된 모든 공급업체 평가를 클라우드에 저장하거나 복원할 수 있습니다. 클라우드에서 불러오면 확인 후 이 브라우저의 공급업체 목록이 교체됩니다. 테스트에는 가상 데이터를 사용하세요.',ar:'سجّل الدخول أولاً. احفظ مسودتك الحالية وكل تقييمات الموردين المحفوظة محلياً أو استعدها. يؤدي التحميل من السحابة إلى استبدال قائمة الموردين في هذا المتصفح بعد التأكيد. استخدم بيانات وهمية أثناء الاختبار.'},
 sup_save:{en:'Save suppliers to cloud',ko:'공급업체를 클라우드에 저장',ar:'حفظ الموردين في السحابة'},
 sup_load:{en:'Load suppliers from cloud',ko:'클라우드에서 공급업체 불러오기',ar:'تحميل الموردين من السحابة'},
 sup_status0:{en:'Cloud status: not checked',ko:'클라우드 상태: 확인되지 않음',ar:'حالة السحابة: لم يتم الفحص'},
 sup_checking:{en:'Checking login session…',ko:'로그인 세션 확인 중…',ar:'جارٍ التحقق من جلسة تسجيل الدخول…'},
 sup_saving:{en:'Saving supplier assessments to cloud…',ko:'공급업체 평가를 클라우드에 저장하는 중…',ar:'جارٍ حفظ تقييمات الموردين في السحابة…'},
 sup_loading:{en:'Loading supplier assessments…',ko:'공급업체 평가를 불러오는 중…',ar:'جارٍ تحميل تقييمات الموردين…'},
 sup_none:{en:'No supplier cloud backup found for this account. Save suppliers to cloud first.',ko:'이 계정에 저장된 공급업체 클라우드 백업이 없습니다. 먼저 클라우드에 저장하세요.',ar:'لا توجد نسخة احتياطية سحابية للموردين لهذا الحساب. احفظ الموردين في السحابة أولاً.'},
 sup_invalid:{en:'Cloud backup format is invalid.',ko:'클라우드 백업 형식이 올바르지 않습니다.',ar:'صيغة النسخة الاحتياطية السحابية غير صالحة.'},
 sup_cancel:{en:'Cloud load cancelled.',ko:'클라우드 불러오기가 취소되었습니다.',ar:'تم إلغاء التحميل من السحابة.'},
 sup_blocked:{en:'Browser storage is blocked. Cloud backup was NOT applied; enable storage and retry.',ko:'브라우저 저장소가 차단되어 클라우드 백업이 적용되지 않았습니다. 저장소를 허용한 뒤 다시 시도하세요.',ar:'تم حظر تخزين المتصفح ولم يتم تطبيق النسخة السحابية. فعّل التخزين وأعد المحاولة.'},
 sup_restored:{en:'Cloud supplier draft and saved supplier list restored successfully.',ko:'클라우드의 공급업체 초안과 저장된 공급업체 목록을 복원했습니다.',ar:'تمت استعادة مسودة الموردين وقائمة الموردين المحفوظة من السحابة بنجاح.'},
 sup_unsaved:{en:'This assessment is not in your saved supplier list yet, or has unsaved changes. Add it to the list and save to cloud?',ko:'이 평가는 아직 저장된 공급업체 목록에 없거나 저장되지 않은 변경 사항이 있습니다. 목록에 추가한 뒤 클라우드에 저장할까요?',ar:'هذا التقييم غير موجود بعد في قائمة الموردين المحفوظة، أو فيه تغييرات غير محفوظة. هل تريد إضافته إلى القائمة ثم الحفظ في السحابة؟'},
 sup_unsaved_cancel:{en:'Cloud save cancelled. Press "Save assessment" first, then save to cloud.',ko:'클라우드 저장이 취소되었습니다. 먼저 "평가 저장"을 누른 뒤 클라우드에 저장하세요.',ar:'تم إلغاء الحفظ في السحابة. اضغط "حفظ التقييم" أولاً، ثم احفظ في السحابة.'},
 qr_cloudTitle:{en:'Cloud backup',ko:'클라우드 백업',ar:'النسخ الاحتياطي السحابي'},
 qr_desc:{en:'Sign in to save or restore your private editable draft. Public QR links remain separate snapshots. Use fictional information while testing.',ko:'로그인하여 비공개 편집 초안을 저장하거나 복원하세요. 공개 QR 링크는 별도의 스냅샷으로 유지됩니다. 테스트에는 가상 정보를 사용하세요.',ar:'سجّل الدخول لحفظ مسودتك الخاصة القابلة للتعديل أو استعادتها. تبقى روابط QR العامة لقطات منفصلة. استخدم معلومات وهمية أثناء الاختبار.'},
 qr_save:{en:'Save draft to cloud',ko:'클라우드에 초안 저장',ar:'حفظ المسودة في السحابة'},
 qr_load:{en:'Load draft from cloud',ko:'클라우드에서 초안 불러오기',ar:'تحميل المسودة من السحابة'},
 qr_checking:{en:'Checking sign-in…',ko:'로그인 확인 중…',ar:'جارٍ التحقق من تسجيل الدخول…'},
 qr_signin:{en:'Please sign in first using the Login page.',ko:'먼저 로그인 페이지에서 로그인하세요.',ar:'يرجى تسجيل الدخول أولاً عبر صفحة تسجيل الدخول.'},
 qr_company:{en:'Enter a company name before saving to cloud.',ko:'클라우드에 저장하기 전에 기업명을 입력하세요.',ar:'أدخل اسم الشركة قبل الحفظ في السحابة.'},
 qr_saved:{en:'QR ESG Card draft saved to cloud successfully.',ko:'QR ESG 카드 초안을 클라우드에 저장했습니다.',ar:'تم حفظ مسودة بطاقة QR ESG في السحابة بنجاح.'},
 qr_none:{en:'No cloud draft found for this account.',ko:'이 계정에 저장된 클라우드 초안이 없습니다.',ar:'لا توجد مسودة سحابية لهذا الحساب.'},
 qr_loaded:{en:'QR ESG Card draft loaded from cloud successfully. Generate a new public card + QR if you want to share this version.',ko:'QR ESG 카드 초안을 클라우드에서 불러왔습니다. 이 버전을 공유하려면 공개 카드와 QR을 새로 생성하세요.',ar:'تم تحميل مسودة بطاقة QR ESG من السحابة بنجاح. أنشئ بطاقة عامة ورمز QR جديدين إذا أردت مشاركة هذه النسخة.'},
 qr_cantcheck:{en:'Could not check sign-in. Please sign in and try again.',ko:'로그인 상태를 확인할 수 없습니다. 로그인한 뒤 다시 시도하세요.',ar:'تعذر التحقق من تسجيل الدخول. سجّل الدخول وحاول مجدداً.'},
 qr_signedok:{en:'Signed in. Cloud backup is available.',ko:'로그인되었습니다. 클라우드 백업을 사용할 수 있습니다.',ar:'تم تسجيل الدخول. النسخ الاحتياطي السحابي متاح.'},
 aria_lang:{en:'Language',ko:'언어',ar:'اللغة'},
 aria_sections:{en:'Assessment sections',ko:'평가 섹션',ar:'أقسام التقييم'},
 aria_saved:{en:'Saved assessments',ko:'저장된 평가',ar:'التقييمات المحفوظة'},
 aria_cloud:{en:'Cloud backup',ko:'클라우드 백업',ar:'النسخ الاحتياطي السحابي'},
 qr_company_ph:{en:'Example: Green Seoul Co.',ko:'예: 그린서울 주식회사',ar:'مثال: شركة سيول الخضراء'},
 qr_initiatives_ph:{en:"Describe your company's initiatives and targets.",ko:'기업의 지속가능성 활동과 목표를 설명하세요.',ar:'صف مبادرات شركتك وأهدافها.'}
};
function lang(){var l=(document.documentElement.getAttribute('lang')||'en').slice(0,2);return l==='ko'||l==='ar'?l:'en'}
window.ggTr=function(k,fb){var e=D[k];return e?(e[lang()]||e.en):(fb===undefined?k:fb)};
function apply(){var i,n=document.querySelectorAll('[data-l10n]'),p=document.querySelectorAll('[data-l10n-ph]'),a=document.querySelectorAll('[data-l10n-aria]');
 for(i=0;i<n.length;i++){var t=window.ggTr(n[i].getAttribute('data-l10n'));if(n[i].textContent!==t)n[i].textContent=t}
 for(i=0;i<p.length;i++)p[i].setAttribute('placeholder',window.ggTr(p[i].getAttribute('data-l10n-ph')));
 for(i=0;i<a.length;i++)a[i].setAttribute('aria-label',window.ggTr(a[i].getAttribute('data-l10n-aria')))}
window.ggL10nApply=apply;window.ggL10nKeys=Object.keys(D);
function start(){apply();try{new MutationObserver(apply).observe(document.documentElement,{attributes:true,attributeFilter:['lang']})}catch(e){}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
