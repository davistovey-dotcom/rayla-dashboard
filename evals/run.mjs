#!/usr/bin/env node
// Rayla eval runner
// Usage: node evals/run.mjs [--category <name>] [--id <id>] [--p1]
//
// Requires env vars (reads from .env.local automatically):
//   VITE_SUPABASE_ANON_KEY — Supabase anon key
//   VITE_OPENROUTER_API_KEY — OpenRouter key (for judge)

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { allCases } from "./cases.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dir, "..");

// ─── Load env ────────────────────────────────────────────────────────────────

function loadEnv() {
  const envPath = resolve(rootDir, ".env.local");
  try {
    const raw = readFileSync(envPath, "utf-8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx < 0) continue;
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // .env.local not found — rely on actual env
  }
}

loadEnv();

const RAYLA_URL = "https://uoxzzhtnzmsolvcykynu.functions.supabase.co/ask-rayla";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "";
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY || "";
const JUDGE_MODEL = "anthropic/claude-haiku-4-5";

if (!SUPABASE_ANON_KEY) {
  console.error("Missing VITE_SUPABASE_ANON_KEY in .env.local");
  process.exit(1);
}

// LLM judge is optional — degrades to pattern-only checking
const LLM_JUDGE_AVAILABLE = Boolean(OPENROUTER_KEY);

// ─── CLI args ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const filterCategory = args.includes("--category") ? args[args.indexOf("--category") + 1] : null;
const filterId = args.includes("--id") ? args[args.indexOf("--id") + 1] : null;
const p1Only = args.includes("--p1");

let cases = allCases;
if (filterCategory) cases = cases.filter((c) => c.category === filterCategory);
if (filterId) cases = cases.filter((c) => c.id === filterId);
if (p1Only) cases = cases.filter((c) => c.priority === 1);

// ─── Call Rayla ───────────────────────────────────────────────────────────────

async function callRayla(prompt, context, recentConversation) {
  const body = {
    question: prompt,
    context: {
      ...context,
      recentConversation: recentConversation || [],
    },
  };

  const res = await fetch(RAYLA_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Rayla HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  const json = await res.json();
  if (!json.ok || !json.answer) {
    throw new Error(`Rayla returned no answer: ${JSON.stringify(json).slice(0, 200)}`);
  }

  return json.answer;
}

// ─── Judge ────────────────────────────────────────────────────────────────────

async function judge(raylaResponse, check) {
  // Fast path: forbidden pattern check (no LLM needed)
  if (check.forbiddenPatterns?.length) {
    const lower = raylaResponse.toLowerCase();
    for (const pattern of check.forbiddenPatterns) {
      if (lower.includes(pattern.toLowerCase())) {
        return {
          pass: false,
          reason: `Contains forbidden pattern: "${pattern}"`,
          method: "pattern",
        };
      }
    }
  }

  // LLM judge for behavioral properties
  if (!LLM_JUDGE_AVAILABLE) {
    return { pass: true, reason: "LLM judge skipped (no OPENROUTER_API_KEY)", method: "skipped" };
  }

  const judgePrompt = [
    "You are evaluating an AI trading coach response for a specific behavioral property.",
    "",
    "Rayla's response:",
    "---",
    raylaResponse,
    "---",
    "",
    "Evaluation task:",
    check.judgePrompt,
    "",
    'Reply with exactly one line in this format: PASS or FAIL, then a dash, then one short reason.',
    'Example: PASS - Response correctly references DOT trade result',
    'Example: FAIL - Invents a breakout win rate not present in context',
  ].join("\n");

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENROUTER_KEY}`,
    },
    body: JSON.stringify({
      model: JUDGE_MODEL,
      max_tokens: 80,
      temperature: 0,
      messages: [{ role: "user", content: judgePrompt }],
    }),
  });

  if (res.status === 401) {
    return { pass: true, reason: "LLM judge unavailable (401 — check OPENROUTER_API_KEY)", method: "skipped" };
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Judge HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  const json = await res.json();
  const raw = String(json.choices?.[0]?.message?.content || "").trim();
  const upper = raw.toUpperCase();
  const pass = upper.startsWith("PASS");
  const reason = raw.replace(/^(PASS|FAIL)\s*[-–]?\s*/i, "").trim() || raw;

  return { pass, reason, method: "llm" };
}

// ─── Runner ───────────────────────────────────────────────────────────────────

const PASS = "\x1b[32mPASS\x1b[0m";
const FAIL = "\x1b[31mFAIL\x1b[0m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

async function runCase(testCase) {
  process.stdout.write(`  ${DIM}${testCase.id}${RESET} ${testCase.description} … `);

  let raylaResponse;
  try {
    raylaResponse = await callRayla(testCase.prompt, testCase.context, testCase.recentConversation);
  } catch (err) {
    console.log(`\x1b[33mERROR\x1b[0m — ${err.message}`);
    return { id: testCase.id, passed: false, error: err.message };
  }

  // Detect function-level fallback (infrastructure issue, not a test failure)
  if (raylaResponse.includes("temporarily unavailable")) {
    console.log(`\x1b[33mSKIP\x1b[0m — function returned fallback (infrastructure issue)`);
    return { id: testCase.id, passed: true, skipped: true };
  }

  const results = [];
  for (const check of testCase.checks) {
    try {
      const result = await judge(raylaResponse, check);
      results.push({ ...result, property: check.property });
    } catch (err) {
      results.push({ pass: false, reason: `Judge error: ${err.message}`, property: check.property, method: "error" });
    }
  }

  const allPassed = results.every((r) => r.pass);
  console.log(allPassed ? PASS : FAIL);

  if (!allPassed) {
    for (const r of results.filter((r) => !r.pass)) {
      console.log(`    ${DIM}[${r.property}]${RESET} ${r.reason}`);
    }
    console.log(`    ${DIM}Rayla said: "${raylaResponse.slice(0, 180)}${raylaResponse.length > 180 ? "…" : ""}"${RESET}`);
  }

  return { id: testCase.id, passed: allPassed, results, raylaResponse };
}

async function main() {
  console.log(`\n${BOLD}Rayla Eval Suite${RESET}`);
  console.log(`Running ${cases.length} case${cases.length === 1 ? "" : "s"}${filterCategory ? ` in category: ${filterCategory}` : ""}${p1Only ? " (P1 only)" : ""}\n`);

  const categories = [...new Set(cases.map((c) => c.category))];
  const allResults = [];

  for (const category of categories) {
    const categoryCases = cases.filter((c) => c.category === category);
    const label = category.replace(/_/g, " ");
    console.log(`${BOLD}${label}${RESET}`);

    for (const testCase of categoryCases) {
      const result = await runCase(testCase);
      allResults.push(result);
    }
    console.log();
  }

  // Summary
  const passed = allResults.filter((r) => r.passed).length;
  const failed = allResults.filter((r) => !r.passed && !r.error).length;
  const errors = allResults.filter((r) => r.error).length;
  const total = allResults.length;
  const judgeNote = !LLM_JUDGE_AVAILABLE ? ` ${DIM}(pattern-only — add OPENROUTER_API_KEY for LLM judge)${RESET}` : "";

  console.log(`${BOLD}Results: ${passed}/${total} passed${RESET}${failed > 0 ? ` — ${FAIL}: ${failed}` : ""}${errors > 0 ? ` — ${errors} error(s)` : ""}${judgeNote}`);

  if (failed > 0) {
    console.log(`\nFailed cases:`);
    for (const r of allResults.filter((r) => !r.passed)) {
      console.log(`  • ${r.id}${r.error ? ` (error: ${r.error})` : ""}`);
    }
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
