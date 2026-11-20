const form = document.getElementById("taskCreationForm");
const errorMessage = document.getElementById("taskError");
const list = document.getElementById("taskList");
const emptyMessage = document.getElementById("taskEmpty");
const submitButton = document.getElementById("taskCreationSubmitButton");
const formHeading = document.getElementById("taskFormHeading");
const timeline = document.getElementById("taskTimeline");
let editingTask = null;
let busy = false;

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

function markOverdue(date, task) {
  if (!isOverdue(task)) return;
  date.classList.add("overdue-date");
  const warning = document.createElement("span");
  warning.className = "overdue-label";
  warning.textContent = " — Overdue";
  date.after(warning);
}

async function loadTasks() {
  const tasks = await request();
  list.replaceChildren();
  renderTimeline(tasks);
  emptyMessage.textContent = tasks.length ? "" : "No tasks yet. Create a task to get started.";
  for (const task of tasks) {
    const item = document.createElement("li");
    item.append(`Task: ${task.title} \nCategory: ${task.category} \nDue Date: `);
    const date = document.createElement("time");
    date.dateTime = task.dueDate;
    date.textContent = task.dueDate;
    item.append(date);
    markOverdue(date, task);
    item.append(` \nStatus: ${task.status} \n `
      + (task.estimatedHours == null ? "" : `Duration: ${task.estimatedHours} hours`)
      + (task.description ? `\nDescription: ${task.description}` : ""));
    const actions = document.createElement("div");
    actions.className = "task-actions";
    item.append(actions);
    list.append(item);
    function addButton(label, action) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.className = `action-${label.toLowerCase()}`;
      button.onclick = action;
      actions.append(button);
    }
    addButton("Edit", () => {
      closeForm();
      editingTask = task;
      const fields = form.elements;
      fields.taskTitle.value = task.title;
      fields.category.value = task.category;
      fields.dueDate.value = task.dueDate;
      fields.description.value = task.description ?? "";
      fields.estimatedHours.value = task.estimatedHours ?? "";
      submitButton.textContent = "Save";
      formHeading.textContent = "Edit task";
      form.style.display = "block";
      fields.taskTitle.focus();
      updateButtons();
    });
    if (task.status === "Planned") {
      addButton("Start", () => changeTask(task, "In Progress"));
    }
    if (task.status !== "Completed") {
      addButton("Complete", () => changeTask(task, "Completed"));
    } else {
      addButton("Reopen", () => changeTask(task, "In Progress"));
    }
    addButton("Delete", () => {
      if (confirm(`Delete "${task.title}"?`)) changeTask(task);
    });
  }
  updateButtons();
}

function renderTimeline(tasks) {
  timeline.replaceChildren();
  document.getElementById("timelineOverview").hidden = tasks.length === 0;
  const sorted = [...tasks].sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id - b.id);
  for (const task of sorted) {
    const item = document.createElement("li");
    const statusClass = task.status.toLowerCase().replaceAll(" ", "-");
    item.className = `timeline-event ${statusClass}`;
    const date = document.createElement("time");
    date.className = "timeline-date";
    date.dateTime = task.dueDate;
    // Keep date-only values independent of local time-zone calendar changes.
    const [year, month, day] = task.dueDate.split("-").map(Number);
    const dueDate = new Date(0);
    dueDate.setUTCFullYear(year, month - 1, day);
    date.textContent = dueDate.toLocaleDateString(undefined, {
      month: "short", day: "numeric", year: "numeric", timeZone: "UTC"
    });
    const title = document.createElement("span");
    title.className = "timeline-title";
    title.textContent = task.title;
    const badge = document.createElement("span");
    badge.className = `status-badge ${statusClass}`;
    badge.textContent = task.status;
    const info = document.createElement("button");
    info.type = "button";
    info.className = "task-info";
    info.textContent = "i";
    info.setAttribute("aria-label", `Details for ${task.title}`);
    const details = document.createElement("div");
    details.id = `task-details-${task.id}`;
    details.className = "task-details";
    details.popover = "auto";
    info.popoverTargetElement = details;
    const heading = document.createElement("h3");
    heading.id = `${details.id}-heading`;
    heading.textContent = task.title;
    details.setAttribute("aria-labelledby", heading.id);
    details.append(heading);
    for (const [label, value] of [
      ["Description", task.description || "No description provided."],
      ["Category", task.category],
      ["Estimated hours", task.estimatedHours ?? "Not specified"]
    ]) {
      const field = document.createElement("p");
      field.textContent = `${label}: ${value}`;
      details.append(field);
    }
    const headingRow = document.createElement("div");
    headingRow.className = "timeline-heading";
    headingRow.append(title, info);
    item.append(date, headingRow, badge, details);
    markOverdue(date, task);
    timeline.append(item);
  }
}

function updateButtons() {
  document.querySelectorAll("button").forEach(button => {
    button.disabled = busy || (list.contains(button) && editingTask !== null);
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
  }
}

function closeForm() {
  form.reset();
  editingTask = null;
  submitButton.textContent = "Submit";
  formHeading.textContent = "Create a task";
  form.style.display = "none";
  errorMessage.textContent = "";
  updateButtons();
}

document.getElementById("taskCreationOpenButton").onclick = () => {
  closeForm();
  form.style.display = "block";
  document.getElementById("taskTitle").focus();
};
document.getElementById("taskCreationCloseButton").onclick = closeForm;

form.onsubmit = async event => {
  event.preventDefault();
  errorMessage.textContent = "";
  busy = true;
  updateButtons();
  const fields = form.elements;
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
    closeForm();
    await loadTasks();
  } catch (error) {
    errorMessage.textContent = error.message;
  } finally {
    busy = false;
    updateButtons();
  }
};

loadTasks().catch(() => {
  emptyMessage.textContent = "";
  errorMessage.textContent = "Unable to load tasks. Please refresh to try again.";
});

if (location.hash === "#create") document.getElementById("taskCreationOpenButton").click();
