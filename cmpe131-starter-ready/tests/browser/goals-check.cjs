// Optional check: provide Playwright externally, without adding an app dependency.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { mkdtemp, cp, rm, mkdir } = require("node:fs/promises");
const { promisify } = require("node:util");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { openDb } = require("../../db");
const source = path.resolve(__dirname, "../..");
const evidence = process.env.GOALS_EVIDENCE_DIR || path.join(tmpdir(), "career-goals-85-evidence");
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
    let output = "", errors = "";
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
  const dir = await mkdtemp(path.join(tmpdir(), "goals-browser-"));
  let browser;
  try {
    await mkdir(evidence, { recursive: true });
    await cp(source, dir, { recursive: true,
      filter: filename => !filename.includes("node_modules") && !filename.includes("database.sqlite") });
    const db = openDb(path.join(dir, "database.sqlite"));
    await promisify(db.run.bind(db))("INSERT INTO CareerGoals (user_id, text) VALUES (2, 'Private goal')");
    await promisify(db.close.bind(db))();
    browser = await chromium.launch({
      headless: true, args: ["--no-sandbox"],
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined
    });
    console.log(`Browser: Chromium ${browser.version()}; isolated SQLite; Linux ${process.arch}`);
    const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    let base = await startServer(dir);
    await page.goto(base + "/dashboard.html");
    const status = text => page.waitForFunction(expected =>
      document.getElementById("goalMessage").textContent === expected, text);
    await page.getByText("No career goals yet. Add your first goal above.").waitFor();
    assert.equal(await page.locator("#careerGoals li").count(), 0);
    await page.screenshot({ path: path.join(evidence, "empty-desktop.png"), fullPage: true });
    const input = page.getByLabel("New career goal (up to 200 characters)");
    const add = page.getByRole("button", { name: "Add goal", exact: true });
    await input.fill("   ");
    await add.click();
    await status("Enter a career goal between 1 and 200 characters.");
    assert.equal(await page.locator("#careerGoals li").count(), 0);
    await input.fill("  Get an internship  ");
    await input.press("Enter");
    await status("Career goal saved.");
    assert.deepEqual(await page.locator("#careerGoals li").allTextContents(), ["Get an internship"]);
    assert.equal(await input.inputValue(), "");
    assert.equal(await input.getAttribute("maxlength"), "200");
    const literal = '<img src=x onerror="window.goalXss=true">';
    await input.fill(literal);
    await add.click();
    await status("Career goal saved.");
    assert.equal(await page.locator("#careerGoals img").count(), 0);
    assert.equal(await page.evaluate(() => window.goalXss), undefined);
    await page.reload();
    await page.getByText("Get an internship", { exact: true }).waitFor();
    assert.deepEqual(await page.locator("#careerGoals li").allTextContents(), ["Get an internship", literal]);
    await stopServer();
    base = await startServer(dir);
    await page.goto(base + "/dashboard.html");
    await page.getByText("Get an internship", { exact: true }).waitFor();
    assert.deepEqual(await page.locator("#careerGoals li").allTextContents(), ["Get an internship", literal]);
    console.log("PASS: real server registration, empty state/user isolation, whitespace validation, keyboard entry, literal HTML, reload and server-restart persistence");
    await page.screenshot({ path: path.join(evidence, "saved-desktop.png"), fullPage: true });
    await page.route("**/api/goals", route => route.request().method() === "POST"
      ? route.fulfill({ status: 500, contentType: "application/json", body: '{}' }) : route.continue());
    await input.fill("Complete 30 LeetCode questions");
    await add.click();
    await status("Unable to save career goal. Please try again.");
    assert.equal(await input.inputValue(), "Complete 30 LeetCode questions");
    assert.equal(await add.isEnabled(), true);
    await page.unroute("**/api/goals");
    await add.click();
    await status("Career goal saved.");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(evidence, "saved-mobile.png"), fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.route("**/api/goals", route => route.fulfill({ status: 500, contentType: "application/json", body: '{}' }));
    await page.reload();
    await status("Unable to load career goals. Refresh to try again.");
    assert.equal(await page.locator("#goalsEmpty").textContent(), "");
    assert.deepEqual(errors, []);
    console.log("PASS: failed save retains draft, retry saves, load failure shown, mobile fits, no browser errors");
    console.log("Screenshots: " + evidence);
  } finally {
    if (browser) await browser.close();
    await stopServer();
    await rm(dir, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
