/**
 * Headless UI smoke test (development only).
 *
 * Requires the Vite dev server to be running with VITE_USE_MOCK=true.
 * Usage: node scripts/ui-smoke.mjs [baseUrl]
 */
import puppeteer from 'puppeteer-core';

const BASE = process.argv[2] || 'http://localhost:3000';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const ACCOUNTS = [
  {
    role: 'faculty',
    email: 'faculty@college.edu',
    home: '/faculty/dashboard',
    routes: [
      '/faculty/dashboard',
      '/faculty/profile',
      '/faculty/qualifications',
      '/faculty/experience',
      '/faculty/activities',
      '/faculty/category-1',
      '/faculty/category-2',
      '/faculty/category-3',
      '/faculty/documents',
      '/faculty/api-score',
      '/faculty/reports',
      '/faculty/notifications',
      '/faculty/change-password',
    ],
  },
  {
    role: 'hod',
    email: 'hod@college.edu',
    home: '/hod/dashboard',
    routes: [
      '/hod/dashboard',
      '/hod/faculty-members',
      '/hod/faculty-profiles',
      '/hod/verification',
      '/hod/pending-approvals',
      '/hod/approved-activities',
      '/hod/rejected-activities',
      '/hod/reports',
      '/hod/notifications',
    ],
  },
  {
    role: 'admin',
    email: 'admin@college.edu',
    home: '/admin/dashboard',
    routes: [
      '/admin/dashboard',
      '/admin/users',
      '/admin/faculty',
      '/admin/departments',
      '/admin/academic-years',
      '/admin/scoring-rules',
      '/admin/categories',
      '/admin/reports',
      '/admin/audit-logs',
      '/admin/settings',
      '/admin/notifications',
    ],
  },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const run = async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  const failures = [];

  for (const account of ACCOUNTS) {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(`console: ${msg.text()}`);
    });
    page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));

    try {
      await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#identifier', { timeout: 20000 });
      await page.type('#identifier', account.email);
      await page.type('#password', 'Demo@123');
      await Promise.all([
        page.waitForFunction((home) => window.location.pathname === home, { timeout: 20000 }, account.home),
        page.click('button[type="submit"]'),
      ]);
      console.log(`PASS login ${account.role}`);
    } catch (error) {
      failures.push(`${account.role}: login failed — ${error.message}`);
      await context.close();
      continue;
    }

    for (const route of account.routes) {
      const routeErrors = [];
      const listener = (msg) => {
        if (msg.type() === 'error') routeErrors.push(`console: ${msg.text()}`);
      };
      const errorListener = (err) => routeErrors.push(`pageerror: ${err.message}`);
      page.on('console', listener);
      page.on('pageerror', errorListener);

      try {
        await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' });
        await sleep(900);
        const state = await page.evaluate(() => {
          const danger = [...document.querySelectorAll('.alert-box-danger')]
            .map((node) => node.textContent.trim())
            .filter(Boolean);
          return {
            path: window.location.pathname,
            hasLayout: Boolean(document.querySelector('.app-layout')),
            bodyLength: document.body.innerText.trim().length,
            danger,
            overflow: document.documentElement.scrollWidth - window.innerWidth,
          };
        });

        if (state.path !== route) {
          failures.push(`${account.role} ${route}: redirected to ${state.path}`);
        } else if (!state.hasLayout && route !== '/403') {
          failures.push(`${account.role} ${route}: layout did not render`);
        } else if (state.bodyLength < 50) {
          failures.push(`${account.role} ${route}: page looks empty`);
        }
        if (state.danger.length) {
          failures.push(`${account.role} ${route}: error banner → ${state.danger.join(' | ')}`);
        }
        if (state.overflow > 2) {
          failures.push(`${account.role} ${route}: horizontal overflow ${state.overflow}px`);
        }
        if (routeErrors.length) {
          failures.push(`${account.role} ${route}: ${routeErrors.join(' | ')}`);
        }
        console.log(`PASS ${account.role} ${route}${state.danger.length ? ' (error banner)' : ''}`);
      } catch (error) {
        failures.push(`${account.role} ${route}: ${error.message}`);
      } finally {
        page.off('console', listener);
        page.off('pageerror', errorListener);
      }
    }

    // Mobile layout pass: no horizontal page overflow at 390px.
    await page.setViewport({ width: 390, height: 844 });
    for (const route of account.routes) {
      await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' });
      await sleep(500);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth
      );
      if (overflow > 2) {
        failures.push(`${account.role} ${route}: mobile horizontal overflow ${overflow}px`);
      }
    }
    console.log(`PASS ${account.role} mobile layout`);
    await page.setViewport({ width: 1440, height: 900 });

    if (consoleErrors.length) {
      failures.push(`${account.role}: console errors during session → ${consoleErrors.join(' | ')}`);
    }
    await context.close();
  }

  await browser.close();

  if (failures.length) {
    console.log('\nFAILURES');
    failures.forEach((failure) => console.log(` - ${failure}`));
    process.exitCode = 1;
  } else {
    console.log('\nAll routes rendered without console errors or error banners.');
  }
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
