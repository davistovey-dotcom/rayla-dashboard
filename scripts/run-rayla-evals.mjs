import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { defaultRaylaEvalPolicy, raylaEvalCases } from "./rayla-eval-cases.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const envLocalPath = path.join(repoRoot, ".env.local");

const LOCAL_ASK_RAYLA_URL = "http://localhost:54321/functions/v1/ask-rayla";
const PRODUCT_ASK_RAYLA_URL = "https://uoxzzhtnzmsolvcykynu.functions.supabase.co/ask-rayla";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, "utf8");
  return content
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.trim().startsWith("#"))
    .reduce((acc, line) => {
      const separatorIndex = line.indexOf("=");
      if (separatorIndex === -1) return acc;
      const key = line.slice(0, separatorIndex).trim();
      const rawValue = line.slice(separatorIndex + 1).trim();
      acc[key] = rawValue.replace(/^['"]|['"]$/g, "");
      return acc;
    }, {});
}

function parseArgs(argv) {
  const options = {
    list: false,
    dryRun: false,
    useProd: false,
    limit: null,
    filter: "",
    caseName: "",
    categories: [],
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--list") options.list = true;
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--prod") options.useProd = true;
    else if (arg === "--local") options.useProd = false;
    else if (arg === "--filter") options.filter = String(argv[i + 1] || "");
    else if (arg.startsWith("--filter=")) options.filter = arg.split("=").slice(1).join("=");
    else if (arg === "--case") options.caseName = String(argv[i + 1] || "");
    else if (arg.startsWith("--case=")) options.caseName = arg.split("=").slice(1).join("=");
    else if (arg === "--limit") options.limit = Number.parseInt(argv[i + 1] || "", 10);
    else if (arg.startsWith("--limit=")) options.limit = Number.parseInt(arg.split("=").slice(1).join("="), 10);
    else if (arg === "--category") options.categories.push(String(argv[i + 1] || ""));
    else if (arg.startsWith("--category=")) options.categories.push(arg.split("=").slice(1).join("="));
  }

  return options;
}

function normalizeText(value) {
  return String(value || "").toLowerCase();
}

function includesNormalized(haystack, needle) {
  return normalizeText(haystack).includes(normalizeText(needle));
}

function matchExpectation(answer, expectation) {
  if (Array.isArray(expectation)) {
    return expectation.some((entry) => includesNormalized(answer, entry));
  }
  return includesNormalized(answer, expectation);
}

function evaluateAnswer(caseDef, answer) {
  const mustContain = Array.isArray(caseDef.mustContain) ? caseDef.mustContain : [];
  const forbidden = [
    ...(Array.isArray(defaultRaylaEvalPolicy.globalForbiddenPhrases) ? defaultRaylaEvalPolicy.globalForbiddenPhrases : []),
    ...(Array.isArray(caseDef.forbidden) ? caseDef.forbidden : []),
    ...(Array.isArray(caseDef.forbiddenScopePivots) ? caseDef.forbiddenScopePivots : []),
  ];

  const missing = mustContain.filter((expectation) => !matchExpectation(answer, expectation));
  const hits = forbidden.filter((phrase) => includesNormalized(answer, phrase));

  return {
    pass: missing.length === 0 && hits.length === 0,
    missing,
    hits,
  };
}

function buildCaseList(options) {
  return raylaEvalCases.filter((caseDef) => {
    if (options.caseName && caseDef.name !== options.caseName) return false;
    if (options.filter && !normalizeText(`${caseDef.name} ${caseDef.category} ${caseDef.prompt}`).includes(normalizeText(options.filter))) {
      return false;
    }
    if (options.categories.length > 0 && !options.categories.some((category) => normalizeText(caseDef.category) === normalizeText(category))) {
      return false;
    }
    return true;
  }).slice(0, Number.isFinite(options.limit) && options.limit > 0 ? options.limit : undefined);
}

function resolveEndpoint(options, env) {
  if (process.env.RAYLA_EVAL_URL) return process.env.RAYLA_EVAL_URL;
  if (options.useProd) return PRODUCT_ASK_RAYLA_URL;
  if (env.VITE_USE_LOCAL_SUPABASE_FUNCTIONS === "true") return LOCAL_ASK_RAYLA_URL;
  return LOCAL_ASK_RAYLA_URL;
}

async function askRayla({ endpoint, anonKey, prompt, context }) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(anonKey ? { Authorization: `Bearer ${anonKey}` } : {}),
    },
    body: JSON.stringify({
      question: prompt,
      context,
    }),
  });

  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }

  if (!response.ok) {
    const message = json?.error || json?.message || text || `HTTP ${response.status}`;
    throw new Error(message);
  }

  return json?.answer || json?.response || text;
}

