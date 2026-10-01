import { request } from "node:https";
import { isIP } from "node:net";

// MagicDNS can route the ordinary hostname privately and hide a Funnel outage.
// Query public DNS and pin each public relay while retaining SNI/TLS validation.
const origin = new URL(process.argv[2] || process.env.AFTERIMAGE_BACKEND_URL || "");
if (origin.protocol !== "https:" || origin.username || origin.password ||
    origin.pathname !== "/" || origin.search || origin.hash)
  throw new Error("Pass an HTTPS bridge origin without credentials or a path.");
const dns = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(origin.hostname)}&type=A`, {
  signal: AbortSignal.timeout(10_000),
});
if (!dns.ok) throw new Error("Public DNS query failed.");
const result = await dns.json();
const addresses = [...new Set((result.Answer || []).filter(record => record.type === 1).map(record => record.data))]
  .filter(address => isIP(address) === 4 && !/^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(address) &&
    !(address.startsWith("172.") && Number(address.split(".")[1]) >= 16 && Number(address.split(".")[1]) <= 31) &&
    !(address.startsWith("100.") && Number(address.split(".")[1]) >= 64 && Number(address.split(".")[1]) <= 127))
  .slice(0, 4);
if (!addresses.length) throw new Error("Public DNS returned no public IPv4 relay addresses.");
for (const address of addresses) {
  const started = performance.now();
  const probe = await new Promise(resolve => {
    const req = request(new URL("/internal/storage", origin), {
      method: "POST", agent: false,
      headers: {"content-type": "application/json", "content-length": "2"},
      signal: AbortSignal.timeout(12_000),
      lookup: (_hostname, options, callback) => {
        if (options.all) callback(null, [{address, family: 4}]);
        else callback(null, address, 4);
      },
    }, res => {
      res.resume();
      res.on("end", () => resolve({status: res.statusCode, ok: res.statusCode === 401}));
      res.on("error", error => resolve({ok: false, code: error.code}));
    });
    req.on("error", error => resolve({ok: false, code: error.code}));
    req.end("{}");
  });
  console.log(JSON.stringify({address, ...probe, durationMs: Math.round(performance.now() - started)}));
  if (!probe.ok) process.exitCode = 1;
}
