# gaongreen-website
GaonGreen multilingual company website

<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>K-ISSB Wizard | GaonGreen</title>
<style>
:root {
  --green:#146b4c;
  --dark:#17382b;
  --light:#eff8f2;
  --border:#d9e8df;
}
* {box-sizing:border-box}
body {
  margin:0;
  font-family:Arial,"Noto Sans",sans-serif;
  color:var(--dark);
  background:#f7faf8;
  line-height:1.6;
}
header {
  background:white;
  border-bottom:1px solid var(--border);
  padding:18px 5%;
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:15px;
  flex-wrap:wrap;
}
.logo {
  color:var(--green);
  font-size:24px;
  font-weight:bold;
  text-decoration:none;
}
button,.btn {
  border:0;
  background:var(--green);
  color:white;
  border-radius:8px;
  padding:11px 17px;
  cursor:pointer;
  font-size:14px;
}
.lang {
  background:white;
  color:var(--green);
  border:1px solid var(--border);
}
main {max-width:950px;margin:35px auto;padding:0 18px}
.hero {
  background:linear-gradient(135deg,#e4f3e9,#f8fcf9);
  padding:35px;
  border-radius:18px;
  margin-bottom:24px;
}
h1 {font-size:clamp(30px,5vw,46px);line-height:1.2}
h2 {margin-top:0}
.card {
  background:white;
  padding:28px;
  border:1px solid var(--border);
  border-radius:15px;
  margin-bottom:20px;
}
.field {margin-bottom:17px}
label {display:block;font-weight:600;margin-bottom:6px}
input,select {
  width:100%;
  padding:12px;
  border:1px solid #cbdcd1;
  border-radius:8px;
  font:inherit;
  background:white;
}
.question {
  padding:17px 0;
  border-bottom:1px solid var(--border);
}
.question:last-child {border:0}
.question p {font-weight:600;margin:0 0 10px}
.actions {display:flex;gap:12px;flex-wrap:wrap}
.progress {
  height:14px;
  background:#e2eee6;
  border-radius:20px;
  overflow:hidden;
}
#bar {
  width:0%;
  height:100%;
  background:var(--green);
}
.score {font-size:38px;font-weight:bold;color:var(--green)}
.missing {padding:0 0 0 22px}
footer {text-align:center;padding:30px;color:#667a6e}
html[dir="rtl"] .missing {padding:0 22px 0 0}
@media print {
  header,.actions,.hero,.question-card {display:none!important}
  body {background:white}
  .card {border:0}
}
</style>
</head>
<body>

<header>
  <a class="logo" href="../../index.html">GaonGreen</a>
  <div>
    <button class="lang" onclick="setLanguage('en')">EN</button>
    <button class="lang" onclick="setLanguage('ko')">한국어</button>
    <button class="lang" onclick="setLanguage('ar')">العربية</button>
  </div>
</header>

<main>
  <div class="hero">
    <h1 data-t="title">K-ISSB Reporting Wizard</h1>
    <p data-t="intro">
      Assess your company's ESG data readiness.
    </p>
  </div>

  <section class="card">
    <h2 data-t="company">Company Profile</h2>
    <div class="field">
      <label for="name" data-t="name">Company name</label>
      <input id="name" type="text">
    </div>
    <div class="field">
      <label for="industry" data-t="industry">Industry</label>
      <input id="industry" type="text">
    </div>
    <div class="field">
      <label for="employees" data-t="employees">Employees</label>
      <input id="employees" type="number" min="0">
    </div>
    <div class="field">
      <label for="year" data-t="year">Reporting year</label>
      <input id="year" type="number" min="2000" max="2100" value="2026">
    </div>
  </section>

  <section class="card question-card">
    <h2 data-t="questions">ESG Data Readiness Checklist</h2>
    <p data-t="instruction">
      Select whether your company has documented data
      for each item.
    </p>
    <div id="questions"></div>
    <div class="actions" style="margin-top:24px">
      <button onclick="calculate()" data-t="calculate">
        Generate assessment
      </button>
      <button onclick="resetForm()" data-t="reset">
        Reset
      </button>
    </div>
  </section>

  <section class="card" id="results" hidden>
    <h2 data-t="results">Preliminary Results</h2>
    <p id="companyResult"></p>
    <div class="score" id="score">0%</div>
    <div class="progress"><div id="bar"></div></div>
    <p data-t="scoreNote">
      This measures checklist completeness, not ESG
      performance or regulatory compliance.
    </p>
    <h3 data-t="missing">Missing or unconfirmed information</h3>
    <ul class="missing" id="missingList"></ul>
    <div class="actions">
      <button onclick="window.print()" data-t="print">
        Print / Save as PDF
      </button>
    </div>
  </section>
</main>

<footer>© 2026 GaonGreen Co., Ltd.</footer>

<script>
const translations = {
  en: {
    title:"K-ISSB Reporting Wizard",
    intro:"Assess your company's ESG data readiness.",
    company:"Company Profile",
    name:"Company name",
    industry:"Industry",
    employees:"Employees",
    year:"Reporting year",
    questions:"ESG Data Readiness Checklist",
    instruction:"Select whether your company has documented data for each item.",
    calculate:"Generate assessment",
    reset:"Reset",
    results:"Preliminary Results",
    scoreNote:"This measures checklist completeness, not ESG performance or regulatory compliance.",
    missing:"Missing or unconfirmed information",
    print:"Print / Save as PDF",
    yes:"Available",
    no:"Not available",
    unknown:"Not sure",
    select:"Select an answer",
    none:"No missing items identified.",
    q:[
      "Annual electricity consumption",
      "Fuel consumption",
      "Scope 1 emissions data",
      "Scope 2 emissions data",
      "Water consumption",
      "Waste generation",
      "Employee headcount records",
      "Workplace health and safety records",
      "Supplier ESG information",
      "Governance and ethics policies"
    ]
  },
  ko: {
    title:"K-ISSB 보고 준비 도우미",
    intro:"기업의 ESG 데이터 준비 수준을 확인하세요.",
    company:"기업 정보",
    name:"기업명",
    industry:"업종",
    employees:"직원 수",
    year:"보고 연도",
    questions:"ESG 데이터 준비 체크리스트",
    instruction:"각 항목에 대해 문서화된 데이터가 있는지 선택하세요.",
    calculate:"평가 결과 생성",
    reset:"초기화",
    results:"예비 평가 결과",
    scoreNote:"이 점수는 체크리스트의 완성도를 나타내며 ESG 성과나 규제 준수 여부를 의미하지 않습니다.",
    missing:"누락되었거나 확인되지 않은 정보",
    print:"인쇄 / PDF 저장",
    yes:"보유",
    no:"없음",
    unknown:"확인 필요",
    select:"답변 선택",
    none:"누락된 항목이 없습니다.",
    q:[
      "연간 전력 사용량",
      "연료 사용량",
      "Scope 1 배출량 데이터",
      "Scope 2 배출량 데이터",
      "물 사용량",
      "폐기물 발생량",
      "직원 수 기록",
      "산업안전보건 기록",
      "공급업체 ESG 정보",
      "지배구조 및 윤리 정책"
    ]
  },
  ar: {
    title:"مساعد إعداد تقارير K-ISSB",
    intro:"قيّم مدى جاهزية بيانات ESG في شركتك.",
    company:"معلومات الشركة",
    name:"اسم الشركة",
    industry:"القطاع",
    employees:"عدد الموظفين",
    year:"سنة التقرير",
    questions:"قائمة التحقق من جاهزية بيانات ESG",
    instruction:"حدد ما إذا كانت شركتك تمتلك بيانات موثقة لكل بند.",
    calculate:"إنشاء التقييم",
    reset:"إعادة تعيين",
    results:"نتائج التقييم الأولي",
    scoreNote:"تقيس هذه النسبة اكتمال القائمة، وليس أداء ESG أو الامتثال التنظيمي.",
    missing:"معلومات ناقصة أو غير مؤكدة",
    print:"طباعة / حفظ PDF",
    yes:"متوفر",
    no:"غير متوفر",
    unknown:"غير متأكد",
    select:"اختر إجابة",
    none:"لم يتم تحديد بنود ناقصة.",
    q:[
      "استهلاك الكهرباء السنوي",
      "استهلاك الوقود",
      "بيانات انبعاثات النطاق الأول",
      "بيانات انبعاثات النطاق الثاني",
      "استهلاك المياه",
      "كمية النفايات",
      "سجلات أعداد الموظفين",
      "سجلات الصحة والسلامة المهنية",
      "معلومات ESG الخاصة بالموردين",
      "سياسات الحوكمة والأخلاقيات"
    ]
  }
};

let language = "en";
let answers = Array(10).fill("");

function renderQuestions() {
  const t = translations[language];
  const container = document.getElementById("questions");
  container.replaceChildren();

  t.q.forEach((question, index) => {
    const div = document.createElement("div");
    div.className = "question";

    const p = document.createElement("p");
    p.textContent = (index + 1) + ". " + question;

    const select = document.createElement("select");
    select.setAttribute("aria-label", question);

    [
      ["",t.select],
      ["yes",t.yes],
      ["no",t.no],
      ["unknown",t.unknown]
    ].forEach(([value,label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      select.appendChild(option);
    });

    select.value = answers[index];
    select.addEventListener("change", () => {
      answers[index] = select.value;
      document.getElementById("results").hidden = true;
    });

    div.append(p,select);
    container.appendChild(div);
  });
}

function setLanguage(lang) {
  language = translations[lang] ? lang : "en";
  const t = translations[language];

  document.documentElement.lang = language;
  document.documentElement.dir =
    language === "ar" ? "rtl" : "ltr";

  document.querySelectorAll("[data-t]").forEach(el => {
    const key = el.dataset.t;
    if (typeof t[key] === "string") {
      el.textContent = t[key];
    }
  });

  renderQuestions();

  if (!document.getElementById("results").hidden) {
    calculate();
  }

  try {
    localStorage.setItem("gaongreen-language",language);
  } catch(e) {}
}

function calculate() {
  const t = translations[language];
  const count = answers.filter(a => a === "yes").length;
  const percentage = Math.round(count / answers.length * 100);

  const name = document.getElementById("name").value.trim();
  const year = document.getElementById("year").value;

  document.getElementById("companyResult").textContent =
    [name,year].filter(Boolean).join(" — ");

  document.getElementById("score").textContent = percentage + "%";
  document.getElementById("bar").style.width = percentage + "%";

  const list = document.getElementById("missingList");
  list.replaceChildren();

  answers.forEach((answer,index) => {
    if (answer !== "yes") {
      const item = document.createElement("li");
      item.textContent = t.q[index];
      list.appendChild(item);
    }
  });

  if (!list.children.length) {
    const item = document.createElement("li");
    item.textContent = t.none;
    list.appendChild(item);
  }

  document.getElementById("results").hidden = false;
  document.getElementById("results").scrollIntoView({
    behavior:"smooth",
    block:"start"
  });
}

function resetForm() {
  answers = Array(10).fill("");
  ["name","industry","employees"].forEach(id => {
    document.getElementById(id).value = "";
  });
  document.getElementById("year").value = "2026";
  document.getElementById("results").hidden = true;
  renderQuestions();
}

let savedLanguage = "en";
try {
  savedLanguage =
    localStorage.getItem("gaongreen-language") || "en";
} catch(e) {}

setLanguage(savedLanguage);
</script>
</body>
</html>
