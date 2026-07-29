/**
 * Pre-seed the Clerk PRODUCTION instance with the users that exist in the
 * DEVELOPMENT instance.
 *
 * Why this exists: Clerk cannot transfer users between instances, and the
 * shipped app authenticates against a development instance that is capped at
 * 100 users. Rather than making everyone re-register (which would orphan their
 * data, since every table is scoped by the Clerk `userId`), we create each user
 * up front in production with `external_id` set to their OLD dev id.
 *
 * Two properties make that work, both verified against the live instances:
 *   1. Users created through the Backend API get `verification.status:
 *      "verified"` on their email (strategy `admin`).
 *   2. Clerk links an OAuth sign-in to an existing account when the email is
 *      already present and verified — the user keeps the id we created here.
 *
 * So the old -> new id map is known BEFORE anyone signs in, which is what lets
 * `remap-user-ids.ts` rewrite the database ahead of the cutover.
 *
 * Idempotent by design: re-running only creates users that are missing. Dev
 * still gains a few signups a day, so this is meant to be run once now and
 * again immediately before the cutover to pick up stragglers.
 *
 *   pnpm --filter @repo/web clerk:preseed            # dry run, writes nothing
 *   pnpm --filter @repo/web clerk:preseed --confirm  # actually creates users
 */

const DEV_KEY = process.env.CLERK_SECRET_KEY;
const PROD_KEY = process.env.CLERK_PROD_SECRET_KEY;

const CONFIRM = process.argv.includes("--confirm");
const OUT_DIR = ".clerk-migration";
// A dry run must never clobber the map a confirmed run produced — remap-user-ids
// depends on that file, and silently replacing it with an unusable copy is a
// trap. Dry runs get their own filename.
const OUT_FILE = CONFIRM ? `${OUT_DIR}/user-map.json` : `${OUT_DIR}/user-map.dry-run.json`;

// Clerk rate limits CreateUser. This is deliberately unhurried — 91 users at
// 250ms is under a minute, and a 429 mid-run is far more annoying than waiting.
const CREATE_DELAY_MS = 250;
const MAX_RETRIES = 5;

type ClerkEmail = {
  id: string;
  email_address: string;
  verification: { status: string | null } | null;
};

type ClerkUser = {
  id: string;
  external_id: string | null;
  primary_email_address_id: string | null;
  email_addresses: ClerkEmail[];
  first_name: string | null;
  last_name: string | null;
  created_at: number;
  external_accounts: { provider: string }[];
};

type MappingRow = {
  devUserId: string;
  prodUserId: string;
  email: string;
  action: "created" | "already-seeded" | "matched-by-email";
};

function die(message: string): never {
  console.error(`\n${message}\n`);
  process.exit(1);
}

