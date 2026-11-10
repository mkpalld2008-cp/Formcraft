import { collection, doc, getDoc, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { ref, uploadBytes } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";
import { db, storage, configured, showConfigError } from "./firebase.js";
import { esc, queryId, queryOwner } from "./shared.js";

const state = document.querySelector("#survey-state");
const id = queryId();
const ownerId = queryOwner();

if (!configured) showConfigError(state, " and publish your Firestore rules");
else if (!id || !ownerId) {
  state.innerHTML = `<div class="empty-state"><h2>Survey link is incomplete</h2><p>Ask the survey owner for a complete link.</p></div>`;
} else try {
  const surveyRef = doc(db, "users", ownerId, "surveys", id);
  const snapshot = await getDoc(surveyRef);
  if (!snapshot.exists()) {
    state.innerHTML = `<div class="empty-state"><h2>Survey not found</h2><p>This link may be incorrect or the survey is no longer available.</p></div>`;
  } else {
    const survey = snapshot.data();
    if (survey.removedAt) {
      state.innerHTML = `<div class="empty-state"><h2>This survey is no longer available</h2><p>The survey host has removed it from their survey list.</p></div>`;
    } else {
      document.title = `${survey.title} · Formcraft`;
      state.innerHTML = `<div class="public-kicker"><span class="brand-mark">F</span> FORMCRAFT SURVEY</div>
        <h1>${esc(survey.title)}</h1>${survey.description ? `<p class="public-description">${esc(survey.description)}</p>` : ""}
        <div class="public-divider"></div>
        <form id="response-form" novalidate>
          ${(survey.questions || []).map((question, index) => `<div class="response-question">
            <label class="field-label" for="answer-${index}">${esc(question.title)} ${question.required ? `<span class="required-mark">*</span>` : `<span class="optional">Optional</span>`}</label>
            ${answerControl(question, index)}
          </div>`).join("")}
          <div id="form-error" class="inline-error" role="alert"></div>
          <button class="button button-primary button-large" type="submit">Submit response <span aria-hidden="true">→</span></button>
        </form>
        <p class="privacy-note">Your response is shared with the survey creator.</p>`;
      document.querySelector("#response-form").addEventListener("submit", event => submitResponse(event, survey, ownerId, id));
    }
  }
} catch (error) {
  state.innerHTML = `<div class="error-state"><h2>Couldn’t load this survey</h2><p>${esc(error.message)}. Check your Firebase configuration and Firestore rules.</p></div>`;
}

async function submitResponse(event, survey, ownerId, surveyId) {
  event.preventDefault();
  const form = event.currentTarget;
  const errorBox = document.querySelector("#form-error");
  const answers = {};

  for (const [index, question] of survey.questions.entries()) {
    const name = `answer-${index}`;
    const value = question.type === "file"
      ? [...(form.elements[name]?.files || [])]
      : question.type === "checkboxes"
      ? [...form.querySelectorAll(`[name="${name}"]:checked`)].map(input => input.value)
      : form.elements[name]?.value?.trim() || "";

    if (question.type === "file" && value.length > MAX_FILES) {
      errorBox.textContent = `Attach no more than ${MAX_FILES} files for: ${question.title}`;
      form.elements[name]?.focus();
      return;
    }
    if (question.type === "file") {
      const invalidFile = value.find(file => file.size > MAX_FILE_SIZE || !isAllowedFile(file));
      if (invalidFile) {
        errorBox.textContent = `${invalidFile.name} is too large or its file type is not supported. Choose a supported file up to 10 MB.`;
        form.elements[name]?.focus();
        return;
      }
    }
    if (question.required && (Array.isArray(value) ? !value.length : !value)) {
      errorBox.textContent = `Please answer: ${question.title}`;
      form.querySelector(`#answer-${index}`)?.focus();
      return;
    }
    answers[question.id || String(index)] = { question: question.title, type: question.type, value };
  }

  const submit = form.querySelector("button[type=submit]");
  submit.disabled = true;
  submit.textContent = "Submitting…";
  try {
    const responseRef = doc(collection(db, "users", ownerId, "surveys", surveyId, "responses"));
    for (const [index, question] of survey.questions.entries()) {
      if (question.type !== "file") continue;
      const answer = answers[question.id || String(index)];
      const files = [];
      for (const file of answer.value) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120) || "attachment";
        const fileRef = ref(storage, `survey-responses/${ownerId}/${surveyId}/${responseRef.id}/${index}-${crypto.randomUUID()}-${safeName}`);
        const contentType = ALLOWED_MIME_TYPES.has(file.type) ? file.type : mimeTypeFromName(file.name);
        await uploadBytes(fileRef, file, { contentType });
        files.push({ name: file.name, path: fileRef.fullPath, size: file.size, type: contentType });
      }
      answer.value = files;
    }
    await setDoc(responseRef, { answers, submittedAt: serverTimestamp() });
    state.innerHTML = `<div class="thank-you"><div class="success-mark">✓</div><p class="eyebrow">RESPONSE RECEIVED</p><h1>Thank you!</h1><p class="muted">Your response has been submitted successfully.</p></div>`;
  } catch (error) {
    errorBox.textContent = `Couldn’t submit your response: ${error.message}`;
    submit.disabled = false;
    submit.innerHTML = `Submit response <span aria-hidden="true">→</span>`;
  }
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 5;
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf", "image/jpeg", "image/png", "image/gif", "image/webp",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation"
]);
const ALLOWED_EXTENSIONS = /\.(pdf|jpe?g|png|gif|webp|docx?|xlsx?|pptx?)$/i;
const mimeTypeFromName = name => ({
  pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp",
  doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation"
})[name.split(".").pop().toLowerCase()] || "application/octet-stream";
const isAllowedFile = file => ALLOWED_MIME_TYPES.has(file.type) || (!file.type && ALLOWED_EXTENSIONS.test(file.name));

