import { collection, doc, getDocs, orderBy, query, getDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { auth, db, configured, showConfigError } from "./firebase.js";
import { supabase, FILE_BUCKET } from "./supabase.js";
import { esc, formatDate, queryId, surveyUrl } from "./shared.js";

const root = document.querySelector("#results-state");
const surveyId = queryId();

if (!configured) showConfigError(root);
else if (!surveyId) showMessage("Choose a survey", "Open the results dashboard from one of your surveys.");
else onAuthStateChanged(auth, user => {
  if (!user) {
    root.innerHTML = `<div class="empty-state"><h2>Sign in to view results</h2><p>Survey results are private to their creator.</p><a class="button button-primary" href="index.html">Sign in</a></div>`;
    return;
  }
  loadResults(user).catch(error => {
    root.innerHTML = `<div class="error-state"><h2>Couldn’t load results</h2><p>${esc(error.message)}. Check that you own this survey and Firestore rules are published.</p><a class="button button-secondary" href="index.html">Back to surveys</a></div>`;
  });
});

async function loadResults(user) {
  const surveyRef = doc(db, "users", user.uid, "surveys", surveyId);
  const snapshot = await getDoc(surveyRef);
  if (!snapshot.exists() || snapshot.data().status === "removed") throw new Error("Survey not found or no longer available.");
  const survey = snapshot.data();
  const responseSnapshot = await getDocs(query(collection(db, "users", user.uid, "surveys", surveyId, "responses"), orderBy("submittedAt", "asc")));
  const responses = await Promise.all(responseSnapshot.docs.map(async item => {
    const response = item.data();
    for (const [index, question] of survey.questions.entries()) {
      if (question.type !== "file") continue;
      const answer = response.answers?.[question.id || String(index)];
      if (!Array.isArray(answer?.value)) continue;
      const allowedPrefix = `${user.uid}/${surveyId}/${item.id}/`;
      answer.value = await Promise.all(answer.value.map(async file => ({
        ...file,
        url: supabase && typeof file.path === "string" && file.path.startsWith(allowedPrefix)
          ? supabase.storage.from(FILE_BUCKET).getPublicUrl(file.path).data.publicUrl
          : ""
      })));
    }
    return response;
  }));

  root.innerHTML = `<section class="results-heading"><div><p class="eyebrow">SURVEY RESULTS</p><h1>${esc(survey.title)}</h1><p class="muted">${esc(survey.description || "Response overview and question insights.")}</p></div>
    <div class="results-actions"><a class="button button-secondary" href="${esc(surveyUrl(surveyId, user.uid))}">Open survey ↗</a><button id="export-csv" class="button button-primary" type="button">↓ Export CSV</button></div></section>
    <section class="stats-grid"><article class="stat-card"><span class="stat-label">TOTAL RESPONSES</span><strong>${responses.length}</strong><span class="stat-foot">All submitted responses</span></article>
    <article class="stat-card"><span class="stat-label">QUESTIONS</span><strong>${survey.questions?.length || 0}</strong><span class="stat-foot">In this survey</span></article>
    <article class="stat-card"><span class="stat-label">LATEST RESPONSE</span><strong class="stat-date">${responses.length ? esc(formatDate(responses.at(-1).submittedAt)) : "—"}</strong><span class="stat-foot">Based on submission time</span></article></section>
    ${responses.length ? `<section class="answers-section"><div class="section-heading"><div><h2>Question breakdown</h2><p class="muted">Only you can see these answers.</p></div></div><div id="question-results" class="result-list">${survey.questions.map((question, index) => renderQuestion(question, index, responses)).join("")}</div></section>` :
      `<div class="empty-state results-empty"><span class="empty-icon">◷</span><h2>No responses yet</h2><p>Share your survey link to collect responses.</p><a class="button button-secondary" href="${esc(surveyUrl(surveyId, user.uid))}">Open survey</a></div>`}`;

  document.querySelector("#export-csv").addEventListener("click", () => exportCsv(survey, responses));
  for (const [index, question] of survey.questions.entries()) {
    if (!["choice", "checkboxes", "dropdown"].includes(question.type)) continue;
    const canvas = document.querySelector(`#chart-${index}`);
    if (!canvas) continue;
    const counts = Object.fromEntries((question.options || []).map(option => [option, 0]));
    for (const response of responses) {
      const value = response.answers?.[question.id || String(index)]?.value;
      for (const answer of Array.isArray(value) ? value : [value]) if (answer in counts) counts[answer]++;
    }
    new Chart(canvas, { type: "bar", data: { labels: Object.keys(counts), datasets: [{ data: Object.values(counts), backgroundColor: ["#9c8cff", "#60d6bd", "#ffbc7b", "#ff7c9b", "#68b9ff", "#cf8dff"], borderRadius: 8, borderSkipped: false }] }, options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0, color: "#9ba3bc" }, grid: { color: "#242a3e" } }, x: { ticks: { color: "#c7cbe0" }, grid: { display: false } } } } });
  }
}

