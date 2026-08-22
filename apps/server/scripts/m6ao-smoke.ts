/**
 * Milestone 6 Batch AO smoke — Owner staff APIs.
 *
 * Usage (server must already be running):
 *   npm run smoke:m6ao -w @r2a/server
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
dotenv.config({ path: path.join(repoRoot, ".env") });

const BASE = (process.env.BASE_URL || "http://localhost:8787").replace(/\/$/, "");
const API = `${BASE}/api/v1`;

const SEED = {
  ownerEmail: process.env.SEED_OWNER_EMAIL || "owner@demo.local",
  managerEmail: process.env.SEED_MANAGER_EMAIL || "manager@demo.local",
  cashierEmail: process.env.SEED_CASHIER_EMAIL || "cashier@demo.local",
  password: process.env.SEED_OWNER_PASSWORD || "ChangeMe123!",
  tenantSlug: "demo-pharmacy",
};

type Result = { name: string; ok: boolean; detail: string };
const results: Result[] = [];

function pass(name: string, detail = ""): void {
  results.push({ name, ok: true, detail });
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name: string, detail = ""): void {
  results.push({ name, ok: false, detail });
  console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function req(
  pathname: string,
  opts: { method?: string; body?: unknown; token?: string } = {},
): Promise<{ status: number; body: Record<string, any> }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  const res = await fetch(`${API}${pathname}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed as Record<string, any> };
}

function asRecord(v: unknown): Record<string, any> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, any>)
    : null;
}

async function login(email: string, password = SEED.password): Promise<{
  token: string | null;
  storeId: string | null;
  userId: string | null;
  status: number;
  body: Record<string, any>;
}> {
  const res = await req("/auth/login", {
    method: "POST",
    body: {
      email,
      password,
      tenantSlug: SEED.tenantSlug,
    },
  });
  const data = asRecord(res.body.data);
  const user = asRecord(data?.user);
  return {
    token: typeof data?.accessToken === "string" ? data.accessToken : null,
    storeId: typeof user?.storeId === "string" ? user.storeId : null,
    userId: typeof user?.id === "string" ? user.id : null,
    status: res.status,
    body: res.body,
  };
}

async function main(): Promise<void> {
  console.log(`M6AO smoke → ${API}\n`);

  try {
    // 1. Logins
    const owner = await login(SEED.ownerEmail);
    if (!owner.token) throw new Error("Owner login failed");
    
    const manager = await login(SEED.managerEmail);
    if (!manager.token) throw new Error("Manager login failed");

    const cashier = await login(SEED.cashierEmail);
    if (!cashier.token) throw new Error("Cashier login failed");

    pass("Auth", "Acquired tokens for owner, manager, cashier");

    // 2. RBAC check (403 on manager/cashier for /owner/users)
    const listManagerRes = await req("/owner/users", { token: manager.token });
    if (listManagerRes.status === 403) {
      pass("RBAC: Manager 403", "Manager received 403 on owner staff list");
    } else {
      fail("RBAC: Manager 403", `Expected 403, got ${listManagerRes.status}`);
    }

    const listCashierRes = await req("/owner/users", { token: cashier.token });
    if (listCashierRes.status === 403) {
      pass("RBAC: Cashier 403", "Cashier received 403 on owner staff list");
    } else {
      fail("RBAC: Cashier 403", `Expected 403, got ${listCashierRes.status}`);
    }

    // 3. Owner list check (200 + check items + KPIs)
    const listOwnerRes = await req("/owner/users", { token: owner.token });
    if (listOwnerRes.status === 200 && listOwnerRes.body.status === "success") {
      const data = listOwnerRes.body.data;
      const kpis = data?.kpis;
      if (
        data &&
        Array.isArray(data.items) &&
        kpis &&
        typeof kpis.total === "number" &&
        typeof kpis.active === "number" &&
        typeof kpis.inactive === "number" &&
        typeof kpis.cashiers === "number"
      ) {
        pass("GET /owner/users", `Found ${data.items.length} users. KPIs: Total ${kpis.total}, Active ${kpis.active}, Cashiers ${kpis.cashiers}`);
      } else {
        fail("GET /owner/users", "Returned success but payload layout invalid");
      }
    } else {
      fail("GET /owner/users", `Expected 200 success, got ${listOwnerRes.status}`);
    }

    // 4. Create staff
    const uniqueEmail = `staff-${Date.now()}@demo.local`;
    const createBody = {
      name: "Temporary Cashier",
      phone: "01799999999",
      email: uniqueEmail,
      role: "CASHIER",
      internalNote: "Created via smoke test",
      storeId: owner.storeId || undefined,
    };

    const createRes = await req("/owner/users", {
      method: "POST",
      token: owner.token,
      body: createBody,
    });

    let tempUserId = "";
    let tempPassword = "";

    if (createRes.status === 201 && createRes.body.status === "success") {
      const data = createRes.body.data;
      if (data && data.user && typeof data.temporaryPassword === "string") {
        tempUserId = data.user.id;
        tempPassword = data.temporaryPassword;
        pass("POST /owner/users", `Created cashier ${uniqueEmail}. Temp password: ${tempPassword}`);
      } else {
        fail("POST /owner/users", "Created but user/temporaryPassword not returned properly");
      }
    } else {
      fail("POST /owner/users", `Expected 201 success, got ${createRes.status} (${JSON.stringify(createRes.body)})`);
    }

    // 5. Check duplicate email check
    const duplicateRes = await req("/owner/users", {
      method: "POST",
      token: owner.token,
      body: createBody,
    });
    if (duplicateRes.status === 409) {
      pass("Duplicate Email Validation", "Correctly rejected duplicate email with 409");
    } else {
      fail("Duplicate Email Validation", `Expected 409, got ${duplicateRes.status}`);
    }

    // 6. Check invalid role change (block OWNER/SUPER_ADMIN)
    const invalidRoleRes = await req("/owner/users", {
      method: "POST",
      token: owner.token,
      body: { ...createBody, email: `owner-${Date.now()}@demo.local`, role: "OWNER" },
    });
    if (invalidRoleRes.status === 400) {
      pass("Role Validation: Create OWNER", "Correctly rejected OWNER creation with 400");
    } else {
      fail("Role Validation: Create OWNER", `Expected 400, got ${invalidRoleRes.status}`);
    }

    // 7. Get staff detail + check activities (should show CREATED)
    if (tempUserId) {
      const detailRes = await req(`/owner/users/${tempUserId}`, { token: owner.token });
      if (detailRes.status === 200 && detailRes.body.status === "success") {
        const data = detailRes.body.data;
        const activities = data?.activities;
        const hasCreated = Array.isArray(activities) && activities.some((a: any) => a.type === "CREATED");
        if (data && data.user && data.user.email === uniqueEmail && hasCreated) {
          pass("GET /owner/users/:id", `Found user details and CREATED activity event. Username derived: ${data.user.username}`);
        } else {
          fail("GET /owner/users/:id", "Failed validation on user detail fields or activities");
        }
      } else {
        fail("GET /owner/users/:id", `Expected 200, got ${detailRes.status}`);
      }

      // 8. Patch staff (role change + profile updated check)
      const patchRes = await req(`/owner/users/${tempUserId}`, {
        method: "PATCH",
        token: owner.token,
        body: {
          role: "MANAGER",
          name: "Updated Cashier Name",
        },
      });
      if (patchRes.status === 200 && patchRes.body.status === "success") {
        const detailRes2 = await req(`/owner/users/${tempUserId}`, { token: owner.token });
        const activities = detailRes2.body.data?.activities;
        const hasRoleChanged = Array.isArray(activities) && activities.some((a: any) => a.type === "ROLE_CHANGED");
        const hasProfileUpdated = Array.isArray(activities) && activities.some((a: any) => a.type === "PROFILE_UPDATED");
        if (hasRoleChanged && hasProfileUpdated) {
          pass("PATCH /owner/users/:id", "Role changed to MANAGER and name updated. Logged activities.");
        } else {
          fail("PATCH /owner/users/:id", "Update succeeded but missing ROLE_CHANGED/PROFILE_UPDATED activity logs");
        }
      } else {
        fail("PATCH /owner/users/:id", `Expected 200, got ${patchRes.status}`);
      }

      // 9. Block self edit deactivation
      if (owner.userId) {
        const editSelfRes = await req(`/owner/users/${owner.userId}`, {
          method: "PATCH",
          token: owner.token,
          body: { name: "New Owner Name" },
        });
        if (editSelfRes.status === 400) {
          pass("Block Self: Edit", "Correctly rejected self edit with 400");
        } else {
          fail("Block Self: Edit", `Expected 400, got ${editSelfRes.status}`);
        }

        const deactivateSelfRes = await req(`/owner/users/${owner.userId}/deactivate`, {
          method: "POST",
          token: owner.token,
          body: { reason: "Self deactivation test" },
        });
        if (deactivateSelfRes.status === 400) {
          pass("Block Self: Deactivate", "Correctly rejected self deactivation with 400");
        } else {
          fail("Block Self: Deactivate", `Expected 400, got ${deactivateSelfRes.status}`);
        }
      }

      // 10. Deactivate staff and check login & tokens revoked
      const deactRes = await req(`/owner/users/${tempUserId}/deactivate`, {
        method: "POST",
        token: owner.token,
        body: { reason: " smoke test deactivation" },
      });
      if (deactRes.status === 200) {
        const loginCheck = await login(uniqueEmail, tempPassword);
        if (loginCheck.status === 401 || loginCheck.status === 403) {
          pass("Deactivate Staff", "Deactivation successful; login blocked for deactivated staff.");
        } else {
          fail("Deactivate Staff", `Deactivated user could still login! status: ${loginCheck.status}`);
        }
      } else {
        fail("Deactivate Staff", `Deactivation failed: ${deactRes.status}`);
      }

      // 11. Reactivate staff and login again (check lastLoginAt update)
      const reactRes = await req(`/owner/users/${tempUserId}/reactivate`, {
        method: "POST",
        token: owner.token,
      });
      if (reactRes.status === 200) {
        const loginCheck2 = await login(uniqueEmail, tempPassword);
        if (loginCheck2.token) {
          const detailRes3 = await req(`/owner/users/${tempUserId}`, { token: owner.token });
          const userObj = detailRes3.body.data?.user;
          const activities = detailRes3.body.data?.activities;
          const hasReactivated = Array.isArray(activities) && activities.some((a: any) => a.type === "REACTIVATED");
          if (userObj?.lastLoginAt && hasReactivated) {
            pass("Reactivate Staff", `Reactivation successful; logged in again; lastLoginAt set to: ${userObj.lastLoginAt}`);
          } else {
            fail("Reactivate Staff", "Reactivated user logged in, but lastLoginAt was not updated or activity not logged");
          }
        } else {
          fail("Reactivate Staff", `Reactivated user login failed: ${loginCheck2.status}`);
        }
      } else {
        fail("Reactivate Staff", `Reactivation failed: ${reactRes.status}`);
      }
    }

  } catch (err: any) {
    fail("Crash", err.message || String(err));
  }

  // Report
  const total = results.length;
  const passed = results.filter((r) => r.ok).length;
  console.log(`\nSmoke results: ${passed}/${total} passed`);
  if (passed === total) {
    console.log("SUCCESS");
    process.exit(0);
  } else {
    console.error("FAIL");
    process.exit(1);
  }
}

main();
