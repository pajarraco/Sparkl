import type { APIRequestContext, Browser, Page } from "@playwright/test";
import { expect, request } from "@playwright/test";

// Shared E2E fixtures (context/features/01-e2e-testing-implementation.md
// step 2). Every account is timestamped per worker so parallel or repeated
// runs never collide; nothing here depends on the section-8 seed script.
// Routine suites start from API-seeded sessions; only the auth suite
// drives the real sign-up/sign-in UI.

export const API_URL = process.env.SPKL_API_URL ?? "http://localhost:3000";

export type AppRole = "host" | "cleaner";

export interface TestAccount {
  name: string;
  email: string;
  password: string;
  role: AppRole;
}

export function uniqueAccount(role: AppRole, workerIndex: number): TestAccount {
  const stamp = `${Date.now()}-w${workerIndex}`;
  return {
    name: `E2E ${role} ${stamp}`,
    email: `e2e-${role}-${stamp}@example.com`,
    password: "password123",
    role,
  };
}

export async function signUpViaApi(
  api: APIRequestContext,
  account: TestAccount,
): Promise<void> {
  const response = await api.post(`${API_URL}/api/auth/sign-up/email`, {
    data: {
      name: account.name,
      email: account.email,
      password: account.password,
      role: account.role,
    },
  });
  expect(response.ok()).toBe(true);
}

export interface SeededJob {
  id: string;
}

const DEFAULT_JOB = {
  address: "7 E2E Row Apt 1",
  latitude: 25.7617,
  longitude: -80.1918,
  windowStart: "2026-11-07T10:00:00Z",
  windowEnd: "2026-11-07T13:00:00Z",
  sizeSqm: 80,
  notes: "E2E seeded job, obviously fake",
  priceMinorUnits: 8500,
};

export async function seedOpenJob(
  api: APIRequestContext,
  overrides: Partial<typeof DEFAULT_JOB> = {},
): Promise<SeededJob> {
  // tRPC batch POST takes the raw input per slot; the `json` envelope
  // is GET-only.
  const response = await api.post(`${API_URL}/trpc/jobs.create?batch=1`, {
    data: { "0": { ...DEFAULT_JOB, ...overrides } },
  });
  expect(response.ok()).toBe(true);
  const body = (await response.json()) as Array<{
    result?: { data?: { id?: string } };
  }>;
  const id = body[0]?.result?.data?.id;
  expect(typeof id).toBe("string");
  return { id: id as string };
}

// Finds a job id by its exact address through the given authenticated
// API session (tRPC batch GET, plain JSON — no transformer). Lets suites
// locate a UI-posted job and keep asserting by testID afterwards.
export async function jobIdByAddress(
  api: APIRequestContext,
  procedure: "jobs.myJobs" | "jobs.myClaimed",
  address: string,
): Promise<string> {
  // tRPC batch GET takes the raw input per slot, like POST.
  const response = await api.get(
    `${API_URL}/trpc/${procedure}?batch=1&input=${encodeURIComponent(
      JSON.stringify({ "0": {} }),
    )}`,
  );
  expect(response.ok()).toBe(true);
  const body = (await response.json()) as Array<{
    result?: { data?: Array<{ id?: string; address?: string }> };
  }>;
  const match = body[0]?.result?.data?.find((job) => job.address === address);
  expect(match?.id).toBeTruthy();
  return match?.id as string;
}

// Same-day 10:00–13:00 UTC window for a YYYY-MM-DD day string. Keeps the
// windowStart/windowEnd clump in one place; spread into seedOpenJob.
export function dayWindow(day: string): {
  windowStart: string;
  windowEnd: string;
} {
  return {
    windowStart: `${day}T10:00:00Z`,
    windowEnd: `${day}T13:00:00Z`,
  };
}

// Pins the ranked board to one day and asserts the seeded card is visible.
// The board is score-sorted with no pagination, so filtering beats relying
// on rank position; the expect turns a missing card into a fast failure
// (a raw click waits without a timeout).
export async function pinBoardToDay(
  page: Page,
  day: string,
  jobId: string,
): Promise<void> {
  await page.goto("/board");
  await page.getByTestId("cleaner-board-date").fill(day);
  await page.getByTestId("cleaner-board-apply").click();
  await expect(page.getByTestId(`cleaner-board-card-${jobId}`)).toBeVisible();
}

// Visible-then-act wrappers. A raw click/fill waits without a timeout,
// so a never-rendered target hangs the suite to the test timeout with no
// location. These fail fast at the exact missing element instead; on the
// success path they resolve immediately.
export async function tap(page: Page, testId: string): Promise<void> {
  await expect(page.getByTestId(testId)).toBeVisible();
  await page.getByTestId(testId).click();
}

export async function fillInto(
  page: Page,
  testId: string,
  value: string,
): Promise<void> {
  await expect(page.getByTestId(testId)).toBeVisible();
  await page.getByTestId(testId).fill(value);
}

// Authenticated API context for a fresh timestamped account: signs the
// account up (cookie lands in the context jar) and hands back both the
// context and the account. Callers close the context.
export async function newApiSession(
  role: AppRole,
  workerIndex: number,
): Promise<{ api: APIRequestContext; account: TestAccount }> {
  const api = await request.newContext();
  const account = uniqueAccount(role, workerIndex);
  await signUpViaApi(api, account);
  return { api, account };
}

// Authenticated BROWSER context for routine suites: same timestamped
// sign-up, then the cookie jar is persisted so page tests start logged
// in without touching the auth UI. Callers close the context.
export async function newBrowserSession(
  browser: Browser,
  role: AppRole,
  workerIndex: number,
): Promise<{
  context: Awaited<ReturnType<Browser["newContext"]>>;
  account: TestAccount;
}> {
  const context = await browser.newContext();
  const account = uniqueAccount(role, workerIndex);
  await signUpViaApi(context.request, account);
  return { context, account };
}