async function clerk<T>(key: string, path: string, init?: RequestInit): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`https://api.clerk.com/v1${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });

    // Back off and retry on rate limit, but only on rate limit — a 4xx from a
    // bad payload should surface immediately rather than being retried 5 times.
    if (res.status === 429 && attempt < MAX_RETRIES) {
      const wait = Number(res.headers.get("retry-after") ?? 2) * 1000 * (attempt + 1);
      console.warn(`  rate limited, waiting ${wait}ms…`);
      await sleep(wait);
      continue;
    }

    const text = await res.text();
    if (!res.ok) throw new Error(`${init?.method ?? "GET"} ${path} -> ${res.status}: ${text}`);
    return (text ? JSON.parse(text) : null) as T;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchAllUsers(key: string, label: string): Promise<ClerkUser[]> {
  const all: ClerkUser[] = [];
  const limit = 100;
  for (let offset = 0; ; offset += limit) {
    const page = await clerk<ClerkUser[]>(
      key,
      `/users?limit=${limit}&offset=${offset}&order_by=%2Bcreated_at`
    );
    all.push(...page);
    if (page.length < limit) break;
  }
  console.log(`  ${label}: ${all.length} users`);
  return all;
}

function primaryEmail(user: ClerkUser): string | null {
  const chosen =
    user.email_addresses.find((e) => e.id === user.primary_email_address_id) ??
    user.email_addresses[0];
  return chosen?.email_address?.toLowerCase() ?? null;
}

async function main(): Promise<void> {
  if (!DEV_KEY) die("CLERK_SECRET_KEY is missing from the root .env");
  if (!PROD_KEY) die("CLERK_PROD_SECRET_KEY is missing from the root .env");

  // Guard against the keys being swapped. Writing 91 users into the wrong
  // instance is not something you want to discover afterwards.
  if (!DEV_KEY.startsWith("sk_test_")) die("CLERK_SECRET_KEY should be the dev key (sk_test_…)");
  if (!PROD_KEY.startsWith("sk_live_"))
    die("CLERK_PROD_SECRET_KEY should be the prod key (sk_live_…)");

  const [devInstance, prodInstance] = await Promise.all([
    clerk<{ id: string; environment_type: string }>(DEV_KEY, "/instance"),
    clerk<{ id: string; environment_type: string }>(PROD_KEY, "/instance"),
  ]);
  if (devInstance.environment_type !== "development")
    die(`Source is not a development instance: ${devInstance.environment_type}`);
  if (prodInstance.environment_type !== "production")
    die(`Target is not a production instance: ${prodInstance.environment_type}`);

  console.log(`\nSource (dev):  ${devInstance.id}`);
  console.log(`Target (prod): ${prodInstance.id}`);
  console.log(
    CONFIRM
      ? "\nMode: CONFIRM — users will be created\n"
      : "\nMode: DRY RUN — nothing will be written (pass --confirm to apply)\n"
  );

  const devUsers = await fetchAllUsers(DEV_KEY, "dev ");
  const prodUsers = await fetchAllUsers(PROD_KEY, "prod");

  const byExternalId = new Map(
    prodUsers.filter((u) => u.external_id).map((u) => [u.external_id!, u])
  );
  const byEmail = new Map<string, ClerkUser>();
  for (const u of prodUsers) {
    const email = primaryEmail(u);
    if (email) byEmail.set(email, u);
  }

  const mapping: MappingRow[] = [];
  const skipped: string[] = [];
  let created = 0;

  for (const devUser of devUsers) {
    const email = primaryEmail(devUser);
    if (!email) {
      // Nothing to link on later — flag it rather than silently dropping a user.
      skipped.push(`${devUser.id} (no email address)`);
      continue;
    }

    const seeded = byExternalId.get(devUser.id);
    if (seeded) {
      mapping.push({
        devUserId: devUser.id,
        prodUserId: seeded.id,
        email,
        action: "already-seeded",
      });
      continue;
    }

    const sameEmail = byEmail.get(email);
    if (sameEmail) {
      // Someone signed in to production before we seeded them. Their id is
      // still usable for the remap, but external_id is missing, so record it
      // and let the operator decide whether to patch it.
      console.warn(`  ! ${email} already exists in prod as ${sameEmail.id} without external_id`);
      mapping.push({
        devUserId: devUser.id,
        prodUserId: sameEmail.id,
        email,
        action: "matched-by-email",
      });
      continue;
    }

    if (!CONFIRM) {
      mapping.push({ devUserId: devUser.id, prodUserId: "(dry-run)", email, action: "created" });
      created++;
      continue;
    }

    const body = {
      email_address: [email],
      external_id: devUser.id,
      first_name: devUser.first_name ?? undefined,
      last_name: devUser.last_name ?? undefined,
      skip_password_requirement: true,
    };
    const newUser = await clerk<ClerkUser>(PROD_KEY, "/users", {
      method: "POST",
      body: JSON.stringify(body),
    });
    mapping.push({ devUserId: devUser.id, prodUserId: newUser.id, email, action: "created" });
    created++;
    console.log(`  + ${email} -> ${newUser.id}`);
    await sleep(CREATE_DELAY_MS);
  }

  const { mkdirSync, writeFileSync } = await import("node:fs");
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(
    OUT_FILE,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        devInstance: devInstance.id,
        prodInstance: prodInstance.id,
        dryRun: !CONFIRM,
        mapping,
      },
      null,
      2
    )
  );

  console.log("\n--- summary ---");
  console.log(`  dev users:        ${devUsers.length}`);
  console.log(`  created:          ${created}${CONFIRM ? "" : " (would create)"}`);
  console.log(`  already seeded:   ${mapping.filter((m) => m.action === "already-seeded").length}`);
  console.log(
    `  matched by email: ${mapping.filter((m) => m.action === "matched-by-email").length}`
  );
  console.log(`  skipped:          ${skipped.length}`);
  for (const s of skipped) console.log(`      - ${s}`);
  console.log(`\n  map written to:   ${OUT_FILE}`);
  if (!CONFIRM) console.log("\n  DRY RUN — re-run with --confirm to create the users.\n");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
