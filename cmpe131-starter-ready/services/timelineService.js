// timelineServices.js 

/**
 * @file timelineService.js
 * @description
 * Handles validation and business rules for TimelineTasks.
 *
 * Responsibilities:
 * - Check required task fields.
 * - Validate task status values.
 * - Check whether a status transition is allowed.
 *
 * NOTE: file does not handle database operations. Use timelineRepository.js for persistence.
 */

// List of valid TimelineTask statuses.
const VALID_STATUSES = [
  "Planned",
  "In Progress",
  "Completed"
];

/**
 * Defines which status changes are allowed.
 *
 * Example:
 * A task in "Completed" may be reopened
 * by changing its status to "In Progress".
 */
const ALLOWED_TRANSITIONS = {
  "Planned": ["In Progress", "Completed"],
  "In Progress": ["Completed"],
  "Completed": ["In Progress"]
};

/**
 * Validates the information submitted for a TimelineTask.
 *
 * @param {Object} data - Task information from the request.
 * @param {string} data.title - Name of the task.
 * @param {string} data.category - Task category.
 * @param {string} data.dueDate - Due date in YYYY-MM-DD format.
 * @param {number} [data.estimatedHours] - Estimated hours.
 * @param {string} [data.status] - Current task status.
 *
 * @returns {string[]} List of validation errors.
 *                     Empty array means the input is valid.
 */
function validateTask(data) {
  const errors = [];

  // Check whether the task has a valid title.
  if (typeof data.title !== "string" ||
      !data.title.trim()) {
    errors.push("Task title is required.");
  }

  // Check whether a category was provided.
  if (typeof data.category !== "string" ||
      !data.category.trim()) {
    errors.push("Category is required.");
  }

  // Check whether the due date follows YYYY-MM-DD.
  if (typeof data.dueDate !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(data.dueDate)) {
    errors.push("A valid due date is required.");
  } else {
    // Reject dates that do not exist, such as February 30.
    const date = new Date(data.dueDate);

    if (Number.isNaN(date.getTime()) ||
        date.toISOString().slice(0, 10) !== data.dueDate) {
      errors.push("Due date is not valid.");
    }
  }

  // Estimated hours are optional, but must be nonnegative.
  if (data.estimatedHours != null &&
      (typeof data.estimatedHours !== "number" ||
       !Number.isFinite(data.estimatedHours) ||
       data.estimatedHours < 0)) {
    errors.push("Estimated hours must be nonnegative.");
  }

  // A new task defaults to Planned if no status is given.
  const status = data.status ?? "Planned";

  // Reject any status outside the approved list.
  if (!VALID_STATUSES.includes(status)) {
    errors.push("Invalid task status.");
  }

  return errors;
}


/**
 * Checks whether a TimelineTask can change status.
 *
 * @param {string} current - Task's current status.
 * @param {string} next - Requested new status.
 *
 * @returns {boolean} True if the transition is allowed.
 */
function canChangeStatus(current, next) {
  // Keeping the same status is allowed.
  if (current === next) {
    return true;
  }

  // Find the permitted next statuses.
  const allowed = ALLOWED_TRANSITIONS[current] || [];

  // Return true only if the new status is permitted.
  return allowed.includes(next);
}

// Export functions so Express routes can use them.
module.exports = {
  validateTask,
  canChangeStatus
};
