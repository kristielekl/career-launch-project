// timelineRoutes.js 

/**
 * @file timelineRoutes.js
 * @description
 * Defines the Express API endpoints for TimelineTasks.
 *
 * Responsibilities:
 * - Receive HTTP requests from the frontend.
 * - Validate requests using timelineService.
 * - Perform temporary CRUD operations.
 * - Return JSON responses and HTTP status codes.
 *
 * NOTE:
 * This version uses temporary in-memory storage.
 * Replace it with timelineRepository.js for SQLite persistence.
 */

const express = require("express");
const router = express.Router();

// Import validation and status-transition functions.
const {
  validateTask,
  canChangeStatus
} = require("../services/timelineService");

// Simulated active user (authentication is not implemented).
const ACTIVE_USER_ID = 1;

// Temporary storage: records disappear after server restart.
let tasks = [];

// Assigns a unique ID to each new temporary task.
let nextId = 1;

/**
 * Finds a task belonging to the simulated active user.
 *
 * @param {number} id - Task ID to search for.
 * @returns {Object|undefined} Matching task, if found.
 */
function findTask(id) {
  return tasks.find(
    task => task.id === id &&
            task.userId === ACTIVE_USER_ID
  );
}

/**
 * Converts a URL task ID into a valid positive integer.
 *
 * @param {string} value - ID received from the URL.
 * @returns {number|null} Valid ID or null.
 */
function parseTaskId(value) {
  const id = Number(value);

  return Number.isSafeInteger(id) && id > 0
    ? id
    : null;
}

/**
 * GET /api/tasks
 *
 * Retrieves all tasks owned by the simulated active user.
 *
 * @returns {200} Array of TimelineTask objects.
 */
router.get("/", (req, res) => {
  const userTasks = tasks.filter(
    task => task.userId === ACTIVE_USER_ID
  );

  res.status(200).json(userTasks);
});

/**
 * GET /api/tasks/:id
 *
 * Retrieves one TimelineTask by ID.
 *
 * @returns {200} Matching task.
 * @returns {400} Invalid task ID.
 * @returns {404} Task not found.
 */
router.get("/:id", (req, res) => {
  const id = parseTaskId(req.params.id);

  // Reject IDs that are not valid positive integers.
  if (id === null) {
    return res.status(400).json({
      error: "Invalid task ID."
    });
  }

  // Find only a task belonging to the active user.
  const task = findTask(id);

  if (!task) {
    return res.status(404).json({
      error: "Task not found."
    });
  }

  res.status(200).json(task);
});

/**
 * POST /api/tasks
 *
 * Creates a TimelineTask using submitted JSON data.
 *
 * @returns {201} Newly created task.
 * @returns {400} Invalid task information.
 */
router.post("/", (req, res) => {
  const data = req.body || {};

  // Validate before creating the task.
  const errors = validateTask(data);

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  // Create a new task with a server-assigned ID/user.
  const task = {
    id: nextId++,
    userId: ACTIVE_USER_ID,
    title: data.title.trim(),
    category: data.category.trim(),
    dueDate: data.dueDate,
    estimatedHours: data.estimatedHours ?? null,
    status: data.status ?? "Planned"
  };

  // Temporarily store the task in memory.
  tasks.push(task);

  // Return the newly created task to the frontend.
  res.status(201).json(task);
});

/**
 * PUT /api/tasks/:id
 *
 * Updates an existing TimelineTask.
 *
 * @returns {200} Updated task.
 * @returns {400} Invalid input or status transition.
 * @returns {404} Task not found.
 */
router.put("/:id", (req, res) => {
  const id = parseTaskId(req.params.id);

  if (id === null) {
    return res.status(400).json({
      error: "Invalid task ID."
    });
  }

  const task = findTask(id);

  if (!task) {
    return res.status(404).json({
      error: "Task not found."
    });
  }

  // Prepare updated data without changing the stored task.
  const updated = {
    ...task,
    title: req.body?.title,
    category: req.body?.category,
    dueDate: req.body?.dueDate,
    estimatedHours: req.body?.estimatedHours,
    status: req.body?.status ?? task.status
  };

  // Check fields and status transition before saving.
  const errors = validateTask(updated);

  if (!canChangeStatus(task.status, updated.status)) {
    errors.push("Invalid status transition.");
  }

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  // Apply the validated changes to the stored task.
  Object.assign(task, {
    title: updated.title.trim(),
    category: updated.category.trim(),
    dueDate: updated.dueDate,
    estimatedHours: updated.estimatedHours,
    status: updated.status
  });

  res.status(200).json(task);
});

/**
 * DELETE /api/tasks/:id
 *
 * Permanently removes an owned TimelineTask.
 * The frontend must confirm deletion before calling this API.
 *
 * @returns {200} Success response.
 * @returns {400} Invalid task ID.
 * @returns {404} Task not found.
 */
router.delete("/:id", (req, res) => {
  const id = parseTaskId(req.params.id);

  if (id === null) {
    return res.status(400).json({
      error: "Invalid task ID."
    });
  }

  const task = findTask(id);

  if (!task) {
    return res.status(404).json({
      error: "Task not found."
    });
  }

  // Remove the task from temporary storage.
  tasks = tasks.filter(item => item.id !== id);

  res.status(200).json({ ok: true });
});

// Export this router so server.js can register it.
module.exports = router;
