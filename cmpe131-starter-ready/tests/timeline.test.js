const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const timelineRoutes = require("../routes/timelineRoutes");

test("tasks start Planned and change status only after creation", async t => {
  const app = express();
  app.use(express.json());
  app.use("/api/tasks", timelineRoutes);
  const server = app.listen(0, "127.0.0.1");
  t.after(() => new Promise(resolve => server.close(resolve)));
  await new Promise(resolve => server.once("listening", resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/tasks`;
  const fields = { title: "Prepare resume", category: "Career", dueDate: "2026-11-01" };

  async function send(method, path, body) {
    const response = await fetch(url + path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    return { status: response.status, body: await response.json() };
  }

  for (const status of ["In Progress", "Completed", "Invalid"]) {
    const response = await send("POST", "", { ...fields, status });
    assert.equal(response.status, 400);
    assert.ok(response.body.errors.includes("New tasks must start in Planned status."));
  }
  assert.deepEqual(await (await fetch(url)).json(), []);

  for (const suppliedStatus of [{}, { status: "Planned" }]) {
    const created = await send("POST", "", { ...fields, ...suppliedStatus });
    assert.equal(created.status, 201);
    assert.equal(created.body.status, "Planned");
    const path = `/${created.body.id}`;

    for (const status of ["In Progress", "Completed", "In Progress"]) {
      const updated = await send("PUT", path, { ...fields, status });
      assert.equal(updated.status, 200);
      assert.equal(updated.body.status, status);
    }
    const invalid = await send("PUT", path, { ...fields, status: "Planned" });
    assert.equal(invalid.status, 400);
    assert.equal((await (await fetch(url + path)).json()).status, "In Progress");
    assert.equal((await send("DELETE", path)).status, 200);
  }
});
