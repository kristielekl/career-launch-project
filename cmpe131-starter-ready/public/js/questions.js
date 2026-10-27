const topicSelect = document.getElementById("topic");
const container = document.getElementById("questions");
const message = document.getElementById("message");

async function loadQuestions() {
  try {
    const response = await fetch("/api/questions");
    if (!response.ok) throw new Error("Unable to load questions.");
    const questions = await response.json();
    const topics = [...new Set(questions.map(question => question.topic))];
    for (const topic of topics) topicSelect.add(new Option(topic, topic));

    function render() {
      container.replaceChildren();
      for (const topic of topics) {
        if (topicSelect.value && topicSelect.value !== topic) continue;
        const heading = document.createElement("h2");
        heading.textContent = topic;
        const list = document.createElement("ul");
        for (const question of questions.filter(question => question.topic === topic)) {
          const item = document.createElement("li");
          const link = document.createElement("a");
          link.textContent = question.title;
          link.href = question.external_url;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          item.append(link, ` (${question.difficulty})`);
          list.append(item);
        }
        container.append(heading, list);
      }
      message.textContent = questions.length ? "" : "No questions available.";
    }
    topicSelect.addEventListener("change", render);
    render();
  } catch {
    message.textContent = "Unable to load questions. Please refresh to try again.";
  }
}

loadQuestions();
