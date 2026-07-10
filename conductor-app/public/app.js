const searchInput = document.getElementById("searchInput");
const skillsList = document.getElementById("skillsList");
const fileList = document.getElementById("fileList");
const editorTextarea = document.getElementById("editorTextarea");
const editorTitle = document.getElementById("editorTitle");
const editorSubtitle = document.getElementById("editorSubtitle");
const newSkillButton = document.getElementById("newSkillButton");
const importButton = document.getElementById("importButton");
const previewButton = document.getElementById("previewButton");
const saveButton = document.getElementById("saveButton");
const reloadButton = document.getElementById("reloadButton");
const statusMessage = document.getElementById("statusMessage");
const toast = document.getElementById("toast");

let skills = [];
let selectedSkill = null;
let selectedFile = null;
let currentContent = "";
let toastTimer = null;

function setStatus(message, type = "info") {
  statusMessage.textContent = message;
  statusMessage.style.color = type === "error" ? "#fca5a5" : type === "success" ? "#86efac" : "#a5f3fc";
}

function showToast(message, type = "info") {
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast visible ${type}`;
  if (toastTimer) {
    clearTimeout(toastTimer);
  }
  toastTimer = setTimeout(() => {
    toast.className = "toast";
  }, 3200);
}

async function apiFetch(path, options) {
  const userId = window.localStorage.getItem("skillsConductorUserId") || "dev-user";
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", "x-user-id": userId },
    ...options,
  });
  const payload = await res.json();
  if (!res.ok) {
    throw new Error(payload.error || `Request failed: ${res.status}`);
  }
  return payload;
}

function renderSkills() {
  skillsList.innerHTML = "";
  for (const skill of skills) {
    const item = document.createElement("li");
    item.className = "skill-item";
    item.dataset.skill = skill.name;

    const title = document.createElement("p");
    title.className = "skill-item-title";
    title.textContent = skill.name;

    const subtitle = document.createElement("p");
    subtitle.className = "skill-item-subtitle";
    subtitle.textContent = skill.description || "No description";

    item.append(title, subtitle);
    item.addEventListener("click", async () => {
      await selectSkill(skill.name);
    });

    if (selectedSkill === skill.name) {
      item.classList.add("active");
    }

    skillsList.appendChild(item);
  }
}

function renderFileTree(files) {
  fileList.innerHTML = "";
  for (const file of files) {
    const item = document.createElement("li");
    item.className = "file-item";
    item.dataset.path = file.path;

    const title = document.createElement("p");
    title.className = "skill-item-title";
    title.textContent = file.name;

    const subtitle = document.createElement("p");
    subtitle.className = "file-item-subtitle";
    subtitle.textContent = file.type === "skill" ? "SKILL metadata" : "Reference document";

    item.append(title, subtitle);
    item.addEventListener("click", async () => {
      await selectFile(file.path);
    });

    if (selectedFile === file.path) {
      item.classList.add("active");
    }

    fileList.appendChild(item);
  }
}

async function loadSkills(query = "") {
  try {
    const encoded = query ? `?q=${encodeURIComponent(query)}` : "";
    skills = await apiFetch(`/api/skills${encoded}`);
    renderSkills();
  } catch (error) {
    editorTitle.textContent = "Unable to load skills";
    editorSubtitle.textContent = error.message;
    editorTextarea.value = "";
    setStatus(error.message, "error");
  }
}

async function selectSkill(name) {
  selectedSkill = name;
  selectedFile = null;
  renderSkills();
  editorTitle.textContent = name;
  editorSubtitle.textContent = "Loading files...";
  setStatus("Selected skill: " + name);
  saveButton.disabled = true;
  previewButton.disabled = false;
  importButton.disabled = false;

  try {
    const files = await apiFetch(`/api/skills/${encodeURIComponent(name)}/files`);
    renderFileTree(files);
    if (files.length > 0) {
      await selectFile(files[0].path);
    } else {
      editorSubtitle.textContent = "No files available for this skill.";
      editorTextarea.value = "";
      editorTextarea.readOnly = true;
    }
  } catch (error) {
    editorSubtitle.textContent = error.message;
    editorTextarea.value = "";
    setStatus(error.message, "error");
  }
}

async function selectFile(path) {
  if (!selectedSkill) return;
  selectedFile = path;
  renderSkills();
  renderFileTree(await apiFetch(`/api/skills/${encodeURIComponent(selectedSkill)}/files`));
  editorTitle.textContent = `${selectedSkill} / ${selectedFile}`;
  editorSubtitle.textContent = `Editing ${selectedFile}`;
  saveButton.disabled = false;
  previewButton.disabled = false;
  importButton.disabled = false;

  try {
    const file = await apiFetch(
      `/api/skills/${encodeURIComponent(selectedSkill)}/file?path=${encodeURIComponent(selectedFile)}`
    );
    currentContent = file.content;
    editorTextarea.value = currentContent;
    editorTextarea.readOnly = false;
    setStatus(`Loaded ${selectedFile}`);
  } catch (error) {
    editorTextarea.value = "";
    editorTextarea.readOnly = true;
    setStatus(error.message, "error");
  }
}

async function previewSkill() {
  if (!selectedSkill) return;
  try {
    const data = await apiFetch(`/api/skills/${encodeURIComponent(selectedSkill)}`);
    const sections = [
      `--- ${selectedSkill}/SKILL.md ---`,
      data.skill.trim(),
      ...data.references.map(
        (ref) => `--- ${selectedSkill}/references/${ref.name} ---\n\n${ref.content.trim()}`
      ),
    ].join("\n\n");
    editorTitle.textContent = `${selectedSkill} / preview`;
    editorSubtitle.textContent = "Combined skill output";
    editorTextarea.value = sections;
    editorTextarea.readOnly = true;
    saveButton.disabled = true;
    setStatus("Preview mode. Save disabled until you select a file again.");
    showToast(`Previewing ${selectedSkill}`, "info");
  } catch (error) {
    setStatus(error.message, "error");
    showToast(error.message, "error");
  }
}

async function saveCurrentFile() {
  if (!selectedSkill || !selectedFile) return;
  const content = editorTextarea.value;
  try {
    await apiFetch(`/api/skills/${encodeURIComponent(selectedSkill)}/file`, {
      method: "POST",
      body: JSON.stringify({ path: selectedFile, content }),
    });
    currentContent = content;
    setStatus(`Saved ${selectedFile}`, "success");
    showToast(`Saved ${selectedFile}`, "success");
  } catch (error) {
    setStatus(error.message, "error");
    showToast(error.message, "error");
  }
}

async function createSkillFlow() {
  const rawName = window.prompt("Enter a new skill name (letters, numbers, hyphens, underscores):");
  if (rawName === null) return;
  const name = rawName.trim();
  if (!name) {
    showToast("Skill name is required.", "error");
    return;
  }
  const description = window.prompt("Enter a short description for the new skill:", "New skill description") || "New skill description";

  try {
    const result = await apiFetch("/api/skills", {
      method: "POST",
      body: JSON.stringify({ skillName: name, description }),
    });
    setStatus(`Created skill ${result.skillName}`, "success");
    showToast(`Created skill ${result.skillName}`, "success");
    await loadSkills();
    await selectSkill(result.skillName);
  } catch (error) {
    setStatus(error.message, "error");
    showToast(error.message, "error");
  }
}

async function importSkill() {
  if (!selectedSkill) return;
  const targetName = window.prompt(
    `Enter destination folder name for imported skill (default: ${selectedSkill}):`,
    selectedSkill
  );
  if (targetName === null) return;

  try {
    const result = await apiFetch("/api/import", {
      method: "POST",
      body: JSON.stringify({ skillName: selectedSkill, targetName }),
    });
    setStatus(`Imported to ${result.path}`, "success");
  } catch (error) {
    setStatus(error.message, "error");
  }
}

searchInput.addEventListener("input", () => {
  loadSkills(searchInput.value.trim());
});

reloadButton.addEventListener("click", () => {
  searchInput.value = "";
  loadSkills();
});

newSkillButton.addEventListener("click", async () => {
  await createSkillFlow();
});

previewButton.addEventListener("click", async () => {
  if (!selectedSkill) {
    window.alert("Select a skill first.");
    return;
  }
  await previewSkill();
});

saveButton.addEventListener("click", async () => {
  if (!selectedSkill || !selectedFile) {
    window.alert("Select a file to save.");
    return;
  }
  await saveCurrentFile();
});

importButton.addEventListener("click", async () => {
  if (!selectedSkill) {
    window.alert("Select a skill first.");
    return;
  }
  await importSkill();
});

loadSkills();
