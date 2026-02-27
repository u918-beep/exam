const DEFAULT_SITE_NAME = "اختبار الحاسوب - مدرسة السيّاب";
const ADMIN_USER = "admin";
const ADMIN_SALT = "SiabSaltV1";
// SHA256("SiabSaltV1" + "siab@2026")
const ADMIN_HASH = "6ee06bd0e9a0d451a76cbb2e7d75d654d8068bd2b0f0baf5f25e76c0b4c66b8e";

const STORAGE = {
  student: "siab.student",
  session: "siab.session",
  results: "siab.results",
  settings: "siab.settings",
  bank: "siab.bank"
};

const $ = (id)=>document.getElementById(id);
const now = ()=>Date.now();

async function sha256(str){
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(str));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("");
}

function loadSettings(){
  const d = {
    siteName: DEFAULT_SITE_NAME,
    school: "مدرسة السيّاب",
    minCheatStrikes: 3,
    examDurationMin: 25,
    requireFullscreen: true,
    randomize: true,
    questionCount: 20,
    passMark: 50,
    chapters: [
      "الفصل الأول: الأجهزة الذكية وإنترنت الأشياء",
      "الفصل الثاني: Excel",
      "الفصل الثالث: المصفوفات",
      "الفصل الرابع: الخدمات الإلكترونية والسحابة",
      "الكتاب كامل (عشوائي)"
    ]
  };
  try{
    const s = JSON.parse(localStorage.getItem(STORAGE.settings) || "null");
    return Object.assign(d, s||{});
  }catch{ return d; }
}
function saveSettings(s){ localStorage.setItem(STORAGE.settings, JSON.stringify(s)); }

function loadBank(){
  try{
    const b = JSON.parse(localStorage.getItem(STORAGE.bank) || "null");
    if (b && Array.isArray(b) && b.length) return b;
  }catch{}
  return window.QUESTION_BANK || [];
}

function setStudent(stu){ localStorage.setItem(STORAGE.student, JSON.stringify(stu)); }
function getStudent(){ try{ return JSON.parse(localStorage.getItem(STORAGE.student)||"null"); }catch{ return null; } }
function setSession(sess){ localStorage.setItem(STORAGE.session, JSON.stringify(sess)); }
function getSession(){ try{ return JSON.parse(localStorage.getItem(STORAGE.session)||"null"); }catch{ return null; } }
function clearSession(){ localStorage.removeItem(STORAGE.session); }

function pushResult(r){
  const all = JSON.parse(localStorage.getItem(STORAGE.results) || "[]");
  all.unshift(r);
  localStorage.setItem(STORAGE.results, JSON.stringify(all));
}
function getResults(){ return JSON.parse(localStorage.getItem(STORAGE.results) || "[]"); }