function showMessage(title, body) {
  root.innerHTML = `<div class="empty-state"><h2>${esc(title)}</h2><p>${esc(body)}</p><a class="button button-secondary" href="index.html">Back to surveys</a></div>`;
}

function renderQuestion(question, index, responses) {
  const answers = responses.map(response => response.answers?.[question.id || String(index)]?.value)
    .filter(value => value !== undefined && value !== "" && !(question.type === "file" && Array.isArray(value) && !value.length));
  const heading = `<div class="result-card-heading"><div><span class="question-number">QUESTION ${String(index + 1).padStart(2, "0")}</span><h3>${esc(question.title)}</h3></div><span class="answer-count">${answers.length} answers</span></div>`;
  if (["choice", "checkboxes", "dropdown"].includes(question.type)) return `<article class="result-card">${heading}<div class="chart-wrap"><canvas id="chart-${index}" aria-label="Bar chart for ${esc(question.title)}" role="img"></canvas></div></article>`;
  if (question.type === "rating") {
    const ratings = answers.map(Number).filter(Number.isFinite);
    const average = ratings.length ? (ratings.reduce((total, value) => total + value, 0) / ratings.length).toFixed(1) : "—";
    return `<article class="result-card">${heading}<div class="rating-summary"><strong>${average}</strong><span class="rating-stars">★★★★★</span><span class="muted small">Average rating out of 5</span></div></article>`;
  }
  if (question.type === "file") return `<article class="result-card">${heading}${answers.length ? `<ul class="text-answer-list">${answers.slice(-40).reverse().flatMap(value => (Array.isArray(value) ? value : []).map(file => `<li>${file.url ? `<a class="file-answer-link" href="${esc(file.url)}" target="_blank" rel="noopener noreferrer">↗ ${esc(file.name)}</a>` : esc(file.name)}<span class="file-answer-size">${formatFileSize(file.size)}</span></li>`)).join("")}</ul>` : `<p class="muted small">No files attached.</p>`}</article>`;
  return `<article class="result-card">${heading}${answers.length ? `<ul class="text-answer-list">${answers.slice(-40).reverse().map(value => `<li>${esc(Array.isArray(value) ? value.join(", ") : value)}</li>`).join("")}</ul>` : `<p class="muted small">No answers yet.</p>`}</article>`;
}

function formatFileSize(bytes = 0) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function exportCsv(survey, responses) {
  const columns = survey.questions.flatMap((question, index) => {
    if (question.type === "file") return Array.from({ length: 5 }, (_, fileIndex) => {
      const fileFor = response => response.answers?.[question.id || String(index)]?.value?.[fileIndex];
      return [
        { title: `${question.title} (file ${fileIndex + 1} name)`, value: response => fileFor(response)?.name || "" },
        { title: `${question.title} (file ${fileIndex + 1} URL)`, value: response => fileFor(response)?.url || "" }
      ];
    }).flat();
    return [{
      title: question.title,
      value: response => {
        const answer = response.answers?.[question.id || String(index)]?.value;
        return Array.isArray(answer) ? answer.join("; ") : answer ?? "";
      }
    }];
  });
  const rows = [
    ["Submitted at", ...columns.map(column => column.title)],
    ...responses.map(response => [response.submittedAt?.toDate?.().toISOString() || "", ...columns.map(column => column.value(response))])
  ];
  const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${(survey.title || "survey").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-responses.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}