function printUsage() {
  console.log([
    "Rayla eval harness",
    "",
    "Usage:",
    "  npm run eval:rayla -- --list",
    "  npm run eval:rayla -- --dry-run --limit 5",
    "  npm run eval:rayla -- --filter anchor",
    "  npm run eval:rayla -- --category \"Conversational anchoring\"",
    "  npm run eval:rayla -- --case anchor-profit-scenario-trade",
    "  npm run eval:rayla -- --prod --limit 3",
    "",
    "Notes:",
    "  - Defaults to the local Supabase function endpoint.",
    "  - Nothing runs unless you invoke this script explicitly.",
    "  - Use --dry-run to inspect the selected cases without making API calls.",
  ].join("\n"));
}

async function main() {
  const envFile = loadEnvFile(envLocalPath);
  const env = { ...envFile, ...process.env };
  const options = parseArgs(process.argv.slice(2));
  const selectedCases = buildCaseList(options);

  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printUsage();
    return;
  }

  if (options.list) {
    console.log(`Loaded ${raylaEvalCases.length} Rayla eval cases.`);
    for (const caseDef of selectedCases.length ? selectedCases : raylaEvalCases) {
      console.log(`- ${caseDef.name} [${caseDef.category}]`);
    }
    return;
  }

  if (!selectedCases.length) {
    console.error("No matching Rayla eval cases found.");
    process.exitCode = 1;
    return;
  }

  const endpoint = resolveEndpoint(options, env);
  const anonKey = env.VITE_SUPABASE_ANON_KEY || "";

  console.log(`Running ${selectedCases.length} Rayla eval case(s) against ${endpoint}`);
  if (options.dryRun) {
    for (const caseDef of selectedCases) {
      console.log(`\n[DRY RUN] ${caseDef.name}`);
      console.log(`Prompt: ${caseDef.prompt}`);
      console.log(`Category: ${caseDef.category}`);
      if (caseDef.notes) console.log(`Notes: ${caseDef.notes}`);
    }
    return;
  }

  let passCount = 0;
  let failCount = 0;

  for (const caseDef of selectedCases) {
    console.log(`\n=== ${caseDef.name} [${caseDef.category}] ===`);
    console.log(`Prompt: ${caseDef.prompt}`);
    try {
      const answer = await askRayla({
        endpoint,
        anonKey,
        prompt: caseDef.prompt,
        context: caseDef.context,
      });
      const result = evaluateAnswer(caseDef, answer);
      if (result.pass) {
        passCount += 1;
        console.log("PASS");
      } else {
        failCount += 1;
        console.log("FAIL");
      }
      console.log(`Answer: ${answer}`);
      if (result.missing.length) {
        console.log(`Missing expectations: ${result.missing.map((item) => Array.isArray(item) ? item.join(" | ") : item).join("; ")}`);
      }
      if (result.hits.length) {
        console.log(`Forbidden hits: ${result.hits.join("; ")}`);
      }
      if (caseDef.notes) {
        console.log(`Notes: ${caseDef.notes}`);
      }
    } catch (error) {
      failCount += 1;
      console.log("ERROR");
      console.log(String(error?.message || error));
    }
  }

  console.log(`\nSummary: ${passCount} passed, ${failCount} failed, ${selectedCases.length} total.`);
  if (failCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