function shuffle(a){
  for(let i=a.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}
function fmtTime(ms){
  const s=Math.max(0,Math.floor(ms/1000));
  const m=Math.floor(s/60);
  const r=s%60;
  return `${m.toString().padStart(2,"0")}:${r.toString().padStart(2,"0")}`;
}

function showScreen(name){
  ["login","exam","result"].forEach(s => $("screen-"+s).classList.add("hidden"));
  $("screen-"+name).classList.remove("hidden");
}

function antiCheatSetup(session, settings){
  document.addEventListener("contextmenu", e => e.preventDefault());
  document.addEventListener("copy", e => e.preventDefault());
  document.addEventListener("cut", e => e.preventDefault());
  document.addEventListener("paste", e => e.preventDefault());

  let devCount = 0;

  function strike(reason){
    session.cheatStrikes = (session.cheatStrikes||0) + 1;
    session.cheatLog = session.cheatLog || [];
    session.cheatLog.push({t:new Date().toISOString(), reason});
    setSession(session);

    $("cheatBox").classList.remove("hidden");
    $("cheatStrikes").textContent = session.cheatStrikes;
    $("cheatReason").textContent = reason;

    if(session.cheatStrikes >= settings.minCheatStrikes){
      finishExam("تم إنهاء الاختبار بسبب مخالفات الغش.");
    }
  }

  document.addEventListener("visibilitychange", ()=>{
    const s=getSession();
    if(!s || s.state!=="in_exam") return;
    if(document.hidden) strike("تم تبديل/إخفاء الصفحة.");
  });

  window.addEventListener("blur", ()=>{
    const s=getSession();
    if(!s || s.state!=="in_exam") return;
    strike("تم الخروج من نافذة الاختبار.");
  });

  // DevTools heuristic (تقريبي)
  setInterval(()=>{
    const s=getSession();
    if(!s || s.state!=="in_exam") return;
    const w=window.outerWidth-window.innerWidth;
    const h=window.outerHeight-window.innerHeight;
    if(w>160 || h>160){
      devCount++;
      if(devCount%2===0) strike("اشتباه فتح أدوات المطور.");
    }
  }, 2500);

  async function ensureFull(){
    if(!settings.requireFullscreen) return;
    if(!document.fullscreenElement){
      strike("الاختبار يتطلب وضع ملء الشاشة.");
      try{ await document.documentElement.requestFullscreen(); }catch{}
    }
  }
  document.addEventListener("fullscreenchange", ()=>{
    const s=getSession();
    if(!s || s.state!=="in_exam") return;
    if(settings.requireFullscreen && !document.fullscreenElement){
      strike("تم الخروج من ملء الشاشة.");
    }
  });

  ensureFull();
}

function buildExamQuestions(bank, settings, selectedChapter){
  let pool=[...bank];
  if(selectedChapter && selectedChapter!=="الكتاب كامل (عشوائي)"){
    pool = pool.filter(q => (q.chapter||"") === selectedChapter);
  }
  if(settings.randomize) pool=shuffle(pool);
  const count=Math.min(settings.questionCount, pool.length);
  const qs=pool.slice(0,count).map(q=>{
    const qq=JSON.parse(JSON.stringify(q));
    if(Array.isArray(qq.options) && settings.randomize) qq.options = shuffle([...qq.options]);
    return qq;
  });
  return qs;
}

function renderQuestion(q, idx, total, session){
  $("qNo").textContent = `${idx+1} / ${total}`;
  $("qText").textContent = q.prompt;
  $("qMeta").textContent = `الفصل: ${q.chapter} • مستوى: ${q.level||"—"}`;

  const box=$("opts");
  box.innerHTML="";
  q.options.forEach(opt=>{
    const wrap=document.createElement("label");
    wrap.className="opt";
    const inp=document.createElement("input");
    inp.type="radio"; inp.name="opt"; inp.value=opt;
    inp.checked = (session.answers[q.id] === opt);
    inp.addEventListener("change", ()=>{
      session.answers[q.id]=opt;
      setSession(session);
    });
    const sp=document.createElement("div");
    sp.textContent=opt;
    wrap.appendChild(inp); wrap.appendChild(sp);
    box.appendChild(wrap);
  });
}

function grade(session){
  let correct=0;
  session.questions.forEach(q=>{
    const a=(session.answers[q.id]||"").trim();
    if(a && a===q.answer) correct++;
  });
  const score = session.questions.length ? Math.round((correct/session.questions.length)*100) : 0;
  return {correct, score};
}

function finishExam(reason=null){
  const session=getSession();
  if(!session || session.state!=="in_exam") return;

  session.state="finished";
  session.finishedAt=now();
  session.finishReason=reason;
  setSession(session);

  try{ if(document.fullscreenElement) document.exitFullscreen(); }catch{}

  const g=grade(session);
  const settings=loadSettings();
  const student=getStudent();

  const result={
    id: crypto.randomUUID(),
    student,
    createdAt: new Date().toISOString(),
    chapter: session.selectedChapter,
    durationSec: Math.floor((session.finishedAt-session.startedAt)/1000),
    score: g.score,
    correct: g.correct,
    total: session.questions.length,
    cheatStrikes: session.cheatStrikes||0,
    finishReason: session.finishReason || null
  };
  pushResult(result);

  showScreen("result");
  $("rName").textContent=student.fullName;
  $("rClass").textContent=student.className||"—";
  $("rChapter").textContent=result.chapter||"—";
  $("rScore").textContent=result.score+"%";
  $("rCorrect").textContent=`${result.correct} / ${result.total}`;
  $("rTime").textContent=fmtTime(result.durationSec*1000);
  $("rStrikes").textContent=result.cheatStrikes;
  $("rReason").textContent=result.finishReason ? result.finishReason : "انتهى بشكل طبيعي";
  $("rPass").textContent=(result.score>=settings.passMark) ? "ناجح ✅" : "لم يجتز ❌";
  $("btnCert").disabled = !(result.score>=settings.passMark);
}

function generateCertificate(result){
  const {jsPDF}=window.jspdf;
  const settings=loadSettings();
  const doc=new jsPDF({orientation:"landscape", unit:"pt", format:"a4"});
  const w=doc.internal.pageSize.getWidth();
  const h=doc.internal.pageSize.getHeight();

  doc.setFont("helvetica","bold");
  doc.setFontSize(28);
  doc.text("Certificate of Achievement", w/2, 110, {align:"center"});

  doc.setFont("helvetica","normal");
  doc.setFontSize(16);
  doc.text("This certifies that", w/2, 160, {align:"center"});

  doc.setFont("helvetica","bold");
  doc.setFontSize(30);
  doc.text(result.student.fullName, w/2, 210, {align:"center"});

  doc.setFont("helvetica","normal");
  doc.setFontSize(16);
  doc.text(`Chapter: ${result.chapter}`, w/2, 255, {align:"center"});
  doc.text(`Score: ${result.score}%   |   Time: ${Math.floor(result.durationSec/60)} min`, w/2, 280, {align:"center"});
  doc.text(`School: ${settings.school}`, w/2, 305, {align:"center"});

  doc.setFontSize(12);
  doc.text(`Issued: ${new Date(result.createdAt).toLocaleString()}`, 70, h-70);
  doc.text(`Student ID: ${result.student.studentId}`, w-70, h-70, {align:"right"});

  doc.setLineWidth(2);
  doc.rect(40, 40, w-80, h-80);

  doc.save(`certificate-${result.student.studentId}.pdf`);
}

function fillChapters(){
  const settings=loadSettings();
  const sel=$("chapter");
  sel.innerHTML="";
  settings.chapters.forEach(ch=>{
    const o=document.createElement("option");
    o.value=ch; o.textContent=ch;
    sel.appendChild(o);
  });
}

function startExam(){
  const student=getStudent();
  const settings=loadSettings();
  const bank=loadBank();
  const selectedChapter=$("chapter").value;

  const qs=buildExamQuestions(bank, settings, selectedChapter);
  if(!qs.length) return alert("لا توجد أسئلة لهذا الفصل.");

  const session={
    id: crypto.randomUUID(),
    state:"in_exam",
    student,
    selectedChapter,
    questions: qs,
    answers:{},
    startedAt: now(),
    finishedAt:null,
    cheatStrikes:0,
    cheatLog:[]
  };
  setSession(session);

  showScreen("exam");
  $("examTitle").textContent=settings.siteName;
  $("examSub").textContent=`${settings.school} • ${selectedChapter}`;

  antiCheatSetup(session, settings);

  session.deadline = session.startedAt + settings.examDurationMin*60*1000;
  setSession(session);

  let idx=0;
  renderQuestion(session.questions[idx], idx, session.questions.length, session);

  $("btnPrev").onclick=()=>{
    const s=getSession(); if(!s) return;
    idx=Math.max(0, idx-1);
    renderQuestion(s.questions[idx], idx, s.questions.length, s);
  };
  $("btnNext").onclick=()=>{
    const s=getSession(); if(!s) return;
    idx=Math.min(s.questions.length-1, idx+1);
    renderQuestion(s.questions[idx], idx, s.questions.length, s);
  };
  $("btnFinish").onclick=()=>{
    if(confirm("تأكيد إنهاء الاختبار؟")) finishExam(null);
  };

  const tick=()=>{
    const s=getSession();
    if(!s || s.state!=="in_exam") return;
    const left=s.deadline-now();
    $("timer").textContent=fmtTime(left);
    if(left<=0){ finishExam("انتهى الوقت."); return; }
    requestAnimationFrame(()=>setTimeout(tick,250));
  };
  tick();
}

function loginStudent(){
  const fullName=$("fullName").value.trim();
  const className=$("className").value.trim();
  const studentId=$("studentId").value.trim();
  if(!fullName || !studentId) return alert("اكتب الاسم الكامل + رمز الطالب.");
  setStudent({fullName, className, studentId});
  startExam();
}

async function loginAdmin(){
  const u=$("adminUser").value.trim();
  const p=$("adminPass").value;
  if(!u || !p) return alert("اكتب بيانات الدخول");
  const hash=await sha256(ADMIN_SALT+p);
  if(u!==ADMIN_USER || hash!==ADMIN_HASH) return alert("بيانات الدخول غير صحيحة");
  window.location.href="admin.html";
}

function boot(){
  const settings=loadSettings();
  document.title=settings.siteName;
  $("siteName").textContent=settings.siteName;
  $("schoolName").textContent=settings.school;

  fillChapters();

  $("btnStudentLogin").onclick=loginStudent;
  $("btnAdminLogin").onclick=loginAdmin;

  const sess=getSession();
  if(sess && sess.state==="in_exam"){
    finishExam("تم تحديث الصفحة أثناء الاختبار.");
  }

  $("btnHome").onclick=()=>{ clearSession(); showScreen("login"); };
  $("btnCert").onclick=()=>{
    const all=getResults();
    if(!all.length) return;
    generateCertificate(all[0]);
  };
}
document.addEventListener("DOMContentLoaded", boot);
