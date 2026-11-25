const D=window.LVX_DATA,$=s=>document.querySelector(s),esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));const load=()=>{try{return JSON.parse(localStorage.getItem("lvxProgress")||"{}")}catch{return {}}};let P=load();P.answers=P.answers||[];P.sessions=P.sessions||[];P.notes=P.notes||"";P.plan=P.plan||{};function save(){localStorage.setItem("lvxProgress",JSON.stringify(P))}function show(v){document.querySelectorAll(".view").forEach(x=>x.classList.toggle("active",x.id===v));document.querySelectorAll(".nav").forEach(x=>x.classList.toggle("active",x.dataset.view===v));if(v==="dashboard")renderDash();if(v==="weakness")renderWeak();if(v==="plan")renderPlan()}document.querySelectorAll(".nav").forEach(x=>x.onclick=()=>show(x.dataset.view));function stats(){let o={};P.answers.forEach(a=>{let k=a.topic||a.track;o[k]=o[k]||{n:0,w:0};o[k].n++;if(!a.correct)o[k].w++});return o}function acc(){return P.answers.length?Math.round(100*P.answers.filter(a=>a.correct).length/P.answers.length):0}
const COURSE_PATHS=[
{id:'entry',title:'County Correction Officer — Entry',tag:'ENTRY LEVEL',desc:'Foundational correctional knowledge, admissions, inmate rights and services, security, supervision, communication, and written-test skills.',focus:'Admissions • Identification • Supervision • Safety • Communication'},
{id:'sergeant',title:'Correction Sergeant — Promotional',tag:'FIRST-LINE SUPERVISION',desc:'Shared standards plus staff oversight, post inspections, inmate programs, visitation, incident response, documentation, and training.',focus:'Staff direction • Inspections • Programs • Incident response'},
{id:'lieutenant',title:'Correction Lieutenant — Promotional',tag:'SHIFT COMMAND',desc:'Shared standards plus coordinating sergeants, allocating resources, managing emergencies, reviewing incidents, and maintaining facility operations.',focus:'Shift command • Resource allocation • Accountability • Emergency coordination'},
{id:'captain',title:'Correction Captain — Promotional',tag:'FACILITY LEADERSHIP',desc:'Shared standards plus facility-wide supervision, policy implementation, operational planning, compliance, staffing, and performance oversight.',focus:'Facility operations • Policy • Compliance • Workforce leadership'},
{id:'chief',title:'Correction Chief — Promotional',tag:'EXECUTIVE COMMAND',desc:'Shared standards plus strategic oversight, regulatory compliance, risk management, interagency coordination, policy governance, and organizational leadership.',focus:'Governance • Risk • Strategic planning • Regulatory oversight'}
];
const SOURCE_FILES=[
['Minimum Standards — Official Source Compilation.pdf','Primary regulation reference • 171-page standards compilation'],
['NYS Civil Service — First Line Correction Supervisors Test Guide.pdf','Official test guide • written material, standards, supervision, emergencies'],
['Rockland County — Correction Lieutenant Promotional Exam Announcement.pdf','Local exam announcement • qualifications and tested subject areas'],
['Lieutenant Study Guide.pdf','Supplemental lieutenant preparation'],
['Administrative Supervision — Booklet 18.pdf','Administrative supervision study material'],
['How to Take a Written Civil Service Examination.pdf','General civil-service exam strategy'],
['How to Take a Civil Service Examination — Supplement.pdf','Additional examination strategy'],
['Understanding and Interpreting Written Material — Booklet 4.pdf','Reading comprehension practice'],
['Preparing Written Material — Booklet 17.pdf','Paragraph organization and information presentation'],
['Grammar, Usage and Punctuation — Booklet 5.pdf','Grammar and written communication practice'],
['Minimum Standards — Cliff Notes.docx','Condensed standards review • verify against full source'],
['Minimum Standards — Practice Questions.docx','Practice questions for minimum standards'],
['Admissions and Supervision — Practice Questions.docx','Admission, supervision, and operational review']
];
const COURSE_CODE_TO_PATH = {
  ENTRY: 'entry',
  SERGEANT: 'sergeant',
  LIEUTENANT: 'lieutenant',
  CAPTAIN: 'captain',
  CHIEF: 'chief'
};

