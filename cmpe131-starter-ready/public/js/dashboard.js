async function loadDashboard() {
  try {
    const response = await fetch("/api/dashboard");
    if (!response.ok) throw new Error("Unable to load dashboard. Please refresh to try again.");
    const { tasks, upcoming, coding } = await response.json();
    document.getElementById("taskSummary").textContent = tasks.total
      ? `${tasks.total} tasks: ${tasks.planned} Planned, ${tasks.inProgress} In Progress, ${tasks.completed} Completed.`
      : "No tasks yet. Create a task to get started.";
    document.getElementById("upcomingEmpty").textContent = upcoming.length
      ? "" : "No upcoming tasks.";
    const list = document.getElementById("upcomingTasks");
    for (const task of upcoming) {
      const item = document.createElement("li");
      item.textContent = `${task.title} — Due: ${task.dueDate} — ${task.status}`;
      list.append(item);
    }
    document.getElementById("codingSummary").textContent = coding.completed
      ? `${coding.completed} of ${coding.total} questions completed (${Math.round(100 * coding.completed / coding.total)}%).`
      : "No coding progress recorded yet.";
  } catch (error) {
    document.getElementById("dashboardError").textContent = error.message;
  } finally {
    document.getElementById("dashboardLoading").textContent = "";
  }
}

loadDashboard();
