const form = document.getElementById("taskCreationForm");
const errorMessage = document.getElementById("taskError");
const list = document.getElementById("taskList");
const emptyMessage = document.getElementById("taskEmpty");
const submitButton = document.getElementById("taskCreationSubmitButton");

async function request(options) {
  const response = await fetch("/api/tasks", options);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.errors?.join(" ") || data.error || "Unable to load tasks.");
  }
  return data;
}

async function loadTasks() {
  const tasks = await request();
  list.replaceChildren();
  emptyMessage.textContent = tasks.length ? "" : "No tasks yet. Create a task to get started.";
  for (const task of tasks) {
    const item = document.createElement("li");
    item.textContent = `${task.title} — ${task.category} — Due: ${task.dueDate} — ${task.status}`
      + (task.estimatedHours == null ? "" : ` — ${task.estimatedHours} hours`)
      + (task.description ? ` — ${task.description}` : "");
    list.append(item);
  }
}

function closeForm() {
  form.reset();
  form.style.display = "none";
  errorMessage.textContent = "";
}

document.getElementById("taskCreationOpenButton").onclick = () => {
  form.style.display = "block";
  document.getElementById("taskTitle").focus();
};
document.getElementById("taskCreationCloseButton").onclick = closeForm;

form.onsubmit = async event => {
  event.preventDefault();
  errorMessage.textContent = "";
  submitButton.disabled = true;
  const fields = form.elements;
  try {
    await request({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: fields.taskTitle.value, category: fields.category.value,
        dueDate: fields.dueDate.value, description: fields.description.value,
        estimatedHours: fields.estimatedHours.value === "" ? null : Number(fields.estimatedHours.value)
      })
    });
    closeForm();
    await loadTasks();
  } catch (error) {
    errorMessage.textContent = error.message;
  } finally {
    submitButton.disabled = false;
  }
};

loadTasks().catch(() => {
  emptyMessage.textContent = "";
  errorMessage.textContent = "Unable to load tasks. Please refresh to try again.";
});
