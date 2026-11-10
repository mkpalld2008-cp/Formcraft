export const TYPES = [
  ["short", "Short text"], ["paragraph", "Paragraph"], ["choice", "Multiple choice"],
  ["checkboxes", "Checkboxes"], ["dropdown", "Dropdown"], ["rating", "Rating (1–5)"], ["file", "File upload"]
];
export const esc = (value = "") => String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
export const surveyUrl = (id, ownerId) => new URL(`survey.html?id=${encodeURIComponent(id)}&owner=${encodeURIComponent(ownerId)}`, location.href).href;
export const formatDate = value => value?.toDate ? value.toDate().toLocaleDateString(undefined, {year:"numeric",month:"short",day:"numeric"}) : "Just now";
export const queryId = () => new URLSearchParams(location.search).get("id");
export const queryOwner = () => new URLSearchParams(location.search).get("owner");
