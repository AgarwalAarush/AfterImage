const fs = require("node:fs");
process.loadEnvFile(".env.local");
async function main() {
  const base = "https://afterimage.aarushagarwal.dev";
  const auth = await fetch(base + "/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: base },
    body: JSON.stringify({ key: process.env.AFTERIMAGE_ACCESS_KEY }),
  });
  if (!auth.ok) throw new Error("Sign-in failed");
  const headers = {
    "Content-Type": "application/json",
    Cookie: auth.headers.get("set-cookie").split(";")[0],
    Origin: base,
  };
  const r = await fetch(base + "/api/state", { headers });
  if (!r.ok) throw new Error("State unavailable");
  const state = await r.json();
  if (process.argv.includes("--status")) {
    console.log(
      JSON.stringify(
        state.papers.map((p) => ({
          id: p.id,
          status: p.generationStatus,
          version: p.recall?.version || 1,
          words: p.recall
            ? Object.values(p.recall)
                .filter((v) => typeof v === "string")
                .join(" ")
                .split(/\s+/).length
            : 0,
          equations: p.recall?.equations?.length || 0,
          scope: p.recall?.evidenceScope,
          error: p.generationError,
        })),
        null,
        2,
      ),
    );
    return;
  }
  const papers = state.papers
    .filter(
      (p) =>
        p.recall?.version !== 2 &&
        !["queued", "running"].includes(p.generationStatus),
    )
    .sort(
      (a, b) => Number(b.id === "2106.09685") - Number(a.id === "2106.09685"),
    );
  const backup = ".data/recalls-before-v2.json";
  if (!fs.existsSync(backup)) fs.writeFileSync(backup, JSON.stringify(papers));
  for (const p of papers) {
    const r = await fetch(base + "/api/state", {
      method: "POST",
      headers,
      body: JSON.stringify({ action: "generate", paperId: p.id }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error);
    console.log(p.id + ": queued");
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
