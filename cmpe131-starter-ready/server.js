const express = require("express");
const path = require("path");
const { openDb } = require("./db");

const app = express();
const db = openDb();

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Health check
app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "Server is running" });
});

// List all appointments
app.get("/api/appointments", (req, res) => {
  db.all("SELECT * FROM appointments ORDER BY id DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Get one appointment
app.get("/api/appointments/:id", (req, res) => {
  const id = Number(req.params.id);
  db.get("SELECT * FROM appointments WHERE id = ?", [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(row);
  });
});

// Create appointment
app.post("/api/appointments", (req, res) => {
  const { customerName, service, date, time, notes } = req.body || {};
  if (!customerName || !service || !date || !time) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const sql = `
    INSERT INTO appointments (customerName, service, date, time, notes)
    VALUES (?, ?, ?, ?, ?)
  `;
  db.run(sql, [customerName, service, date, time, notes || ""], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id: this.lastID });
  });
});

// Update appointment
app.put("/api/appointments/:id", (req, res) => {
  const id = Number(req.params.id);
  const { customerName, service, date, time, notes } = req.body || {};
  if (!customerName || !service || !date || !time) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const sql = `
    UPDATE appointments
    SET customerName = ?, service = ?, date = ?, time = ?, notes = ?
    WHERE id = ?
  `;
  db.run(sql, [customerName, service, date, time, notes || "", id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  });
});

// Delete appointment (optional)
app.delete("/api/appointments/:id", (req, res) => {
  const id = Number(req.params.id);
  db.run("DELETE FROM appointments WHERE id = ?", [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Starter app running: http://localhost:${PORT}`);
});
