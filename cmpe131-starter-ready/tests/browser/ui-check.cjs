// Optional check: NODE_PATH=/path/to/playwright/node_modules node tests/browser/ui-check.cjs
// Runs against an isolated copy; never changes the application's database.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { mkdtemp, cp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const path = require("node:path");

(async () => {
  const source = path.resolve(__dirname, "../..");
  const dir = await mkdtemp(path.join(tmpdir(), "career-ui-"));
  let server, browser;
  try {
    await cp(source, dir, { recursive: true,
      filter: name => !name.includes("node_modules") && !name.includes("database.sqlite") });
    // Read the actual OS-assigned port without changing the app server.
    server = spawn(process.execPath, ["-e", `
      const http = require('node:http');
      const listen = http.Server.prototype.listen;
      http.Server.prototype.listen = function(...args) {
        this.once('listening', () => console.log('TEST_PORT=' + this.address().port));
        return listen.apply(this, args);
      };
      require('./server');
    `], { cwd: dir, env: { ...process.env, PORT: "0", NODE_PATH: path.join(source, "node_modules") },
      stdio: ["ignore", "pipe", "pipe"] });
    const port = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Server startup timed out")), 10000);
      let output = "";
      server.stdout.on("data", data => {
        output += data;
        const match = output.match(/TEST_PORT=(\d+)/);
        if (match) { clearTimeout(timeout); resolve(match[1]); }
      });
      server.once("exit", code => { clearTimeout(timeout); reject(new Error(`Server exited: ${code}`)); });
    });
    const base = `http://127.0.0.1:${port}`;
    browser = await chromium.launch({ headless: true, args: ["--no-sandbox"],
      ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(base + "/timeline.html");
    await page.getByText("No tasks yet. Create a task to get started.").waitFor();
    assert.equal(await page.locator("#timelineOverview").isVisible(), false);
    await page.locator("#taskCreationOpenButton").click();
    await page.locator("#taskTitle").fill("Practice interview");
    await page.locator("#category").fill("Interview prep");
    await page.locator("#dueDate").fill("2026-07-20");
    await page.locator("#taskCreationSubmitButton").click();
    const task = page.locator("#taskList > li").first();
    await task.waitFor();
    assert.equal(await page.locator("#taskTimeline .timeline-title").textContent(), "Practice interview");
    async function action(name, status) {
      await task.getByRole("button", { name, exact: true }).click();
      await page.waitForFunction(expected => document.querySelector("#taskTimeline .status-badge")?.textContent === expected, status);
      await task.getByRole("button", { name: "Edit", exact: true }).waitFor();
    }
    await action("Start", "In Progress");
    await action("Complete", "Completed");
    await action("Reopen", "In Progress");
    await task.getByRole("button", { name: "Edit", exact: true }).click();
    assert.equal(await page.locator("#taskFormHeading").textContent(), "Edit task");
    await page.locator("#taskTitle").fill("Changed but canceled");
    await page.locator("#taskCreationCloseButton").click();
    assert.equal(await page.locator("#taskTimeline .timeline-title").textContent(), "Practice interview");
    await task.getByRole("button", { name: "Edit", exact: true }).click();
    await page.locator("#taskTitle").fill("Practice arrays");
    await page.locator("#dueDate").fill("2026-07-10");
    await page.locator("#taskCreationSubmitButton").click();
    await page.waitForFunction(() => document.querySelector("#taskTimeline .timeline-title")?.textContent === "Practice arrays");
    assert.equal(await page.locator("#taskTimeline time").getAttribute("datetime"), "2026-07-10");
    const response = await page.request.post(base + "/api/tasks", { data: {
      title: "<b>Earlier task</b>", category: "Career prep", dueDate: "0099-07-01"
    } });
    assert.equal(response.status(), 201);
    await page.reload();
    await page.locator("#taskTimeline li").nth(1).waitFor();
    assert.deepEqual(await page.locator("#taskTimeline time").evaluateAll(nodes => nodes.map(n => n.dateTime)), ["0099-07-01", "2026-07-10"]);
    assert.match(await page.locator("#taskTimeline time").first().textContent(), /99/);
    assert.doesNotMatch(await page.locator("#taskTimeline time").first().textContent(), /1999/);
    assert.equal(await page.locator("#taskTimeline b").count(), 0);
    page.once("dialog", dialog => dialog.dismiss());
    await task.getByRole("button", { name: "Delete", exact: true }).click();
    assert.equal(await page.locator("#taskList > li").count(), 2);
    page.once("dialog", dialog => dialog.accept());
    await task.getByRole("button", { name: "Delete", exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll("#taskTimeline li").length === 1);
    console.log("PASS: task create, edit, cancel, start, complete, reopen, confirmed delete, sorted timeline, safe text");
    const apia = await browser.newContext({ timezoneId: "Pacific/Apia", locale: "en-US" });
    const calendarPage = await apia.newPage();
    await calendarPage.route("**/api/tasks", route => route.fulfill({ json: [
      { id: 1, title: "Historical date", category: "Career prep", dueDate: "2011-12-30", status: "Planned" },
      { id: 2, title: "Early year", category: "Career prep", dueDate: "0099-07-01", status: "Planned" }
    ] }));
    await calendarPage.goto(base + "/timeline.html");
    await calendarPage.locator("#taskTimeline li").nth(1).waitFor();
    assert.equal(await calendarPage.locator('#taskTimeline time[datetime="2011-12-30"]').textContent(), "Dec 30, 2011");
    assert.equal(await calendarPage.locator('#taskTimeline time[datetime="0099-07-01"]').textContent(), "Jul 1, 99");
    await apia.close();
    console.log("PASS: calendar dates retain their day and early year in Pacific/Apia");
    for (const [timezoneId, today] of [["America/Los_Angeles", "2026-07-09"], ["Pacific/Apia", "2026-07-10"]]) {
      const context = await browser.newContext({ timezoneId });
      const detailsPage = await context.newPage();
      await detailsPage.clock.install({ time: new Date("2026-07-10T00:30:00Z") });
      const fixtures = [
        { id: 1, title: "Past task", dueDate: "2026-07-08", status: "Planned",
          description: "<b>Practice</b> " + "details ".repeat(100), estimatedHours: 2.5 },
        { id: 2, title: "Today task", dueDate: today, status: "In Progress", estimatedHours: 0 },
        { id: 3, title: "Future task", dueDate: "2026-07-11", status: "Planned" },
        { id: 4, title: "Finished task", dueDate: "2026-07-08", status: "Completed" }
      ].map(task => ({ category: "Interview prep", ...task }));
      await detailsPage.route("**/api/tasks", route => route.fulfill({ json: fixtures }));
      await detailsPage.goto(base + "/timeline.html");
      await detailsPage.locator("#taskTimeline li").nth(3).waitFor();
      for (const selector of ["#taskTimeline", "#taskList"]) {
        assert.equal(await detailsPage.locator(`${selector} .overdue-label`).count(), 1);
        const overdue = detailsPage.locator(`${selector} .overdue-date`);
        assert.equal(await overdue.getAttribute("datetime"), "2026-07-08");
        assert.notEqual(await overdue.evaluate(node => getComputedStyle(node).color),
          await detailsPage.locator(`${selector} time:not(.overdue-date)`).first().evaluate(node => getComputedStyle(node).color));
      }
      const info = detailsPage.getByRole("button", { name: "Details for Past task", exact: true });
      const popover = detailsPage.locator("#task-details-1");
      await info.focus();
      await detailsPage.keyboard.press("Enter");
      assert.equal(await popover.isVisible(), true);
      assert.match(await popover.textContent(), /Description: <b>Practice<\/b>/);
      assert.match(await popover.textContent(), /Category: Interview prep/);
      assert.match(await popover.textContent(), /Estimated hours: 2.5/);
      assert.equal(await popover.locator("b").count(), 0);
      await detailsPage.keyboard.press("Escape");
      assert.equal(await popover.isVisible(), false);
      assert.equal(await info.evaluate(node => node === document.activeElement), true);
      await info.click();
      await info.click();
      assert.equal(await popover.isVisible(), false);
      await info.click();
      await detailsPage.locator("#timelineHeader").click();
      assert.equal(await popover.isVisible(), false);
      await detailsPage.getByRole("button", { name: "Details for Today task", exact: true }).click();
      assert.match(await detailsPage.locator(":popover-open").textContent(), /Estimated hours: 0/);
      assert.match(await detailsPage.locator(":popover-open").textContent(), /No description provided/);
      for (const width of [390, 1440]) {
        await detailsPage.setViewportSize({ width, height: 700 });
        await info.click();
        const box = await popover.boundingBox();
        assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= width && box.y + box.height <= 700);
        if (width === 1440) assert.ok(box.x > width / 2);
        await detailsPage.keyboard.press("Escape");
      }
      await context.close();
    }
    console.log("PASS: local-day overdue rules in both lists; safe task details, keyboard/toggle/outside dismissal, mobile fit");
    await page.goto(base + "/dashboard.html");
    await page.goto(base + "/timeline.html#create");
    assert.equal(await page.locator("#taskCreationForm").isVisible(), true);
    assert.equal(await page.locator("#taskTitle").evaluate(node => node === document.activeElement), true);
    await page.goto(base + "/questions.html");
    await page.getByRole("checkbox").first().waitFor();
    const checkbox = page.getByRole("checkbox").first();
    await checkbox.check();
    await page.getByText("Progress saved.", { exact: true }).waitFor();
    await page.reload();
    await page.getByRole("checkbox").first().waitFor();
    assert.equal(await checkbox.isChecked(), true);
    await page.locator("#topic").selectOption({ index: 1 });
    assert.equal(await page.locator("#questions section").count(), 1);
    await page.goto(base + "/create.html");
    for (const [field, value] of Object.entries({ customerName: "Alex Student", service: "Resume review", date: "2026-07-09", time: "10:00" })) {
      await page.locator(`[name="${field}"]`).fill(value);
    }
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await page.waitForURL(base + "/");
    const appointments = await (await page.request.get(base + "/api/appointments")).json();
    assert.equal(appointments.length, 1);
    await page.goto(base + "/edit.html?id=" + appointments[0].id);
    await page.waitForFunction(() => document.querySelector('[name="customerName"]').value === "Alex Student");
    await page.locator('[name="service"]').fill("Interview review");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.waitForURL(base + "/");
    assert.equal((await (await page.request.get(base + "/api/appointments/" + appointments[0].id)).json()).service, "Interview review");
    await page.goto(base + "/edit.html?id=" + appointments[0].id);
    page.once("dialog", dialog => dialog.accept());
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await page.waitForURL(base + "/");
    assert.deepEqual(await (await page.request.get(base + "/api/appointments")).json(), []);
    console.log("PASS: create deep link/focus, question filter and saved progress, appointment create/edit/delete");
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const file of ["index", "dashboard", "timeline", "questions", "careerResources", "login", "create"]) {
        await page.goto(`${base}/${file}.html`);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${file} overflow at ${width}`);
        if (file !== "create") {
          assert.equal(await page.locator('nav [aria-current="page"]').count(), 1);
          assert.equal(await page.locator("nav a").count(), 6);
        }
      }
    }
    assert.deepEqual(errors, []);
    console.log("PASS: desktop/tablet/phone spacing, consistent navigation, active page, no uncaught browser errors");
  } finally {
    if (browser) await browser.close();
    if (server && server.exitCode === null) { server.kill(); await new Promise(resolve => server.once("exit", resolve)); }
    await rm(dir, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
