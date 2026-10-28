const express = require("express");
const { createProgressService } = require("../services/progressService");

function createProgressRoutes(db) {
  const router = express.Router();
  const service = createProgressService(db);
  const userId = 1; // Same server-controlled simulated user as TimelineTasks.
  router.use(express.json());

  router.get("/", (req, res, next) => {
    service.getProgress(userId).then(progress => res.json(progress)).catch(next);
  });

  router.put("/", (req, res) => {
    res.status(400).json({ error: "Question ID is required in the URL." });
  });

  router.put("/:questionId", (req, res, next) => {
    service.updateProgress(userId, req.params.questionId, req.body)
      .then(progress => res.json(progress)).catch(next);
  });

  router.use((err, req, res, next) => {
    if (err.type === "entity.parse.failed") {
      return res.status(400).json({ error: "Request body must be valid JSON." });
    }
    if (err.type === "entity.too.large") {
      return res.status(413).json({ error: "Request body is too large." });
    }
    if (err.status === 400 || err.status === 404) {
      return res.status(err.status).json({ error: err.message });
    }
    if (err.status >= 400 && err.status < 500) {
      return res.status(err.status).json({ error: "Invalid progress request." });
    }
    res.status(500).json({ error: "Unable to access progress. Please try again." });
  });
  return router;
}

module.exports = { createProgressRoutes };