function answerControl(question, index) {
  const id = `answer-${index}`;
  const required = question.required ? "required" : "";
  if (question.type === "short") return `<input id="${id}" name="${id}" class="text-input" maxlength="500" placeholder="Type your answer" ${required}>`;
  if (question.type === "paragraph") return `<textarea id="${id}" name="${id}" class="text-input" rows="4" maxlength="3000" placeholder="Type your answer" ${required}></textarea>`;
  if (question.type === "dropdown") return `<select id="${id}" name="${id}" class="text-input" ${required}><option value="">Choose an option</option>${(question.options || []).map(option => `<option value="${esc(option)}">${esc(option)}</option>`).join("")}</select>`;
  if (question.type === "choice") return `<div class="choice-list">${(question.options || []).map((option, optionIndex) => `<label class="choice-option"><input id="${optionIndex ? `${id}-${optionIndex}` : id}" type="radio" name="${id}" value="${esc(option)}" ${required}><span>${esc(option)}</span></label>`).join("")}</div>`;
  if (question.type === "checkboxes") return `<div class="choice-list">${(question.options || []).map((option, optionIndex) => `<label class="choice-option"><input id="${optionIndex ? `${id}-${optionIndex}` : id}" type="checkbox" name="${id}" value="${esc(option)}"><span>${esc(option)}</span></label>`).join("")}</div>`;
  if (question.type === "rating") return `<div class="rating-row" role="radiogroup" aria-label="Rate from 1 to 5">${[1,2,3,4,5].map(number => `<label class="rating-choice"><input id="${id}-${number}" type="radio" name="${id}" value="${number}" ${required}><span>${number}</span></label>`).join("")}</div><div class="rating-labels"><span>Not at all</span><span>Very much</span></div>`;
  if (question.type === "file") return `<input id="${id}" name="${id}" class="text-input file-input" type="file" accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx,.ppt,.pptx" multiple ${required} aria-describedby="${id}-help"><span id="${id}-help" class="upload-hint">Up to 5 files, 10 MB each. PDF, images, Word, Excel, or PowerPoint.</span>`;
  return "";
}
