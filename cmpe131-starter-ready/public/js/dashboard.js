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

loadDashboard();
