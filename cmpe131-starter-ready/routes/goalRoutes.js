const express = require("express");
const { createGoalService } = require("../services/goalService");

module.exports = function goalRoutes(db) {
  const router = express.Router();
  const goals = createGoalService(db);
  // Same simulated active student as the Dashboard and Timeline APIs.
  const userId = 1;
  router.get("/", async (req, res) => {
    try {
      res.json(await goals.list(userId));
    } catch {
      res.status(500).json({ error: "Unable to load career goals. Please try again." });
    }
  });
  router.post("/", async (req, res) => {
    try {
      res.status(201).json(await goals.add(userId, req.body));
    } catch (error) {
      res.status(error.status === 400 ? 400 : 500).json({
        error: error.status === 400 ? error.message : "Unable to save career goal. Please try again."
      });
    }
  });
  return router;
};
