const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { mkdtemp, cp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const path = require("node:path");

test("production server mounts task JSON handling before the starter parser", async t => {
  const dir = await mkdtemp(path.join(tmpdir(), "career-server-"));
  const source = path.join(__dirname, "..");
  await cp(source, dir, { recursive: true,
    filter: filename => !filename.includes("node_modules") && !filename.includes("database.sqlite") });
  const child = spawn(process.execPath, ["-e", `
    const http = require('node:http');
    const listen = http.Server.prototype.listen;
    http.Server.prototype.listen = function(...args) {
      this.once('listening', () => console.log('TEST_PORT=' + this.address().port));
      return listen.apply(this, args);
    };
    require(process.argv[1]);
  `, path.join(dir, "server.js")], {
    env: { ...process.env, PORT: "0",
      NODE_PATH: path.dirname(path.dirname(require.resolve("express/package.json"))) },
    stdio: ["ignore", "pipe", "pipe"]
  });
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill();
      await new Promise(resolve => child.once("exit", resolve));
    }
    await rm(dir, { recursive: true, force: true });
  });
  const port = await new Promise((resolve, reject) => {
    let output = "";
    let errors = "";
    const timer = setTimeout(() => reject(new Error("Server startup timed out: " + errors)), 10000);
    child.stderr.on("data", data => { errors += data; });
    child.once("exit", code => { clearTimeout(timer); reject(new Error(`Server exited ${code}: ${errors}`)); });
    child.stdout.on("data", data => {
      output += data;
      const match = output.match(/TEST_PORT=(\d+)/);
      if (match) { clearTimeout(timer); resolve(match[1]); }
    });
  });
  const base = `http://127.0.0.1:${port}`;
  assert.equal((await fetch(base + "/api/health")).status, 200);
  assert.equal((await fetch(base + "/timeline.html")).status, 200);
  const response = await fetch(base + "/api/tasks", { method: "POST",
    headers: { "Content-Type": "application/json" }, body: '{"title":' });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Request body must be valid JSON." });
  assert.deepEqual(await (await fetch(base + "/api/tasks")).json(), []);
});
