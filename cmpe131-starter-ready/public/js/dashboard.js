// Turns a status like "In Progress" into a CSS class like "in-progress".
function statusClass(status) {
  return status.toLowerCase().replace(/\s+/g, "-");
}

// Shows a YYYY-MM-DD due date as e.g. "Nov 1, 2026" (parsed as a local date, so it doesn't shift a day).
function formatDate(value) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function renderTasks(tasks) {
  document.getElementById("statTotal").textContent = tasks.total;
  document.getElementById("statPlanned").textContent = tasks.planned;
  document.getElementById("statInProgress").textContent = tasks.inProgress;
  document.getElementById("statCompleted").textContent = tasks.completed;
  document.getElementById("taskSummary").textContent = tasks.total
    ? `${tasks.total} tasks: ${tasks.planned} Planned, ${tasks.inProgress} In Progress, ${tasks.completed} Completed.`
    : "No tasks yet. Create a task to get started.";
}

function renderUpcoming(upcoming) {
  document.getElementById("upcomingEmpty").textContent = upcoming.length
    ? "" : "No upcoming tasks.";
  const list = document.getElementById("upcomingTasks");
  list.replaceChildren();
  for (const task of upcoming) {
    // textContent (not innerHTML) so task text containing HTML is shown literally.
    const item = document.createElement("li");
    item.className = "upcoming-item";

    const info = document.createElement("div");
    const title = document.createElement("span");
    title.className = "upcoming-title";
    title.textContent = task.title;
    const due = document.createElement("span");
    due.className = "upcoming-due";
    due.textContent = `Due: ${formatDate(task.dueDate)}`;
    info.append(title, due);

    const badge = document.createElement("span");
    badge.className = `status-badge ${statusClass(task.status)}`;
    badge.textContent = task.status;

    item.append(info, badge);
    list.append(item);
  }
}

function renderCoding(coding) {
  const percent = coding.total ? Math.round(100 * coding.completed / coding.total) : 0;
  document.getElementById("codingPercent").textContent = `${percent}%`;
  document.getElementById("codingFill").style.width = `${percent}%`;
  document.getElementById("codingBar").setAttribute("aria-valuenow", String(percent));
  document.getElementById("codingSummary").textContent = coding.completed
    ? `${coding.completed} of ${coding.total} questions completed (${percent}%).`
    : "No coding progress recorded yet.";
}

async function loadDashboard() {
  try {
    const response = await fetch("/api/dashboard");
    if (!response.ok) throw new Error("Unable to load dashboard. Please refresh to try again.");
    const { tasks, upcoming, coding } = await response.json();
    renderTasks(tasks);
    renderUpcoming(upcoming);
    renderCoding(coding);
  } catch (error) {
    document.getElementById("dashboardError").textContent = error.message;
  } finally {
    document.getElementById("dashboardLoading").textContent = "";
  }
}

function appendGoal(goal) {
  const item = document.createElement("li");
  item.textContent = goal.text;
  document.getElementById("careerGoals").append(item);
  document.getElementById("goalsEmpty").textContent = "";
}

async function loadGoals() {
  const button = document.getElementById("goalSubmit");
  button.disabled = true;
  try {
    const response = await fetch("/api/goals");
    if (!response.ok) throw new Error("Unable to load career goals. Refresh to try again.");
    const goals = await response.json();
    document.getElementById("careerGoals").replaceChildren();
    document.getElementById("goalsEmpty").textContent = goals.length ? "" : "No career goals yet. Add your first goal above.";
    goals.forEach(appendGoal);
  } catch (error) {
    document.getElementById("goalsEmpty").textContent = "";
    document.getElementById("goalMessage").textContent = error.message;
  } finally {
    button.disabled = false;
  }
}

document.getElementById("goalForm").addEventListener("submit", async event => {
  event.preventDefault();
  const input = document.getElementById("goalText");
  const message = document.getElementById("goalMessage");
  const text = input.value.trim();
  if (!text || text.length > 200) {
    message.textContent = "Enter a career goal between 1 and 200 characters.";
    input.focus();
    return;
  }
  const button = document.getElementById("goalSubmit");
  if (button.disabled) return;
  button.disabled = true;
  message.textContent = "Saving career goal…";
  try {
    const response = await fetch("/api/goals", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });
    if (!response.ok) throw new Error("Unable to save career goal. Please try again.");
    appendGoal(await response.json());
    input.value = "";
    message.textContent = "Career goal saved.";
    input.focus();
  } catch (error) {
    message.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

loadDashboard();
loadGoals();