const ENROLLED_PATHS = (window.LVX_ENROLLED_COURSES || [])
  .map(code => COURSE_CODE_TO_PATH[code])
  .filter(Boolean);

const AVAILABLE_COURSE_PATHS = COURSE_PATHS.filter(course =>
  ENROLLED_PATHS.includes(course.id)
);
let activeCourse = localStorage.getItem('lvxCoursePath') || ENROLLED_PATHS[0] || '';

if (!ENROLLED_PATHS.includes(activeCourse)) {
  activeCourse = ENROLLED_PATHS[0] || '';
  if (activeCourse) localStorage.setItem('lvxCoursePath', activeCourse);
  else localStorage.removeItem('lvxCoursePath');
}
function renderLearning(){const g=$('#courseGrid');if(!g)return;g.innerHTML=AVAILABLE_COURSE_PATHS.map(x=>`<article class="course-card ${activeCourse===x.id?'selected':''}"><div class="tag">${x.tag}</div><h3>${x.title}</h3><p>${x.desc}</p><small>${x.focus}</small><button class="${activeCourse===x.id?'primary':'ghost'}" onclick="selectCourse('${x.id}')">${activeCourse===x.id?'Current learning path':'Select learning path'}</button></article>`).join('');$('#sourceLibrary').innerHTML=SOURCE_FILES.map(x=>`<a class="source-link" href="source-library/${encodeURIComponent(x[0])}" target="_blank" rel="noopener">${esc(x[0])}<small>${esc(x[1])}</small></a>`).join('')}
function selectCourse(id) {
  if (!ENROLLED_PATHS.includes(id)) {
    alert('You are not enrolled in this course. Contact academy administration.');
    return;
  }
  activeCourse = id;
  localStorage.setItem('lvxCoursePath', id);
  renderLearning();
  renderDash();
}

