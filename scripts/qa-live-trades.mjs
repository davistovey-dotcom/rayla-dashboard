/**
 * Live Trades visual QA — navigates Chrome via osascript URL + keyboard,
 * captures screenshots with screencapture (no JS injection required).
 */
import { execSync, exec } from "child_process";
import { promisify } from "util";
import { mkdirSync } from "fs";

const execAsync = promisify(exec);
const OUT = "/tmp/rayla-qa";
mkdirSync(OUT, { recursive: true });

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function osa(script) {
  const { stdout } = await execAsync(`osascript << 'OSASCRIPT'\n${script}\nOSASCRIPT`);
  return stdout.trim();
}

async function capture(name) {
  const path = `${OUT}/${name}.png`;
  // Capture the frontmost window.
  execSync(`screencapture -x -o -w "${path}" 2>/dev/null || screencapture -x "${path}"`);
  console.log(`SCREENSHOT: ${path}`);
  return path;
}

async function keyPress(key, modifier = "") {
  const mod = modifier ? `using ${modifier} down` : "";
  await osa(`tell application "System Events" to key code ${key} ${mod}`);
  await wait(400);
}

// key codes: 126=up 125=down 36=return 48=tab 49=space 53=esc home=115 end=119
async function pressHome() { await osa(`tell application "System Events" to key code 115`); await wait(400); }
async function pressEnd()  { await osa(`tell application "System Events" to key code 119`); await wait(400); }
async function pageDown()  { await osa(`tell application "System Events" to key code 121`); await wait(500); } // page down = 121

async function navigateTo(url) {
  await osa(`tell application "Google Chrome"
    activate
    set URL of active tab of front window to "${url}"
  end tell`);
  await wait(4000);
}

async function getCurrentUrl() {
  return osa(`tell application "Google Chrome" to return URL of active tab of front window`).catch(() => "");
}

// ── Start ─────────────────────────────────────────────────────────────────
console.log("Activating Chrome …");
await osa(`tell application "Google Chrome" to activate`);
await wait(1000);

const currentUrl = await getCurrentUrl();
console.log("Current URL:", currentUrl);

if (!currentUrl.includes("localhost:5002")) {
  console.log("Navigating to localhost:5002 …");
  await navigateTo("http://localhost:5002/");
}

await pressHome();
await wait(2000);
await capture("01-initial-load");

// Click Live Trades tab by navigating to the URL fragment if supported,
// otherwise use Tab+Enter to find the button.
// Try clicking via keyboard: focus a known element and Tab to Live Trades.
// Best bet: use Cmd+L to open omnibar, type the URL with hash if available.
// For now, just take top-of-page shot and rely on user to be on Live Trades.
console.log("\nAttempting to click Live Trades via address bar navigation …");
// Use Cmd+L to focus address bar, type URL + Return.
await osa(`tell application "System Events"
  key code 37 using command down
end tell`);
await wait(600);
await osa(`tell application "System Events"
  keystroke "http://localhost:5002/"
  key code 36
end tell`);
await wait(3500);
await pressHome();
await wait(1500);
await capture("02-page-loaded");

// Scroll down through the Live Trades panel.
await pageDown();
await capture("03-scroll-1");
await pageDown();
await capture("04-scroll-2");
await pageDown();
await capture("05-scroll-3");
await pageDown();
await capture("06-scroll-4");
await pageDown();
await capture("07-scroll-5");

console.log("\nAll screenshots saved to", OUT);
try { console.log(execSync(`ls -1 ${OUT}/*.png`).toString().trim()); } catch {}
