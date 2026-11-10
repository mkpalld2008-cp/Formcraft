import { addDoc, collection, doc, getDoc, serverTimestamp, updateDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { auth, db, configured } from "./firebase.js";
import { TYPES, esc, surveyUrl, queryId } from "./shared.js";

const list = document.querySelector("#question-list");
const message = document.querySelector("#builder-message");
const count = document.querySelector("#question-count");
const title = document.querySelector("#survey-title");
const description = document.querySelector("#survey-description");
const editingId = queryId();
let questions = [];

if (!configured) {
  message.innerHTML = `<div class="inline-error">Firebase is not configured. Update <code>js/firebase-config.js</code>.</div>`;
} else {
  const user = await new Promise(resolve => {
    const unsubscribe = onAuthStateChanged(auth, currentUser => { unsubscribe(); resolve(currentUser); });
  });
  if (!user) {
    location.replace(new URL("index.html?signin=1", location.href).href);
  } else {
    await startBuilder(user);
  }
}

async function startBuilder(user) {
  if (editingId) {
    try {
      const snapshot = await getDoc(doc(db, "users", user.uid, "surveys", editingId));
      if (!snapshot.exists() || snapshot.data().status === "removed") {
        message.innerHTML = `<div class="inline-error">Survey not found or no longer available.</div>`;
      } else {
        const data = snapshot.data();
        title.value = data.title || "";
        description.value = data.description || "";
        questions = data.questions || [];
        renderQuestions();
      }
    } catch (error) {
      message.innerHTML = `<div class="inline-error">${esc(error.message)}</div>`;
    }
  }

  document.querySelector("#add-question").addEventListener("click", () => {
    if (questions.length >= 50) {
      message.innerHTML = `<div class="inline-error">A survey can have at most 50 questions.</div>`;
      return;
    }
    questions.push({ title: "", type: "short", required: false, options: ["Option 1", "Option 2"] });
    renderQuestions();
    list.lastElementChild?.querySelector(".question-title")?.focus();
  });

  list.addEventListener("input", event => {
    const card = event.target.closest(".question-card");
    if (!card) return;
    const question = questions[Number(card.dataset.index)];
    if (event.target.matches("[data-field]")) question[event.target.dataset.field] = event.target.value;
    if (event.target.matches(".question-options")) question.options = event.target.value.split("\n").map(value => value.trim()).filter(Boolean);
  });

  list.addEventListener("change", event => {
    const card = event.target.closest(".question-card");
    if (!card) return;
    const index = Number(card.dataset.index);
    const question = questions[index];
    if (event.target.matches(".question-type")) {
      question.type = event.target.value;
      renderQuestions();
    }
    if (event.target.matches(".required-toggle")) question.required = event.target.checked;
  });

  list.addEventListener("click", event => {
    const card = event.target.closest(".question-card");
    if (!card) return;
    const index = Number(card.dataset.index);
    if (event.target.closest(".remove-question")) questions.splice(index, 1);
    else if (event.target.closest(".move-up") && index > 0) [questions[index - 1], questions[index]] = [questions[index], questions[index - 1]];
    else if (event.target.closest(".move-down") && index < questions.length - 1) [questions[index + 1], questions[index]] = [questions[index], questions[index + 1]];
    else return;
    renderQuestions();
  });

  document.querySelector("#save-survey").addEventListener("click", () => saveSurvey(user));
  document.querySelector("#copy-link").addEventListener("click", async () => {
    const input = document.querySelector("#share-url");
    try {
      await navigator.clipboard.writeText(input.value);
      document.querySelector("#copy-status").textContent = "Copied to clipboard.";
    } catch {
      input.select();
      document.execCommand("copy");
      document.querySelector("#copy-status").textContent = "Copied to clipboard.";
    }
  });
  document.querySelector("#close-dialog").addEventListener("click", () => document.querySelector("#share-dialog").close());
  renderQuestions();
}

function renderQuestions() {
  count.textContent = `${questions.length} ${questions.length === 1 ? "question" : "questions"}`;
  if (!questions.length) {
    list.innerHTML = `<div class="empty-questions"><span>✳</span><p>Your questions will appear here.</p><p class="small">Add your first question to get started.</p></div>`;
    return;
  }
  list.innerHTML = questions.map((question, index) => `<article class="question-card" data-index="${index}">
    <div class="question-top"><span class="drag-handle" aria-hidden="true">⠿</span><span class="question-number">QUESTION ${String(index + 1).padStart(2, "0")}</span>
      <div class="question-move"><button class="icon-button move-up" aria-label="Move question up" type="button" ${index === 0 ? "disabled" : ""}>↑</button>
      <button class="icon-button move-down" aria-label="Move question down" type="button" ${index === questions.length - 1 ? "disabled" : ""}>↓</button>
      <button class="icon-button remove-question" aria-label="Remove question" type="button">×</button></div>
    </div>
    <label class="field-label" for="q-title-${index}">Question <span class="required-mark">*</span></label>
    <input id="q-title-${index}" class="text-input question-title" data-field="title" value="${esc(question.title)}" maxlength="240" placeholder="Write your question">
    <div class="question-settings"><label class="field-label" for="q-type-${index}">Answer type</label>
      <select id="q-type-${index}" class="text-input question-type" data-field="type">${TYPES.map(([value, label]) => `<option value="${value}" ${question.type === value ? "selected" : ""}>${label}</option>`).join("")}</select>
      <label class="toggle-label"><input class="required-toggle" type="checkbox" ${question.required ? "checked" : ""}><span class="toggle"></span>Required</label>
    </div>
    ${["choice", "checkboxes", "dropdown"].includes(question.type) ? `<div class="options-area"><label class="field-label" for="q-options-${index}">Answer options <span class="optional">One per line · at least 2</span></label>
      <textarea id="q-options-${index}" class="text-input question-options" rows="3" placeholder="Option one\nOption two">${esc((question.options || ["Option 1", "Option 2"]).join("\n"))}</textarea></div>` : ""}
    ${question.type === "file" ? `<p class="upload-hint">Respondents can attach up to 5 files (10 MB each). Allowed: PDF, common images, and Word, Excel, or PowerPoint files.</p>` : ""}
  </article>`).join("");
}

async function saveSurvey(user) {
  message.textContent = "";
  const cleanQuestions = questions.map(question => ({ ...question, options: question.options || [] }));
  if (!title.value.trim()) {
    title.focus();
    message.innerHTML = `<div class="inline-error">Give your survey a title before saving.</div>`;
    return;
  }
  if (!cleanQuestions.length) {
    message.innerHTML = `<div class="inline-error">Add at least one question.</div>`;
    return;
  }
  const invalidIndex = cleanQuestions.findIndex(question => !question.title.trim() || (["choice", "checkboxes", "dropdown"].includes(question.type) && question.options.length < 2));
  if (invalidIndex >= 0) {
    list.children[invalidIndex]?.scrollIntoView({ behavior: "smooth", block: "center" });
    list.children[invalidIndex]?.querySelector(".question-title")?.focus();
    message.innerHTML = `<div class="inline-error">Question ${invalidIndex + 1} needs a prompt, and choice questions need at least two options.</div>`;
    return;
  }

  const button = document.querySelector("#save-survey");
  button.disabled = true;
  button.textContent = "Saving…";
  try {
    const data = { title: title.value.trim(), description: description.value.trim(), questions: cleanQuestions, status: "published", ownerId: user.uid, updatedAt: serverTimestamp() };
    let id = editingId;
    if (id) await updateDoc(doc(db, "users", user.uid, "surveys", id), data);
    else id = (await addDoc(collection(db, "users", user.uid, "surveys"), { ...data, createdAt: serverTimestamp(), responseCount: 0 })).id;
    const url = surveyUrl(id, user.uid);
    document.querySelector("#share-url").value = url;
    document.querySelector("#open-survey").href = url;
    document.querySelector("#share-dialog").showModal();
  } catch (error) {
    message.innerHTML = `<div class="inline-error">Couldn’t save: ${esc(error.message)}</div>`;
  } finally {
    button.disabled = false;
    button.innerHTML = "Save survey <span aria-hidden=\"true\">→</span>";
  }
}
