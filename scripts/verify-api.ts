import assert from "node:assert/strict";
const base = "http://127.0.0.1:3000";
async function call(body: unknown, origin = base) {
  return fetch(base + "/api/state", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify(body),
  });
}
async function main() {
  const state = await (await fetch(base + "/api/state")).json();
  assert.ok(Array.isArray(state.papers));
  assert.equal(
    (
      await call(
        { action: "save", paperId: "2401.04088" },
        "https://attacker.invalid",
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await fetch(base + "/api/worker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: '{"action":"claim"}',
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await call({
        action: "entry",
        paperId: "missing",
        patch: { takeaway: "test" },
      })
    ).status,
    400,
  );
  assert.equal(
    (await call({ action: "import", url: "https://127.0.0.1/internal" }))
      .status,
    400,
  );
  console.log(
    "PASS: state retrieval, cross-origin rejection, worker token isolation, nonexistent paper rejection, import host validation.",
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
