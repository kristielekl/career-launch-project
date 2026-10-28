const topicSelect = document.getElementById("topic");
const container = document.getElementById("questions");
const message = document.getElementById("message");

async function loadQuestions() {
  try {
    const [catalogResponse, progressResponse] = await Promise.all([
      fetch("/api/questions"), fetch("/api/progress")
    ]);
    if (!catalogResponse.ok || !progressResponse.ok) {
      throw new Error("Unable to load questions and progress.");
    }
    const questions = await catalogResponse.json();
    const progress = await progressResponse.json();
    const completed = new Map(progress.map(row => [row.questionId, row.completed]));
    for (const question of questions) {
      question.completed = completed.get(question.question_id) ?? false;
    }
    const topics = [...new Set(questions.map(question => question.topic))];
    for (const topic of topics) topicSelect.add(new Option(topic, topic));

    function setSaving(saving) {
      topicSelect.disabled = saving;
      container.querySelectorAll("input").forEach(input => { input.disabled = saving; });
    }

    function render() {
      container.replaceChildren();
      for (const topic of topics) {
        if (topicSelect.value && topicSelect.value !== topic) continue;
        const heading = document.createElement("h2");
        heading.textContent = topic;
        const topicQuestions = questions.filter(question => question.topic === topic);
        const count = topicQuestions.filter(question => question.completed).length;
        const summary = document.createElement("p");
        summary.className = "topic-progress";
        summary.textContent = `${count} / ${topicQuestions.length} completed (${Math.round(count / topicQuestions.length * 100)}%)`;
        const list = document.createElement("ul");
        for (const question of topicQuestions) {
          const item = document.createElement("li");
          const link = document.createElement("a");
          link.textContent = question.title;
          link.href = question.external_url;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          item.append(link, ` (${question.difficulty})`);
          const label = document.createElement("label");
          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.checked = question.completed;
          checkbox.setAttribute("aria-label", `${question.title} completed`);
          checkbox.onchange = async () => {
            const nextCompleted = checkbox.checked;
            setSaving(true);
            message.textContent = "Saving progress…";
            try {
              const response = await fetch(`/api/progress/${question.question_id}`, {
                method: "PUT", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ completed: nextCompleted })
              });
              if (!response.ok) throw new Error("Unable to save progress.");
              const saved = await response.json();
              question.completed = saved.completed;
              render();
              message.textContent = "Progress saved.";
            } catch {
              checkbox.checked = question.completed;
              message.textContent = "Unable to save progress. Please try again.";
            } finally {
              setSaving(false);
            }
          };
          label.append(checkbox, " Completed");
          item.append(" ", label);
          list.append(item);
        }
        const section = document.createElement("section");
        section.append(heading, summary, list);
        container.append(section);
      }
    }
    topicSelect.addEventListener("change", render);
    render();
    message.textContent = questions.length ? "" : "No questions available.";
  } catch {
    message.textContent = "Unable to load questions and progress. Please refresh to try again.";
  }
}

loadQuestions();
