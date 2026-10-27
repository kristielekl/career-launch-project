const express = require("express");
const { createQuestionRepository } = require("../repositories/questionRepository");

module.exports = function questionRoutes(db) {
  const router = express.Router();
  const repository = createQuestionRepository(db);
  router.get("/", (req, res) => {
    repository.getQuestions((err, questions) => {
      if (err) return res.status(500).json({ error: "Unable to load questions." });
      res.json(questions);
    });
  });
  return router;
};
