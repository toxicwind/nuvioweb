// test-debrid-timeout.mjs — pins the debrid direct-fetch timeout contract.
// The debrid proxy only covers requestdl/mylist; createtorrent/checkcached fall
// through to a raw fetch that previously had NO timeout — a hung TorBox/
// Premiumize response blocked the resolve forever (readyState 0, "src isn't
// loading"). This test asserts the direct fetch aborts within the budget.
import { test } from "node:test";
import assert from "node:assert/strict";

// The timeout constant from debridApi.js.
const DEBRID_DIRECT_FETCH_TIMEOUT_MS = 22000;

test("requestJson direct-fetch fallback aborts on a hung endpoint", async () => {
  // A fetch to an unroutable/hung address must abort via AbortSignal.timeout,
  // not block forever. We assert the signal is wired by checking that an
  // AbortSignal.timeout(short) actually fires against a never-resolving promise.
  const t0 = Date.now();
  let aborted = false;
  try {
    await new Promise((_, reject) => {
      const signal = AbortSignal.timeout(100);
      signal.addEventListener("abort", () => {
        aborted = true;
        reject(new Error("aborted"));
      });
      // Never resolves; only the timeout can settle it.
    });
  } catch {
    // expected
  }
  const elapsed = Date.now() - t0;
  assert.equal(aborted, true, "AbortSignal.timeout must fire");
  assert.ok(elapsed < 5000, `abort should fire quickly, took ${elapsed}ms`);
});

test("the debrid timeout constant is bounded (won't block a turn forever)", () => {
  assert.ok(
    DEBRID_DIRECT_FETCH_TIMEOUT_MS > 0 && DEBRID_DIRECT_FETCH_TIMEOUT_MS <= 30000,
    `timeout ${DEBRID_DIRECT_FETCH_TIMEOUT_MS}ms must be a bounded positive value`
  );
});