function renderDash(){$("#stats").innerHTML=[[D.parts.length,"Regulatory Parts"],[D.sections.length,"Sections in source"],[P.answers.length,"Questions attempted"],[acc()+"%","Overall accuracy"]].map(x=>`<div class="stat"><b>${x[0]}</b><span>${x[1]}</span></div>`).join("");$("#sectionCount").textContent=`${D.sections.length} sections • ${D.parts.length} Parts`;$("#continueList").innerHTML=`<div class="path-banner"><b>ACTIVE PATH:</b> ${esc(AVAILABLE_COURSE_PATHS.find(x=>x.id===activeCourse)?.title||"Correction Lieutenant — Promotional")}<br><small>${esc(AVAILABLE_COURSE_PATHS.find(x=>x.id===activeCourse)?.focus||"")}</small><br><button class="ghost" onclick="show('learning')">Change learning path</button></div><div class="log-row"><b>Minimum Standards</b><small>${D.sections.length} sections available</small><button class="ghost" onclick="show('standards')">Open library</button></div><div class="log-row"><b>Grammar & Written Material</b><small>Lessons, examples, and practice questions</small><button class="ghost" onclick="show('grammar')">Continue</button></div><div class="log-row"><b>Numbers & Timeframes</b><small>${D.timeIndex.length} excerpts indexed for review</small><button class="ghost" onclick="show('numbers')">Review</button></div>`;let top=Object.entries(stats()).sort((a,b)=>b[1].w-a[1].w).slice(0,5);$("#weakTop").innerHTML=top.length?top.map(([k,v])=>`<div class="log-row"><b>${esc(k)}</b><small>${v.w} incorrect of ${v.n}</small><div class="bar"><span style="width:${100*v.w/v.n}%"></span></div></div>`).join(""):'<div class="empty">Complete practice questions to build your weakness profile.</div>'}
let selectedPart=D.parts[0]?.number||"";function renderStandards(){$("#partFilter").innerHTML='<option value="">All Parts</option>'+D.parts.map(p=>`<option value="${p.number}">Part ${p.number} — ${esc(p.title)}</option>`).join("");$("#timePart").innerHTML=$("#partFilter").innerHTML;$("#partList").innerHTML=D.parts.map(p=>`<button class="part-btn ${p.number===selectedPart?"active":""}" onclick="selectPart('${p.number}')"><b>PART ${p.number}</b><small>${esc(p.title)}</small></button>`).join("");$("#partFilter").onchange=renderPartList;$("#standardSearch").oninput=renderPartList;renderPartList()}function selectPart(n){selectedPart=n;$("#partFilter").value=n;renderStandards()}function renderPartList(){let q=$("#standardSearch").value.toLowerCase(),p=$("#partFilter").value;let a=D.sections.filter(s=>(!p||s.part===p)&&(!q||`${s.part} ${s.partTitle} ${s.id} ${s.title} ${s.text}`.toLowerCase().includes(q)));$("#sectionList").innerHTML=a.map(s=>`<button class="section-btn" onclick="openSection('${s.id}')"><b>§ ${s.id} — ${esc(s.title)}</b><small>Part ${s.part} • ${esc(s.partTitle)}</small></button>`).join("")||'<div class="empty">No matching sections.</div>'}function openSection(id){let s=D.sections.find(x=>x.id===id);if(!s)return;$("#sectionList").innerHTML=`<div class="section-detail"><button class="ghost" onclick="renderPartList()">← Back</button><p class="eyebrow">PART ${s.part} • SECTION ${s.id}</p><h2>${esc(s.title)}</h2><p class="muted">${esc(s.partTitle)}</p><div class="source-text">${esc(s.text)}</div>${s.numericFacts.length?'<h3>Number / timeframe excerpts</h3>'+s.numericFacts.map(x=>`<div class="callout">${esc(x)}</div>`).join(""):""}<button class="primary" onclick="startQuiz('standards','${s.id}')">Practice available questions</button></div>`}function renderTimes(){let q=$("#timeSearch").value.toLowerCase(),p=$("#timePart").value,a=D.timeIndex.filter(x=>(!p||x.part===p)&&`${x.section} ${x.partTitle} ${x.sectionTitle} ${x.sourceText}`.toLowerCase().includes(q));$("#timeList").innerHTML=a.map(x=>`<div class="time-card"><small>PART ${x.part} • § ${x.section}</small><h3>${esc(x.sectionTitle)}</h3><p>${esc(x.sourceText)}</p><button class="ghost" onclick="show('standards');setTimeout(()=>openSection('${x.section}'),40)">Open full section</button></div>`).join("")||'<div class="empty">No matches.</div>'}function lessonCards(a,t){$(t).innerHTML=a.map(l=>`<article class="lesson"><h3>${esc(l.title)}</h3><ul>${l.points.map(p=>`<li>${esc(p)}</li>`).join("")}</ul>${l.example?`<div class="example"><b>Example:</b> ${esc(l.example)}</div>`:""}</article>`).join("")}function renderUsage(){let q=$("#usageSearch").value.toLowerCase();$("#usageContent").innerHTML=D.usagePairs.filter(p=>p.join(" ").toLowerCase().includes(q)).map(p=>`<div class="word-card"><b>${p.map(esc).join(" / ")}</b><p>${esc(p[p.length-1])}</p></div>`).join("")}
let current=[],idx=0,answers=[],mode="teach",quizSessionId="",quizBusy=false;
const COURSE_PATH_TO_CODE={entry:"ENTRY",sergeant:"SERGEANT",lieutenant:"LIEUTENANT",captain:"CAPTAIN",chief:"CHIEF"};
function quizClient(){if(!window.lvxSupabase)throw new Error("Your secure quiz connection is not ready. Please sign in again.");return window.lvxSupabase}
async function quizRequest(payload){const {data,error}=await quizClient().functions.invoke("lvx-quiz",{body:payload});if(error)throw new Error(error.message||"The quiz service could not be reached.");if(data?.error)throw new Error(data.error);return data}
async function startQuiz(t,sec){
  if(quizBusy)return;quizBusy=true;
  try{
    mode=$("#quizMode").value||"teach";
    const courseCode=COURSE_PATH_TO_CODE[activeCourse];
    if(!courseCode)throw new Error("No active course is selected. Choose an enrolled course first.");
    const requested=sec?50:Math.min(50,Math.max(1,Number($("#quizCount").value||10)));
    const data=await quizRequest({action:"start",course_code:courseCode,mode,count:requested});
    if(!data.session_id||!data.question)throw new Error("The quiz service returned an incomplete session.");
    quizSessionId=data.session_id;current=[data.question];idx=0;answers=[];
    $("#quizSetup").classList.add("hidden");$("#quizResults").classList.add("hidden");$("#quizRun").classList.remove("hidden");renderQuestion();
  }catch(error){alert(error.message||"Unable to start quiz.");}
  finally{quizBusy=false;}
}
function renderQuestion(){
  if(idx>=current.length){finishQuiz();return;}
  const q=current[idx];
  $("#quizRun").innerHTML=`<div class="eyebrow">${String(q.track||"PRACTICE").toUpperCase()} • QUESTION ${idx+1}</div><div class="bar"><span style="width:${Math.min(100,idx/Math.max(1,idx+1)*100)}%"></span></div><div class="muted">${esc(q.topic||"")} ${q.section?"• § "+esc(q.section):""}</div><div class="question">${esc(q.prompt)}</div>${(q.choices||[]).map((c,i)=>`<button class="choice" onclick="answerQuestion(${i})">${String.fromCharCode(65+i)}. ${esc(c)}</button>`).join("")}<div id="feedback"></div>`;
}
async function answerQuestion(n){
  if(quizBusy)return;const q=current[idx];if(!q)return;quizBusy=true;
  document.querySelectorAll(".choice").forEach(b=>b.disabled=true);
  try{
    const result=await quizRequest({action:"answer",session_id:quizSessionId,question_id:q.id,selected_index:n});
    const isTeach=mode==="teach";
    const correct=isTeach?String(q.choices[n])===String(result.correct_answer):null;
    const record={id:q.id,topic:q.topic||"",track:q.track||"",section:q.section||"",prompt:q.prompt,selected:n,correct,explain:isTeach?(result.explanation||""):"",answer:isTeach?(result.correct_answer||""):"",date:new Date().toISOString()};
    answers.push(record);
    if(result.completed){finishQuiz();return;}
    if(!result.next_question)throw new Error("The quiz service did not provide the next question.");
    current.push(result.next_question);
    if(isTeach){
      $("#feedback").innerHTML=`<div class="feedback"><b>${correct?"Correct.":"Review this one."}</b><p>${esc(result.explanation||"")}</p><p><b>Correct answer:</b> ${esc(result.correct_answer||"")}</p><button class="primary" onclick="nextQuestion()">Continue</button></div>`;
      document.querySelectorAll(".choice").forEach((b,i)=>{if(i===n)b.classList.add(correct?"correct":"wrong");if(String(q.choices[i])===String(result.correct_answer))b.classList.add("correct");});
    }else{idx++;renderQuestion();}
  }catch(error){alert(error.message||"Your answer could not be submitted. Please try again.");document.querySelectorAll(".choice").forEach(b=>b.disabled=false);}
  finally{quizBusy=false;}
}
function nextQuestion(){idx++;renderQuestion();}
function finishQuiz(){
  const completedMode=mode;const completedAnswers=[...answers];
  if(completedMode==="teach"){
    P.answers.push(...completedAnswers);const correctCount=completedAnswers.filter(a=>a.correct).length;
    P.sessions.unshift({date:new Date().toISOString(),track:activeCourse,count:completedAnswers.length,correct:correctCount});save();
    $("#quizResults").innerHTML=`<div class="eyebrow">AFTER-ACTION REPORT</div><h2>Drill complete</h2><div class="stats"><div class="stat"><b>${correctCount}/${completedAnswers.length}</b><span>Correct answers</span></div><div class="stat"><b>${Math.round(correctCount/Math.max(1,completedAnswers.length)*100)}%</b><span>Drill accuracy</span></div></div><h3>Review</h3>${completedAnswers.map(a=>`<div class="log-row"><b style="color:${a.correct?"var(--green)":"var(--red)"}">${a.correct?"CORRECT":"REVIEW"} • ${esc(a.topic)}</b><p>${esc(a.prompt)}</p>${!a.correct?`<small>Correct answer: ${esc(a.answer)}</small>`:""}<small>${esc(a.explain)}</small></div>`).join("")}<button class="primary" onclick="resetQuiz()">New Drill</button>`;
  }else{
    P.sessions.unshift({date:new Date().toISOString(),track:activeCourse,count:completedAnswers.length,correct:null});save();
    $("#quizResults").innerHTML=`<div class="eyebrow">EXAM SUBMITTED</div><h2>Exam complete</h2><p>Your answers have been submitted and your result has been recorded securely by the academy.</p><p>Your score is not disclosed during exam mode.</p><button class="primary" onclick="resetQuiz()">Return to quiz setup</button>`;
  }
  $("#quizRun").classList.add("hidden");$("#quizResults").classList.remove("hidden");renderDash();
}
function resetQuiz(){$("#quizSetup").classList.remove("hidden");$("#quizResults").classList.add("hidden");$("#quizRun").classList.add("hidden");quizSessionId="";current=[];answers=[];idx=0;}
function renderWeak(){let ts=Object.entries(stats()).sort((a,b)=>b[1].w-a[1].w);$("#weaknessStats").innerHTML=[[P.answers.length,"Total attempts"],[P.answers.filter(a=>!a.correct).length,"Incorrect answers"],[acc()+"%","Overall accuracy"],[P.sessions.length,"Completed drills"]].map(x=>`<div class="stat"><b>${x[0]}</b><span>${x[1]}</span></div>`).join("");$("#weakTopics").innerHTML=ts.length?ts.map(([k,v])=>`<div class="log-row"><b>${esc(k)}</b><small>${v.w} wrong / ${v.n} attempted</small><div class="bar"><span style="width:${100*v.w/Math.max(1,v.n)}%"></span></div></div>`).join(""):'<div class="empty">No data yet.</div>';let wrong=P.answers.filter(a=>!a.correct).slice(-20).reverse();$("#mistakes").innerHTML=wrong.length?wrong.map(a=>`<div class="log-row"><b>${esc(a.topic)} ${a.section?"• § "+a.section:""}</b><small>${new Date(a.date).toLocaleString()}</small>${esc(a.prompt)}<small>Correct answer: ${esc(a.answer)}</small><small>${esc(a.explain)}</small></div>`).join(""):'<div class="empty">No mistakes recorded.</div>'}function clearHistory(){if(confirm("Clear all answer history and study sessions on this browser?")){P.answers=[];P.sessions=[];save();renderWeak();renderDash()}}const planItems=["Review 5 minimum-standards sections","Memorize 5 numbers or deadlines","Complete 10 grammar / usage questions","Complete 5 written-material questions","Review every missed question"];function renderPlan(){$("#planChecks").innerHTML=planItems.map((x,i)=>`<label class="checkrow"><input type="checkbox" id="plan${i}" ${P.plan[i]?"checked":""}>${x}</label>`).join("");$("#studyNotes").value=P.notes||"";$("#sessionHistory").innerHTML=P.sessions.slice(0,15).map(s=>`<div class="log-row">${new Date(s.date).toLocaleString()}<small>${esc(s.track)} • ${s.correct}/${s.count} correct</small></div>`).join("")||'<div class="empty">No completed sessions yet.</div>'}function savePlan(){planItems.forEach((x,i)=>P.plan[i]=$("#plan"+i).checked);save();alert("Today's checklist saved on this device.")}function saveNotes(){P.notes=$("#studyNotes").value;save();alert("Notes saved on this device.")}function exportProgress(){let b=new Blob([JSON.stringify(P,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(b);a.download="lvx-study-progress.json";a.click();URL.revokeObjectURL(a.href)}$("#exportBtn").onclick=exportProgress;$("#timeSearch").oninput=renderTimes;$("#timePart").onchange=renderTimes;$("#usageSearch").oninput=renderUsage;function init(){renderLearning();renderDash();renderStandards();renderTimes();lessonCards(D.grammarLessons,"#grammarContent");renderUsage();lessonCards(D.punctuationLessons,"#punctuationContent");lessonCards(D.writingLessons,"#writtenContent");$("#streak").textContent="SECURE QUIZ CONNECTION READY"}init();