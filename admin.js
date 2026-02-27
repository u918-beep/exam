const STORAGE = {
  results: "siab.results",
  settings: "siab.settings",
  bank: "siab.bank"
};
const $ = (id)=>document.getElementById(id);

function loadSettings(){
  const d = {
    siteName: "اختبار الحاسوب - مدرسة السيّاب",
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
function getResults(){ return JSON.parse(localStorage.getItem(STORAGE.results) || "[]"); }

function loadBank(){
  try{
    const b = JSON.parse(localStorage.getItem(STORAGE.bank) || "null");
    if (b && Array.isArray(b) && b.length) return b;
  }catch{}
  return window.QUESTION_BANK || [];
}
function saveBank(bank){ localStorage.setItem(STORAGE.bank, JSON.stringify(bank)); }

function download(name, text, mime="application/json"){
  const blob = new Blob([text], {type:mime});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
}
function toCSV(rows){
  const esc = (v)=>('"'+String(v??"").replaceAll('"','""')+'"');
  const header = ["createdAt","chapter","fullName","className","studentId","score","correct","total","durationSec","cheatStrikes","finishReason"];
  const lines = [header.map(esc).join(",")];
  rows.forEach(r=>{
    lines.push([
      r.createdAt, r.chapter, r.student?.fullName, r.student?.className, r.student?.studentId,
      r.score, r.correct, r.total, r.durationSec, r.cheatStrikes, r.finishReason
    ].map(esc).join(","));
  });
  return lines.join("\n");
}

function renderResults(){
  const res = getResults();
  $("resCount").textContent = res.length;
  const tbody = $("resBody");
  tbody.innerHTML = "";
  res.slice(0,200).forEach(r=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${(r.createdAt||"").replace("T"," ").slice(0,19)}</td>
      <td>${r.chapter || ""}</td>
      <td>${r.student?.fullName || ""}</td>
      <td>${r.student?.className || ""}</td>
      <td>${r.student?.studentId || ""}</td>
      <td><b>${r.score ?? ""}%</b></td>
      <td>${r.correct ?? ""}/${r.total ?? ""}</td>
      <td>${Math.floor((r.durationSec||0)/60)}m</td>
      <td>${r.cheatStrikes ?? 0}</td>
      <td class="muted">${r.finishReason ?? ""}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderBank(){
  const bank = loadBank();
  $("qCount").textContent = bank.length;
  $("bankJson").value = JSON.stringify(bank, null, 2);
}

function boot(){
  const s = loadSettings();

  $("siteName").value = s.siteName;
  $("school").value = s.school;
  $("duration").value = s.examDurationMin;
  $("strikes").value = s.minCheatStrikes;
  $("qCountSet").value = s.questionCount;
  $("passMark").value = s.passMark;
  $("requireFs").checked = !!s.requireFullscreen;
  $("randomize").checked = !!s.randomize;
  $("chapters").value = (s.chapters||[]).join("\n");

  $("btnSaveSettings").onclick = ()=>{
    const chapters = $("chapters").value.split("\n").map(x=>x.trim()).filter(Boolean);
    const ns = {
      siteName: $("siteName").value.trim() || s.siteName,
      school: $("school").value.trim() || s.school,
      examDurationMin: Math.max(5, parseInt($("duration").value||"25",10)),
      minCheatStrikes: Math.max(1, parseInt($("strikes").value||"3",10)),
      questionCount: Math.max(5, parseInt($("qCountSet").value||"20",10)),
      passMark: Math.min(100, Math.max(0, parseInt($("passMark").value||"50",10))),
      requireFullscreen: $("requireFs").checked,
      randomize: $("randomize").checked,
      chapters: chapters.length ? chapters : s.chapters
    };
    saveSettings(ns);
    alert("تم حفظ الإعدادات ✅");
  };

  $("btnExportResults").onclick = ()=> download("results.json", JSON.stringify(getResults(), null, 2));
  $("btnExportCSV").onclick = ()=> download("results.csv", toCSV(getResults()), "text/csv");
  $("btnClearResults").onclick = ()=>{
    if(confirm("مسح كل النتائج من هذا الجهاز؟")){
      localStorage.removeItem(STORAGE.results);
      renderResults();
    }
  };

  $("btnApplyBank").onclick = ()=>{
    try{
      const bank = JSON.parse($("bankJson").value);
      if(!Array.isArray(bank) || !bank.length) return alert("JSON غير صحيح أو فارغ");
      bank.forEach((q,i)=>q.id=i+1);
      saveBank(bank);
      alert("تم تحديث بنك الأسئلة ✅");
      renderBank();
    }catch(e){
      alert("JSON غير صالح: " + e.message);
    }
  };

  $("btnExportBank").onclick = ()=> download("question-bank.json", JSON.stringify(loadBank(), null, 2));
  $("bankFile").addEventListener("change", async (e)=>{
    const f = e.target.files?.[0];
    if(!f) return;
    $("bankJson").value = await f.text();
  });

  renderResults();
  renderBank();
}
document.addEventListener("DOMContentLoaded", boot);
