#!/usr/bin/env python3
"""Bounded HTTP security checks against the owner's AfterImage Funnel endpoint.

No bridge secret is accepted. Optional stdin contains short-lived signatures for
fixed read-only or invalid requests, minted on macserver by its service account.
"""
import argparse
import concurrent.futures
import http.client
import ipaddress
import json
import socket
import re
import threading
import ssl
import sys
import time

HOST = "macserver.tail537cdd.ts.net"
PORT = 8443
ROUTE = "/internal/storage"


class RelayConnection(http.client.HTTPSConnection):
    def __init__(self, relay):
        super().__init__(HOST, PORT, timeout=12, context=ssl.create_default_context())
        self.relay = relay

    def connect(self):
        sock = socket.create_connection((self.relay, PORT), self.timeout)
        self.sock = self._context.wrap_socket(sock, server_hostname=HOST)


def request(relay, method="POST", route=ROUTE, body="{}", headers=None, incomplete=False):
    connection = RelayConnection(relay)
    started = time.monotonic()
    try:
        headers = {"content-type": "application/json", **(headers or {})}
        if incomplete:
            connection.putrequest(method, route)
            for key, value in headers.items():
                connection.putheader(key, value)
            connection.putheader("content-length", str(8 * 1024 * 1024))
            connection.endheaders()
        else:
            connection.request(method, route, body=body.encode("utf8"), headers=headers)
        response = connection.getresponse()
        try:
            data = response.read(1024)
        except http.client.IncompleteRead as error:
            data = error.partial
        return response.status, data, time.monotonic() - started
    finally:
        connection.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--relay", required=True)
    parser.add_argument("--signed", action="store_true")
    parser.add_argument("--expected-version", type=int, help="Optional known state version for signed status")
    args = parser.parse_args()
    if not ipaddress.ip_address(args.relay).is_global:
        parser.error("Use a public Funnel relay address, not a LAN or tailnet IP.")
    results = []

    def check(name, expected, **options):
        try:
            status, data, elapsed = request(args.relay, **options)
            passed = status in expected
            if name == "signed-status" and passed:
                version = json.loads(data).get("version")
                passed = isinstance(version, int) and (args.expected_version is None or version == args.expected_version)
            if options.get("incomplete"):
                passed = passed and elapsed < 5
            results.append({"check": name, "status": status, "pass": passed,
                            "seconds": round(elapsed, 3)})
        except Exception as error:
            results.append({"check": name, "pass": False, "error": type(error).__name__})

    if args.signed:
        for vector in json.load(sys.stdin):
            check(vector["name"], vector["expected"], body=vector["body"], headers=vector["headers"])
    else:
        for action in ("snapshot", "status", "workerClaimStatus", "assistantSnapshot",
                       "touchWorkerSeenAt", "compareAndSwap"):
            check("unsigned-" + action, [401], body=json.dumps({"action": action}))
        for route in ("/", "/.env", "/.data/afterimage.sqlite", "/internal/storage/",
                      "/internal/storage?x=1", "/internal/../.env", "/api/state", "/rpc"):
            check("path-" + route, [404], route=route)
        for method in ("GET", "PUT", "DELETE", "OPTIONS", "HEAD"):
            check("method-" + method, [405], method=method)
        check("wrong-content-type", [415], headers={"content-type": "text/plain"})
        forged = {"x-afterimage-timestamp": str(int(time.time() * 1000)),
                  "x-afterimage-nonce": "00000000-0000-4000-8000-000000000000",
                  "x-afterimage-envelope-signature": "0" * 64,
                  "x-afterimage-signature": "0" * 64}
        check("forged-signature", [401], headers=forged)
        check("forged-forwarded-identity", [401], headers={
            "x-forwarded-for": "127.0.0.1", "x-forwarded-host": "localhost",
            "authorization": "Bearer invalid", "x-afterimage-worker-token": "invalid"})
        check("unsigned-incomplete-8mb", [401], incomplete=True)
        check("forged-incomplete-8mb", [401], incomplete=True, headers=forged)
        check("large-header", [400, 431], headers={"x-probe-padding": "x" * 20000})
        # A bounded burst checks rejection behavior, not volumetric DDoS capacity.
        barrier = threading.Barrier(8)
        def burst_one(_):
            connection = RelayConnection(args.relay)
            try:
                connection.connect()
                barrier.wait(timeout=15)
                wire = (f"POST {ROUTE} HTTP/1.1\r\nHost: {HOST}\r\n"
                        "Content-Type: application/json\r\nContent-Length: 2\r\n\r\n{}")
                connection.sock.sendall(wire.encode() * 8)
                data = b""
                statuses = []
                while len(statuses) < 8:
                    chunk = connection.sock.recv(16384)
                    if not chunk:
                        break
                    data += chunk
                    statuses = [int(s) for s in re.findall(rb"HTTP/1\.1 (\d{3})", data)]
                return statuses if len(statuses) == 8 else ["transport-error"]
            except Exception:
                return ["transport-error"]
            finally:
                connection.close()
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            statuses = [s for batch in pool.map(burst_one, range(8)) for s in batch]
        counts = {str(status): statuses.count(status) for status in set(statuses)}
        results.append({"check": "bounded-invalid-burst", "counts": counts,
                        "pass": 429 in statuses and all(s in (401, 429) for s in statuses)})
    print(json.dumps({"host": socket.gethostname(), "relay": args.relay,
                      "tls_verified": True, "results": results,
                      "passed": all(r["pass"] for r in results)}, indent=2))
    return 0 if all(r["pass"] for r in results) else 1


if __name__ == "__main__":
    sys.exit(main())
