const topicSelect = document.getElementById("topic");
const container = document.getElementById("questions");
const message = document.getElementById("message");

// Shows a status message; kind picks the colour (ok, err or info). Empty text hides it.
function showMessage(text, kind = "info") {
  message.textContent = text;
  message.className = `msg msg-${kind}`;
}

function icon(name, size) {
  const span = document.createElement("span");
  span.className = `ico i-${name} ${size}`;
  span.setAttribute("aria-hidden", "true");
  return span;
}

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

    let pendingSaves = 0;
    let batchFailed = false;
    let focusOwner = null;

    function render() {
      container.replaceChildren();
      for (const topic of topics) {
        if (topicSelect.value && topicSelect.value !== topic) continue;
        const heading = document.createElement("h2");
        heading.textContent = topic;
        const topicQuestions = questions.filter(question => question.topic === topic);
        const summary = document.createElement("span");
        summary.className = "topic-progress";
        const bar = document.createElement("span");
        bar.className = "progress";
        bar.setAttribute("aria-hidden", "true");
        const fill = document.createElement("span");
        function updateSummary() {
          const count = topicQuestions.filter(question => question.completed).length;
          const percent = Math.round(count / topicQuestions.length * 100);
          summary.textContent = `${count} / ${topicQuestions.length} completed (${percent}%)`;
          fill.style.width = `${percent}%`;
        }
        updateSummary();
        bar.append(fill);
        const meta = document.createElement("span");
        meta.className = "tmeta";
        meta.append(bar, summary);
        const head = document.createElement("div");
        head.className = "topic-head";
        head.append(heading, meta);
        const section = document.createElement("section");
        section.className = "qtopic";
        section.setAttribute("aria-label", topic);
        section.append(head);
        for (const question of topicQuestions) {
          const item = document.createElement("div");
          item.className = "q";
          const link = document.createElement("a");
          link.className = "qlink";
          link.textContent = question.title;
          link.append(icon("ext", "ico-xs"));
          link.href = question.external_url;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          const difficulty = document.createElement("span");
          difficulty.className = "tag";
          difficulty.textContent = question.difficulty;
          item.append(link, difficulty);
          const label = document.createElement("label");
          label.className = "check";
          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.checked = question.completed;
          checkbox.setAttribute("aria-label", `${question.title} completed`);
          checkbox.onchange = async () => {
            const nextCompleted = checkbox.checked;
            const hadFocus = document.activeElement === checkbox;
            if (hadFocus) focusOwner = checkbox;
            if (pendingSaves === 0) batchFailed = false;
            checkbox.disabled = true;
            pendingSaves++;
            topicSelect.disabled = true;
            showMessage("Saving progress…");
            try {
              const response = await fetch(`/api/progress/${question.question_id}`, {
                method: "PUT", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ completed: nextCompleted })
              });
              if (!response.ok) throw new Error("Unable to save progress.");
              const saved = await response.json();
              question.completed = saved.completed;
              checkbox.checked = saved.completed;
              updateSummary();
            } catch {
              checkbox.checked = question.completed;
              batchFailed = true;
            } finally {
              checkbox.disabled = false;
              topicSelect.disabled = --pendingSaves > 0;
              // Disabling may move focus to body; don't steal focus if the user moved elsewhere.
              if (focusOwner === checkbox && document.activeElement === document.body) checkbox.focus();
              if (batchFailed) showMessage("Unable to save progress. Please try again.", "err");
              else if (pendingSaves) showMessage("Saving progress…");
              else showMessage("Progress saved.", "ok");
            }
          };
          label.append(checkbox, "Completed");
          item.append(label);
          section.append(item);
        }
        container.append(section);
      }
    }
    topicSelect.addEventListener("change", render);
    render();
    showMessage(questions.length ? "" : "No questions available.");
  } catch {
    showMessage("Unable to load questions and progress. Please refresh to try again.", "err");
  }
}

loadQuestions();
