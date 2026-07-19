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
const activeSkillName = document.getElementById("activeSkillName");
const activeSkillDescription = document.getElementById("activeSkillDescription");
const activeSkillSelect = document.getElementById("activeSkillSelect");
const importTargetSelect = document.getElementById("importTargetSelect");
const customImportTarget = document.getElementById("customImportTarget");
const ACTIVE_SKILL_STORAGE_KEY = "conductor-active-skill";
const CUSTOM_IMPORT_TARGET = "__custom__";

let skills = [];
let selectedSkill = null;
let selectedFile = null;
let currentContent = "";
let toastTimer = null;
let activeImportTarget = "";

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
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const payload = await res.json();
  if (!res.ok) {
    const error = new Error(payload.error || `Request failed: ${res.status}`);
    error.status = res.status;
    throw error;
  }
  return payload;
}

async function requestSkillChange(body) {
  return apiFetch("/api/skill-change-requests", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function persistActiveSkill(name) {
  try {
    if (name) {
      window.localStorage.setItem(ACTIVE_SKILL_STORAGE_KEY, name);
    } else {
      window.localStorage.removeItem(ACTIVE_SKILL_STORAGE_KEY);
    }
  } catch {}
}

function readStoredActiveSkill() {
  try {
    return window.localStorage.getItem(ACTIVE_SKILL_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function renderActiveSkillSelect() {
  if (!activeSkillSelect) return;
  activeSkillSelect.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Select a skill";
  activeSkillSelect.appendChild(placeholder);

  for (const skill of skills) {
    const option = document.createElement("option");
    option.value = skill.name;
    option.textContent = skill.name;
    activeSkillSelect.appendChild(option);
  }

  activeSkillSelect.value = selectedSkill || readStoredActiveSkill() || "";
}

function renderImportTargets() {
  if (!importTargetSelect) return;

  if (!selectedSkill) {
    importTargetSelect.innerHTML = '<option value="">Choose import target</option>';
    importTargetSelect.disabled = true;
    customImportTarget.hidden = true;
    return;
  }

  const options = Array.from(new Set([`${selectedSkill}-imported`, selectedSkill, `${selectedSkill}-workspace`]));
  importTargetSelect.innerHTML = "";

  for (const optionValue of options) {
    const option = document.createElement("option");
    option.value = optionValue;
    option.textContent = optionValue;
    importTargetSelect.appendChild(option);
  }

  const customOption = document.createElement("option");
  customOption.value = CUSTOM_IMPORT_TARGET;
  customOption.textContent = "Custom workspace…";
  importTargetSelect.appendChild(customOption);

  importTargetSelect.disabled = false;
  importTargetSelect.value = activeImportTarget && (options.includes(activeImportTarget) || activeImportTarget === CUSTOM_IMPORT_TARGET)
    ? activeImportTarget
    : options[0];

  customImportTarget.hidden = importTargetSelect.value !== CUSTOM_IMPORT_TARGET;
  if (!customImportTarget.hidden) {
    customImportTarget.focus();
  }
}

function updateActiveSkillSurface() {
  const current = skills.find((skill) => skill.name === selectedSkill) || null;
  activeSkillName.textContent = current?.name || "No skill selected";
  activeSkillDescription.textContent =
    current?.description || "Select a skill from the dropdown so the current working skill stays visible.";
  renderActiveSkillSelect();
  renderImportTargets();
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
  renderActiveSkillSelect();
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
    const stored = readStoredActiveSkill();
    if (!selectedSkill && stored && skills.some((skill) => skill.name === stored)) {
      selectedSkill = stored;
    } else if (!selectedSkill && skills[0]) {
      selectedSkill = skills[0].name;
    }
    renderSkills();
    updateActiveSkillSurface();
    if (selectedSkill && skills.some((skill) => skill.name === selectedSkill)) {
      await selectSkill(selectedSkill);
    }
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
  persistActiveSkill(name);
  renderSkills();
  updateActiveSkillSurface();
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
    if (error.status === 403) {
      try {
        await requestSkillChange({
          type: "SKILL_FILE_UPDATE",
          skillName: selectedSkill,
          path: selectedFile,
          content,
        });
        setStatus(`Approval requested for ${selectedFile}`, "success");
        showToast(`Approval requested for ${selectedFile}`, "success");
        return;
      } catch (requestError) {
        setStatus(requestError.message, "error");
        showToast(requestError.message, "error");
        return;
      }
    }
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
    if (error.status === 403) {
      try {
        await requestSkillChange({
          type: "SKILL_CREATE",
          skillName: name,
          description,
        });
        setStatus(`Approval requested for skill ${name}`, "success");
        showToast(`Approval requested for skill ${name}`, "success");
        return;
      } catch (requestError) {
        setStatus(requestError.message, "error");
        showToast(requestError.message, "error");
        return;
      }
    }
    setStatus(error.message, "error");
    showToast(error.message, "error");
  }
}

async function importSkill() {
  if (!selectedSkill) return;
  const targetName =
    importTargetSelect.value === CUSTOM_IMPORT_TARGET ? customImportTarget.value.trim() : importTargetSelect.value.trim();
  if (!targetName) {
    showToast("Choose an import target first.", "error");
    return;
  }

  try {
    const result = await apiFetch("/api/import", {
      method: "POST",
      body: JSON.stringify({ skillName: selectedSkill, targetName }),
    });
    setStatus(`Imported to ${result.path}`, "success");
    showToast(`Imported to ${result.path}`, "success");
    activeImportTarget = result.path;
    renderImportTargets();
  } catch (error) {
    if (error.status === 403) {
      try {
        await requestSkillChange({
          type: "SKILL_IMPORT",
          skillName: selectedSkill,
          targetName,
        });
        setStatus(`Approval requested to import ${selectedSkill}`, "success");
        showToast(`Approval requested to import ${selectedSkill}`, "success");
        return;
      } catch (requestError) {
        setStatus(requestError.message, "error");
        showToast(requestError.message, "error");
        return;
      }
    }
    setStatus(error.message, "error");
  }
}

activeSkillSelect.addEventListener("change", async () => {
  const name = activeSkillSelect.value;
  if (!name) return;
  await selectSkill(name);
});

importTargetSelect.addEventListener("change", () => {
  activeImportTarget = importTargetSelect.value;
  customImportTarget.hidden = importTargetSelect.value !== CUSTOM_IMPORT_TARGET;
});

customImportTarget.addEventListener("input", () => {
  activeImportTarget = customImportTarget.value.trim();
});

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
