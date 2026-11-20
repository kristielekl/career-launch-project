// Turns a status like "In Progress" into a CSS class like "in-progress".
function statusClass(status) {
  return status.toLowerCase().replace(/\s+/g, "-");
}

// Shows a YYYY-MM-DD due date as e.g. "Sun, Nov 1, 2026" (parsed as a local date, so it doesn't shift a day).
function formatDate(value) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

// Decorative icon; see the .i-* mask rules in styles.css.
function icon(name, size = "ico-sm") {
  const span = document.createElement("span");
  span.className = `ico i-${name} ${size}`;
  span.setAttribute("aria-hidden", "true");
  return span;
}

function statusBadge(status) {
  const badge = document.createElement("span");
  badge.className = `status-badge ${statusClass(status)}`;
  if (status === "Completed") badge.append(icon("check", "ico-xs"));
  else { const dot = document.createElement("span"); dot.className = "dot"; badge.append(dot); }
  badge.append(status);
  return badge;
}

function renderTasks(tasks) {
  document.getElementById("statTotal").textContent = tasks.total;
  document.getElementById("statPlanned").textContent = tasks.planned;
  document.getElementById("statInProgress").textContent = tasks.inProgress;
  document.getElementById("statCompleted").textContent = tasks.completed;
  const summary = document.getElementById("taskSummary");
  summary.textContent = tasks.total
    ? `${tasks.total} tasks: ${tasks.planned} Planned, ${tasks.inProgress} In Progress, ${tasks.completed} Completed.`
    : "No tasks yet. Create a task to get started.";
  // The count sentence repeats the visible counts, so only screen readers get it; the empty sentence stays visible.
  summary.className = tasks.total ? "sr" : "summary";
}

function renderUpcoming(upcoming) {
  document.getElementById("upcomingEmpty").textContent = upcoming.length
    ? "" : "No upcoming tasks.";
  const list = document.getElementById("upcomingTasks");
  list.replaceChildren();
  for (const task of upcoming) {
    // textContent (not innerHTML) so task text containing HTML is shown literally.
    const item = document.createElement("li");

    const info = document.createElement("div");
    const title = document.createElement("span");
    title.className = "row-title";
    title.textContent = task.title;
    const due = document.createElement("span");
    due.className = "row-meta";
    due.textContent = `Due ${formatDate(task.dueDate)}`;
    info.append(title, due);

    item.append(info, statusBadge(task.status));
    list.append(item);
  }
}

function renderCoding(coding) {
  const percent = coding.total ? Math.round(100 * coding.completed / coding.total) : 0;
  document.getElementById("codingPercent").textContent = `${percent}%`;
  document.getElementById("codingFill").style.width = `${percent}%`;
  document.getElementById("codingBar").setAttribute("aria-valuenow", String(percent));
  document.getElementById("codingSummary").textContent = coding.completed
    ? `${coding.completed} of ${coding.total} questions completed`
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
    document.getElementById("dashboardLoading").hidden = true;
  }
}

// Serialize goal writes so success messages cannot hide another write's failure.
function setGoalsBusy(busy) {
  document.querySelectorAll("#goalSubmit, .goal-remove").forEach(button => { button.disabled = busy; });
}

function appendGoal(goal) {
  const item = document.createElement("li");
  const text = document.createElement("span");
  text.className = "goal-text";
  text.textContent = goal.text;
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "btn btn-sm btn-quiet goal-remove";
  remove.textContent = "Remove";
  remove.setAttribute("aria-label", `Remove goal: ${goal.text}`);
  remove.onclick = async () => {
    if (!confirm(`Remove "${goal.text}"?`)) return;
    setGoalsBusy(true);
    showGoalMessage("Removing career goal…", "info");
    try {
      const response = await fetch(`/api/goals/${goal.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Unable to remove career goal. Please try again.");
      const next = item.nextElementSibling?.querySelector("button")
        || item.previousElementSibling?.querySelector("button") || document.getElementById("goalText");
      const restoreFocus = document.activeElement === remove || document.activeElement === document.body;
      item.remove();
      if (!document.getElementById("careerGoals").children.length) {
        document.getElementById("goalsEmpty").textContent = "No career goals yet. Add your first goal above.";
      }
      setGoalsBusy(false);
      if (restoreFocus) next.focus();
      showGoalMessage("Career goal removed.", "ok");
    } catch (error) {
      showGoalMessage(error.message, "err");
    } finally {
      setGoalsBusy(false);
      if (remove.isConnected && document.activeElement === document.body) remove.focus();
    }
  };
  item.append(icon("target"), text, remove);
  document.getElementById("careerGoals").append(item);
  document.getElementById("goalsEmpty").textContent = "";
}

// Shows a goal status message; kind picks the colour (ok, err or info).
function showGoalMessage(text, kind) {
  const message = document.getElementById("goalMessage");
  message.textContent = text;
  message.className = `msg msg-${kind}`;
  document.getElementById("goalText").setAttribute("aria-invalid", String(kind === "err" && text.startsWith("Enter")));
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
    showGoalMessage(error.message, "err");
  } finally {
    button.disabled = false;
  }
}

document.getElementById("goalForm").addEventListener("submit", async event => {
  event.preventDefault();
  const input = document.getElementById("goalText");
  const text = input.value.trim();
  if (!text || text.length > 200) {
    showGoalMessage("Enter a career goal between 1 and 200 characters.", "err");
    input.focus();
    return;
  }
  const button = document.getElementById("goalSubmit");
  if (button.disabled) return;
  setGoalsBusy(true);
  showGoalMessage("Saving career goal…", "info");
  try {
    const response = await fetch("/api/goals", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });
    if (!response.ok) throw new Error("Unable to save career goal. Please try again.");
    appendGoal(await response.json());
    input.value = "";
    showGoalMessage("Career goal saved.", "ok");
    input.focus();
  } catch (error) {
    showGoalMessage(error.message, "err");
  } finally {
    setGoalsBusy(false);
  }
});

loadDashboard();
loadGoals();
