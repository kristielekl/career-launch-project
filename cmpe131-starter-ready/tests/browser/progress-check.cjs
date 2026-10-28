// Optional browser check: provide Playwright externally; no application dependency is added.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { mkdtemp, cp, rm } = require("node:fs/promises");
const { promisify } = require("node:util");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { openDb } = require("../../db");

const source = path.resolve(__dirname, "../..");
let child;
async function stopServer() {
  if (child && child.exitCode === null && child.signalCode === null) {
    child.kill();
    await new Promise(resolve => child.once("exit", resolve));
  }
}

async function startServer(dir) {
  child = spawn(process.execPath, ["-e", `
    const http = require('node:http');
    const listen = http.Server.prototype.listen;
    http.Server.prototype.listen = function(...args) {
      this.once('listening', () => console.log('TEST_PORT=' + this.address().port));
      return listen.apply(this, args);
    };
    require(process.argv[1]);
  `, path.join(dir, "server.js")], {
    env: { ...process.env, PORT: "0", NODE_PATH: path.join(source, "node_modules")
      + path.delimiter + (process.env.NODE_PATH || "") },
    stdio: ["ignore", "pipe", "pipe"]
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
  return `http://127.0.0.1:${port}`;
}

async function main() {
  const dir = await mkdtemp(path.join(tmpdir(), "progress-browser-"));
  let browser;
  let db;
  try {
    await cp(source, dir, { recursive: true,
      filter: filename => !filename.includes("node_modules") && !filename.includes("database.sqlite") });
    db = openDb(path.join(dir, "database.sqlite"));
    await promisify(db.run.bind(db))("INSERT INTO QuestionProgress VALUES (2, 1, 1)");
    browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
    console.log(`Browser: Chromium ${browser.version()}; isolated SQLite; Linux ${process.arch}`);
    const context = await browser.newContext();
    await context.route("https://leetcode.com/**", route => route.fulfill({
      contentType: "text/html", body: "<title>Intercepted external link</title>"
    }));
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    const message = text => page.waitForFunction(expected =>
      document.getElementById("message").textContent === expected, text);
    const checkbox = () => page.getByRole("checkbox", { name: "Two Sum completed", exact: true });
    const summary = () => page.locator("section").filter({ has: page.getByRole("heading", { name: "Arrays & Hashing", exact: true }) })
      .locator(".topic-progress").textContent();
    let base = await startServer(dir);
    await page.goto(base + "/dashboard.html");
    await page.getByRole("link", { name: "Browse Question Map" }).click();
    await message("");
    assert.equal(await page.getByRole("checkbox").count(), 4);
    assert.equal(await checkbox().isChecked(), false);
    assert.equal(await summary(), "0 / 1 completed (0%)");
    console.log("PASS: production registration, Dashboard navigation, labeled controls and incomplete defaults/user isolation");

    for (const topic of ["Arrays & Hashing", "Two Pointers", "Sliding Window", "Stack"]) {
      await page.locator("#topic").selectOption(topic);
      assert.equal(await page.getByRole("checkbox").count(), 1);
    }
    await page.locator("#topic").selectOption("");
    assert.equal(await page.getByRole("checkbox").count(), 4);
    console.log("PASS: all topic filters and All topics");

    await checkbox().click();
    await message("Progress saved.");
    assert.equal(await checkbox().isChecked(), true);
    assert.equal(await summary(), "1 / 1 completed (100%)");
    await page.reload();
    await message("");
    assert.equal(await checkbox().isChecked(), true);
    console.log("PASS: check saves, updates topic count/percentage and survives refresh");

    await stopServer();
    base = await startServer(dir);
    await page.goto(base + "/questions.html");
    await message("");
    assert.equal(await checkbox().isChecked(), true);
    await checkbox().click();
    await message("Progress saved.");
    assert.equal(await summary(), "0 / 1 completed (0%)");
    await stopServer();
    base = await startServer(dir);
    await page.goto(base + "/questions.html");
    await message("");
    assert.equal(await checkbox().isChecked(), false);
    console.log("PASS: completion and reopening survive real server restarts");

    await page.route("**/api/progress/1", route => route.fulfill({ status: 500,
      contentType: "application/json", body: JSON.stringify({ error: "Unable to save progress." }) }));
    await checkbox().click();
    await message("Unable to save progress. Please try again.");
    assert.equal(await checkbox().isChecked(), false);
    assert.equal(await checkbox().isEnabled(), true);
    assert.equal(await summary(), "0 / 1 completed (0%)");
    assert.equal((await promisify(db.get.bind(db))("SELECT completed FROM QuestionProgress WHERE user_id=1 AND question_id=1")).completed, 0);
    await page.unroute("**/api/progress/1");
    await checkbox().click();
    await message("Progress saved.");
    assert.equal(await checkbox().isChecked(), true);
    console.log("PASS: failed save rolls back checkbox/count, leaves DB unchanged and allows retry");

    const before = await (await fetch(base + "/api/progress")).json();
    const popupPromise = context.waitForEvent("page");
    await page.getByRole("link", { name: "Two Sum", exact: true }).click();
    const popup = await popupPromise;
    await popup.waitForLoadState();
    assert.equal(popup.url(), "https://leetcode.com/problems/two-sum/");
    await popup.close();
    assert.deepEqual(await (await fetch(base + "/api/progress")).json(), before);
    assert.equal((await promisify(db.get.bind(db))("SELECT completed FROM QuestionProgress WHERE user_id=2 AND question_id=1")).completed, 1);
    console.log("PASS: external new-tab URL is correct, link navigation does not change progress, other user unchanged");

    for (const endpoint of ["progress", "questions"]) {
      await page.route(`**/api/${endpoint}`, route => route.fulfill({ status: 500,
        contentType: "application/json", body: "{}" }));
      await page.reload();
      await message("Unable to load questions and progress. Please refresh to try again.");
      assert.equal(await page.getByRole("checkbox").count(), 0);
      await page.unroute(`**/api/${endpoint}`);
    }
    console.log("PASS: failed catalog/progress loads show error and no editable unsaved defaults");
    const invalid = await fetch(base + "/api/progress/1", { method: "PUT",
      headers: { "Content-Type": "application/json" }, body: '{"completed":' });
    assert.equal(invalid.status, 400);
    assert.deepEqual(await invalid.json(), { error: "Request body must be valid JSON." });
    assert.deepEqual(errors, []);
    console.log("PASS: real-server malformed JSON returns controlled 400; no browser JavaScript errors");
    console.log("External requests were intercepted; live LeetCode content was not tested.");
  } finally {
    if (browser) await browser.close();
    await stopServer();
    if (db) await promisify(db.close.bind(db))();
    await rm(dir, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
