const express = require("express");
const { createDashboardService } = require("../services/dashboardService");

module.exports = function dashboardRoutes(db) {
  const router = express.Router();
  const summary = createDashboardService(db);
  router.get("/", async (req, res) => {
    try {
      res.json(await summary(1)); // Same simulated active user as the task API.
    } catch {
      res.status(500).json({ error: "Unable to load dashboard. Please refresh to try again." });
    }
  });
  return router;
};
