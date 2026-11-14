/**
 * Headless interaction smoke test (development only, mock mode).
 * Verifies the main write paths: faculty activity creation/submission,
 * HOD verification and admin user creation.
 *
 * Usage: node scripts/ui-flows.mjs [baseUrl]
 */
import puppeteer from 'puppeteer-core';

const BASE = process.argv[2] || 'http://localhost:3000';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const login = async (page, email) => {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#identifier');
  await page.type('#identifier', email);
  await page.type('#password', 'Demo@123');
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => window.location.pathname.includes('/dashboard'), { timeout: 20000 });
  await sleep(600);
};

const clickByText = async (page, selector, text) => {
  const handle = await page.evaluateHandle(
    (sel, label) =>
      [...document.querySelectorAll(sel)].find((node) => node.textContent.trim().includes(label)),
    selector,
    text
  );
  const element = handle.asElement();
  if (!element) throw new Error(`No ${selector} containing "${text}"`);
  await element.click();
  return element;
};

const run = async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const failures = [];

  // ---------------------------------------------------------------- Faculty
  {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    page.on('pageerror', (err) => failures.push(`faculty pageerror: ${err.message}`));
    try {
      await login(page, 'faculty@college.edu');
      await page.goto(`${BASE}/faculty/category-1`, { waitUntil: 'domcontentloaded' });
      await sleep(800);

      await clickByText(page, 'button', 'Add Teaching Activity');
      await page.waitForSelector('#title', { visible: true });
      await page.type('#title', 'Smoke Test Course Delivery');
      await page.type('#details', 'Automated smoke test activity describing delivered lectures.');
      const year = await page.$eval('#academicYear', (select) =>
        [...select.options].map((option) => option.value).find((value) => value)
      );
      if (year) await page.select('#academicYear', year);
      await clickByText(page, 'button', 'Save as Draft');
      await sleep(1200);

      const created = await page.evaluate(() =>
        document.body.innerText.includes('Smoke Test Course Delivery')
      );
      if (!created) failures.push('faculty: created draft did not appear in the table');
      else console.log('PASS faculty create activity (draft)');

      const submitted = await page.evaluate(() => {
        const row = [...document.querySelectorAll('tr')].find((tr) =>
          tr.innerText.includes('Smoke Test Course Delivery')
        );
        if (!row) return false;
        const button = [...row.querySelectorAll('button')].find((b) =>
          b.textContent.trim() === 'Submit'
        );
        if (!button) return false;
        button.click();
        return true;
      });
      if (!submitted) failures.push('faculty: submit action not available for the new draft');
      await sleep(1200);
      const pending = await page.evaluate(() => {
        const row = [...document.querySelectorAll('tr')].find((tr) =>
          tr.innerText.includes('Smoke Test Course Delivery')
        );
        return Boolean(row && /pending/i.test(row.innerText));
      });
      if (!pending) failures.push('faculty: activity did not move to Pending after submit');
      else console.log('PASS faculty submit activity');
    } catch (error) {
      failures.push(`faculty flow: ${error.message}`);
    }
    await context.close();
  }

  // -------------------------------------------------------------------- HOD
  {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    page.on('pageerror', (err) => failures.push(`hod pageerror: ${err.message}`));
    try {
      await login(page, 'hod@college.edu');
      await page.goto(`${BASE}/hod/pending-approvals`, { waitUntil: 'domcontentloaded' });
      await sleep(900);

      await clickByText(page, 'button', 'Review');
      await page.waitForSelector('#verification-remarks', { visible: true });
      await page.type('#verification-remarks', 'Verified during automated smoke test.');
      await clickByText(page, 'button', 'Approve activity');
      await sleep(500);
      await clickByText(page, 'button', 'Confirm approval');
      await sleep(1400);

      const approved = await page.evaluate(() =>
        /approved/i.test(document.body.innerText) &&
        [...document.querySelectorAll('.alert-box-success')].some((node) =>
          /approved/i.test(node.textContent)
        )
      );
      if (!approved) failures.push('hod: approval success message not shown');
      else console.log('PASS hod approve activity');
    } catch (error) {
      failures.push(`hod flow: ${error.message}`);
    }
    await context.close();
  }

  // ------------------------------------------------------------------ Admin
  {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    page.on('pageerror', (err) => failures.push(`admin pageerror: ${err.message}`));
    try {
      await login(page, 'admin@college.edu');
      await page.goto(`${BASE}/admin/users`, { waitUntil: 'domcontentloaded' });
      await sleep(900);

      await clickByText(page, 'button', 'Add user');
      await page.waitForSelector('#user-name', { visible: true });
      const stamp = Date.now().toString().slice(-6);
      await page.type('#user-name', 'Smoke Test Faculty');
      await page.type('#user-employee-id', `SMK${stamp}`);
      await page.type('#user-email', `smoke.${stamp}@college.edu`);
      const departmentId = await page.$eval('#user-department', (select) =>
        [...select.options].map((option) => option.value).find((value) => value)
      );
      if (departmentId) await page.select('#user-department', departmentId);
      await clickByText(page, 'button', 'Create user');
      await sleep(1400);

      const created = await page.evaluate(() =>
        [...document.querySelectorAll('td')].some((cell) =>
          cell.textContent.includes('Smoke Test Faculty')
        )
      );
      if (!created) failures.push('admin: new user did not appear in the table');
      else console.log('PASS admin create user');
    } catch (error) {
      failures.push(`admin flow: ${error.message}`);
    }
    await context.close();
  }

  await browser.close();
  if (failures.length) {
    console.log('\nFAILURES');
    failures.forEach((failure) => console.log(` - ${failure}`));
    process.exitCode = 1;
  } else {
    console.log('\nAll interaction flows passed.');
  }
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
