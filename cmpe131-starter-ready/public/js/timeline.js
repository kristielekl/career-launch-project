const form = document.getElementById("taskCreationForm");
const taskDialog = document.getElementById("taskDialog");
const deleteDialog = document.getElementById("deleteDialog");
const errorMessage = document.getElementById("taskError");
const formError = document.getElementById("taskFormError");
const emptyMessage = document.getElementById("taskEmpty");
const submitButton = document.getElementById("taskCreationSubmitButton");
const formHeading = document.getElementById("taskFormHeading");
const formNote = document.getElementById("taskFormNote");
const hoursInput = document.getElementById("estimatedHours");
const hoursHelp = document.getElementById("hoursHelp");
const createButton = document.getElementById("taskCreationOpenButton");
const timeline = document.getElementById("taskTimeline");
let taskLoadVersion = 0;
let editingTask = null;
let busy = false;
let opener = null; // Control that opened a dialog; focus returns to it on close.

async function request(options, id = "") {
  const response = await fetch(`/api/tasks${id === "" ? "" : `/${id}`}`, options);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.errors?.join(" ") || data.error || "Unable to load tasks.");
  }
  return data;
}

function isOverdue(task) {
  const now = new Date();
  const today = `${now.getFullYear().toString().padStart(4, "0")}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return task.status !== "Completed" && task.dueDate < today;
}

// Decorative icon; see the .i-* mask rules in styles.css.
function icon(name, size = "ico-sm") {
  const span = document.createElement("span");
  span.className = `ico i-${name} ${size}`;
  span.setAttribute("aria-hidden", "true");
  return span;
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// Keep date-only values independent of local time-zone calendar changes.
function dateParts(value) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  const format = options => date.toLocaleDateString(undefined, { ...options, timeZone: "UTC" });
  return {
    weekday: format({ weekday: "short" }), day: String(date.getUTCDate()),
    long: format({ month: "short", day: "numeric", year: "numeric" }),
    month: format({ month: "long", year: "numeric" })
  };
}

async function loadTasks() {
  const version = ++taskLoadVersion;
  let tasks;
  try {
    tasks = await request();
  } catch (error) {
    if (version !== taskLoadVersion) return;
    throw error;
  }
  if (version !== taskLoadVersion) return;
  renderTimeline(tasks);
  emptyMessage.textContent = tasks.length ? "" : "No tasks yet. Create a task to get started.";
  updateButtons();
}

function renderTimeline(tasks) {
  timeline.replaceChildren();
  document.getElementById("timelineOverview").hidden = tasks.length === 0;
  const sorted = [...tasks].sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id - b.id);
  let group = null;
  let groupName = "";
  for (const task of sorted) {
    const parts = dateParts(task.dueDate);
    if (parts.month !== groupName) {
      groupName = parts.month;
      timeline.append(element("h2", "month", groupName));
      group = element("ol", "tl");
      group.setAttribute("aria-label", `Tasks due in ${groupName}`);
      timeline.append(group);
    }
    group.append(renderTask(task, parts));
  }
}

function renderTask(task, parts) {
  const statusClass = task.status.toLowerCase().replaceAll(" ", "-");
  const overdue = isOverdue(task);
  const item = element("li", `tl-item timeline-event ${statusClass}${overdue ? " over" : ""}`);
  item.dataset.taskId = task.id;

  const date = element("time", `tl-date${task.status === "Completed" ? " done" : ""}`);
  date.dateTime = task.dueDate;
  const weekday = element("span", "wd", parts.weekday);
  const day = element("span", "d", parts.day);
  weekday.setAttribute("aria-hidden", "true");
  day.setAttribute("aria-hidden", "true");
  date.append(weekday, day, element("span", "sr", `Due ${parts.long}`));
  if (overdue) date.classList.add("overdue-date");

  const rail = element("span", "tl-rail");
  rail.setAttribute("aria-hidden", "true");
  const node = element("span", "tl-node");
  if (task.status === "Completed") node.append(icon("check", "ico-xs"));
  rail.append(node);

  const card = element("article", "tl-card");
  card.setAttribute("aria-label", task.title);
  // Phone layout shows the date inside the card; the <time> above carries it for assistive tech.
  const cardDate = element("span", `tl-cdate${overdue ? " over" : ""}`);
  cardDate.setAttribute("aria-hidden", "true");
  cardDate.append(element("span", "wd", parts.weekday), element("span", "d", parts.day));
  const title = element("h3", "timeline-title", task.title);
  const meta = element("div", "tl-meta");
  const badge = element("span", `status-badge ${statusClass}`);
  badge.append(task.status === "Completed" ? icon("check", "ico-xs") : element("span", "dot"), task.status);
  meta.append(badge, element("span", "tag", task.category));
  const top = element("div", "tl-top");
  const main = element("div", "tl-main");
  main.append(title, meta);
  top.append(cardDate, main);
  card.append(top);
  if (overdue) {
    // One label per width: in the meta row on desktop, beside the title/date on tablet and phone.
    const label = element("span", "overdue-label");
    label.append(icon("alert", "ico-xs"), "Overdue");
    meta.append(label);
    const flag = element("span", "over-flag");
    flag.append(icon("alert", "ico-xs"), "Overdue");
    card.append(flag);
  }

  const details = element("div", "tl-details");
  details.id = `task-details-${task.id}`;
  details.hidden = true;
  const list = document.createElement("dl");
  for (const [label, value] of [
    ["Description", task.description || "No description provided."],
    ["Category", task.category],
    ["Estimated hours", task.estimatedHours == null ? "Not specified"
      : `${task.estimatedHours} ${task.estimatedHours === 1 ? "hour" : "hours"}`],
    ["Due date", parts.long]
  ]) {
    list.append(element("dt", "", label), element("dd", "", value));
  }
  details.append(list);
  const info = element("button", "disc task-info", "Details");
  info.type = "button";
  info.append(icon("chev"));
  info.setAttribute("aria-label", `Details for ${task.title}`);
  info.setAttribute("aria-expanded", "false");
  info.setAttribute("aria-controls", details.id);
  function setOpen(open) {
    details.hidden = !open;
    info.setAttribute("aria-expanded", String(open));
    card.classList.toggle("open", open);
  }
  info.onclick = () => setOpen(details.hidden);
  card.addEventListener("keydown", event => {
    if (event.key === "Escape" && !details.hidden) {
      setOpen(false);
      info.focus();
    }
  });
  card.append(info);

  const actions = element("div", "tl-actions task-actions");
  const status = element("div", "tl-status");
  const tools = element("div", "tgrp");
  tools.setAttribute("role", "group");
  tools.setAttribute("aria-label", `Manage ${task.title}`);
  actions.append(status, tools);
  function addButton(parent, label, className, iconName, action) {
    const button = element("button", `${className} action-${label.toLowerCase()}`);
    button.type = "button";
    if (iconName) button.append(icon(iconName));
    button.append(label);
    button.onclick = action;
    parent.append(button);
  }
  if (task.status === "Planned") {
    addButton(status, "Start", "btn btn-sm btn-next", "play", () => changeTask(task, "In Progress"));
  }
  if (task.status !== "Completed") {
    // The next natural transition is tonal; Complete on a Planned task stays outlined.
    const style = task.status === "Planned" ? "btn-secondary" : "btn-next";
    addButton(status, "Complete", `btn btn-sm ${style}`, "check", () => changeTask(task, "Completed"));
  } else {
    addButton(status, "Reopen", "btn btn-sm btn-quiet", "undo", () => changeTask(task, "In Progress"));
  }
  addButton(tools, "Edit", "tbtn", "", event => openForm(task, event.currentTarget));
  addButton(tools, "Delete", "tbtn", "", event => confirmDelete(task, event.currentTarget));
  card.append(actions, details);

  item.append(date, rail, card);
  return item;
}

function updateButtons() {
  document.querySelectorAll("button").forEach(button => {
    button.disabled = busy || (timeline.contains(button) && editingTask !== null);
  });
}

async function changeTask(task, status) {
  busy = true;
  updateButtons();
  errorMessage.textContent = "";
  try {
    await request({
      method: status ? "PUT" : "DELETE",
      headers: { "Content-Type": "application/json" },
      body: status ? JSON.stringify({ ...task, status }) : undefined
    }, task.id);
    await loadTasks();
  } catch (error) {
    errorMessage.textContent = error.message;
  } finally {
    busy = false;
    updateButtons();
    // Re-rendering replaces the clicked button; keep keyboard focus on the same task.
    const row = timeline.querySelector(`[data-task-id="${task.id}"]`);
    if (status && row && !row.contains(document.activeElement)) row.querySelector(".tl-actions button")?.focus();
  }
}

function confirmDelete(task, button) {
  opener = button;
  document.getElementById("deleteHeading").textContent = `Delete "${task.title}"?`;
  deleteDialog.returnValue = "";
  deleteDialog.onclose = async () => {
    if (deleteDialog.returnValue === "delete") {
      await changeTask(task);
      if (!opener?.isConnected) createButton.focus();
    } else restoreFocus();
  };
  deleteDialog.showModal();
}

function restoreFocus() {
  (opener?.isConnected ? opener : createButton).focus();
  opener = null;
}

function setFormError(message) {
  formError.textContent = message;
  // The hours field repeats the server's hours message next to the field.
  const hoursError = message.split(/(?<=\.) /).find(part => part.startsWith("Estimated hours")) || "";
  hoursInput.setAttribute("aria-invalid", String(hoursError !== ""));
  hoursHelp.textContent = hoursError || "Up to 999";
  hoursHelp.className = hoursError ? "field-error" : "field-help";
}

function openForm(task, button) {
  closeForm(false);
  opener = button;
  editingTask = task;
  if (task) {
    const fields = form.elements;
    fields.taskTitle.value = task.title;
    fields.category.value = task.category;
    fields.dueDate.value = task.dueDate;
    fields.description.value = task.description ?? "";
    fields.estimatedHours.value = task.estimatedHours ?? "";
    submitButton.textContent = "Save";
    formHeading.textContent = "Edit task";
    formNote.textContent = `Editing “${task.title}”`;
  }
  taskDialog.showModal();
  document.getElementById("taskTitle").focus();
  updateButtons();
}

function closeForm(returnFocus = true) {
  form.reset();
  editingTask = null;
  submitButton.textContent = "Create task";
  formHeading.textContent = "Create a task";
  formNote.textContent = "New tasks start as Planned.";
  setFormError("");
  if (taskDialog.open) taskDialog.close();
  errorMessage.textContent = "";
  updateButtons();
  if (returnFocus) restoreFocus();
}

createButton.onclick = () => openForm(null, createButton);
document.getElementById("taskCreationCloseButton").onclick = () => closeForm();
document.getElementById("taskDialogClose").onclick = () => closeForm();
// Escape closes the drawer the same way Cancel does.
taskDialog.addEventListener("cancel", event => {
  event.preventDefault();
  if (!busy) closeForm();
});

form.onsubmit = async event => {
  event.preventDefault();
  setFormError("");
  busy = true;
  updateButtons();
  const fields = form.elements;
  const focusTarget = opener;
  try {
    await request({
      method: editingTask ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: fields.taskTitle.value, category: fields.category.value,
        dueDate: fields.dueDate.value, description: fields.description.value,
        estimatedHours: fields.estimatedHours.value === "" ? null : Number(fields.estimatedHours.value)
      })
    }, editingTask ? editingTask.id : "");
    const editedId = editingTask?.id;
    busy = false;
    closeForm(false);
    await loadTasks();
    const row = editedId && timeline.querySelector(`[data-task-id="${editedId}"]`);
    (row ? row.querySelector(".action-edit") : focusTarget?.isConnected ? focusTarget : createButton).focus();
    opener = null;
  } catch (error) {
    if (taskDialog.open) setFormError(error.message);
    else errorMessage.textContent = error.message;
  } finally {
    busy = false;
    updateButtons();
  }
};

loadTasks().catch(() => {
  emptyMessage.textContent = "";
  errorMessage.textContent = "Unable to load tasks. Please refresh to try again.";
});

if (location.hash === "#create") createButton.click();
// Show range feedback when the user leaves the hours field.
function showHoursValidation() {
  const invalid = !hoursInput.validity.valid;
  hoursInput.setAttribute("aria-invalid", String(invalid));
  hoursHelp.textContent = invalid ? hoursInput.validationMessage : "Up to 999";
  hoursHelp.className = invalid ? "field-error" : "field-help";
}
hoursInput.addEventListener("blur", showHoursValidation);
hoursInput.addEventListener("input", () => {
  if (hoursInput.getAttribute("aria-invalid") === "true") showHoursValidation();
});
