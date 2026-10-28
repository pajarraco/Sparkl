// Demo seed for the tasks.md §8 demo gate: one demo host, one demo
// cleaner (with service area + Friday availability), and one open Friday
// turnover job. Skip-if-present: existing demo emails sign in instead of
// signing up, and the job is skipped when the host already has one at the
// demo address — reruns never duplicate and never delete anything.
// All fixtures are obviously fake (demo@example.com, Demo Lane).
// Run: pnpm --filter @sparkl/api seed:demo
const API_BASE = process.env.SPKL_API_URL ?? "http://localhost:3000";
const PASSWORD = process.env.DEMO_PASSWORD ?? "demo-password-123";
// Better Auth rejects non-browser auth POSTs without an Origin header
// (403 MISSING_OR_NULL_ORIGIN); it must be a trusted origin — override
// with SEED_ORIGIN when the API trusts something else.
const ORIGIN = process.env.SEED_ORIGIN ?? "http://localhost:8081";

const HOST = {
  name: "Demo Host",
  email: "demo-host@example.com",
  role: "host",
};
const CLEANER = {
  name: "Demo Cleaner",
  email: "demo-cleaner@example.com",
  role: "cleaner",
};

const SERVICE_AREA = {
  serviceLat: 25.7617,
  serviceLng: -80.1918,
  serviceRadiusKm: 25,
};

const JOB_ADDRESS = "1 Demo Lane Apt 4 (demo)";

// Next Friday from today (UTC): advance day-by-day until getUTCDay() === 5.
function nextFridayWindows() {
  const day = new Date();
  day.setUTCHours(0, 0, 0, 0);
  while (day.getUTCDay() !== 5) day.setUTCDate(day.getUTCDate() + 1);
  const toStamp = (hours) => {
    const d = new Date(day);
    d.setUTCHours(hours, 0, 0, 0);
    return d.toISOString().replace(/\.\d{3}Z$/, "Z");
  };
  return { windowStart: toStamp(10), windowEnd: toStamp(13) };
}

// Minimal cookie jar: keep name=value pairs from set-cookie headers.
function jarHeaders(jar) {
  return jar.length > 0 ? { cookie: jar.join("; ") } : {};
}

function collectCookies(response, jar) {
  const setCookies =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [];
  for (const header of setCookies) {
    const pair = header.split(";")[0].trim();
    if (pair !== "") jar.push(pair);
  }
}

async function authJson(path, payload, jar) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: ORIGIN,
      ...jarHeaders(jar),
    },
    body: JSON.stringify(payload),
  });
  collectCookies(response, jar);
  if (!response.ok) {
    const text = await response.text();
    const err = new Error(`${path} -> ${response.status}: ${text}`);
    err.body = text;
    err.status = response.status;
    throw err;
  }
  return response;
}

// Sign up, or fall back to sign-in when the demo email already exists.
async function ensureAccount(account) {
  const jar = [];
  try {
    await authJson(
      "/api/auth/sign-up/email",
      {
        ...account,
        password: PASSWORD,
      },
      jar,
    );
    return { jar, reused: false };
  } catch (err) {
    if (/already exists|duplicate|taken/i.test(err.body ?? "")) {
      await authJson(
        "/api/auth/sign-in/email",
        {
          email: account.email,
          password: PASSWORD,
        },
        jar,
      );
      return { jar, reused: true };
    }
    throw err;
  }
}

async function trpcPost(procedure, input, jar) {
  const response = await fetch(`${API_BASE}/trpc/${procedure}?batch=1`, {
    method: "POST",
    headers: { "content-type": "application/json", ...jarHeaders(jar) },
    body: JSON.stringify({ 0: input }),
  });
  if (!response.ok) {
    throw new Error(
      `${procedure} -> ${response.status}: ${await response.text()}`,
    );
  }
  const body = await response.json();
  if (body[0]?.error) {
    throw new Error(`${procedure}: ${JSON.stringify(body[0].error)}`);
  }
  return body[0]?.result?.data;
}

async function trpcGet(procedure, input, jar) {
  const encoded = encodeURIComponent(JSON.stringify({ 0: input }));
  const response = await fetch(
    `${API_BASE}/trpc/${procedure}?batch=1&input=${encoded}`,
    { headers: { ...jarHeaders(jar) } },
  );
  if (!response.ok) {
    throw new Error(
      `${procedure} -> ${response.status}: ${await response.text()}`,
    );
  }
  const body = await response.json();
  if (body[0]?.error) {
    throw new Error(`${procedure}: ${JSON.stringify(body[0].error)}`);
  }
  return body[0]?.result?.data;
}

async function main() {
  const host = await ensureAccount(HOST);
  console.log(`host ${HOST.email}: ${host.reused ? "reused" : "created"}`);

  const cleaner = await ensureAccount(CLEANER);
  console.log(
    `cleaner ${CLEANER.email}: ${cleaner.reused ? "reused" : "created"}`,
  );

  await trpcPost("users.setServiceArea", SERVICE_AREA, cleaner.jar);
  console.log("cleaner service-area: set");

  const { windowStart, windowEnd } = nextFridayWindows();
  const weekday = new Date(windowStart).getUTCDay();
  await trpcPost(
    "users.setAvailability",
    { slots: [{ weekday, startTime: "09:00", endTime: "17:00" }] },
    cleaner.jar,
  );
  console.log("cleaner availability: set");

  const myJobs = await trpcGet("jobs.myJobs", {}, host.jar);
  const existing = myJobs.find((job) => job.address === JOB_ADDRESS);
  if (existing) {
    console.log(`job ${JOB_ADDRESS}: reused ${existing.id}`);
    return;
  }
  const created = await trpcPost(
    "jobs.create",
    {
      address: JOB_ADDRESS,
      latitude: 25.7617,
      longitude: -80.1918,
      windowStart,
      windowEnd,
      sizeSqm: 80,
      notes: "Demo turnover clean — obviously fake seed data",
      priceMinorUnits: 8500,
    },
    host.jar,
  );
  console.log(`job ${JOB_ADDRESS}: created ${created.id} (${windowStart})`);
}

try {
  await main();
} catch (err) {
  console.error(`seed:demo failed: ${err.message}`);
  process.exitCode = 1;
}
