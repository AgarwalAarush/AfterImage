"""Refresh topic/title/primary-paper metadata; never import article text or scripts."""
from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen
from datetime import datetime, timezone
import json
import re

ORIGIN = "https://intuitivepapers.ai"
ROOT = Path(__file__).resolve().parents[1]

def fetch(url):
    request = Request(url, headers={"User-Agent": "AfterImage topic catalog research/1.0"})
    with urlopen(request, timeout=40) as response:
        return response.read(4_000_000).decode("utf-8")

class Catalog(HTMLParser):
    def __init__(self):
        super().__init__()
        self.entries, self.current, self.field = [], None, None
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "a" and "pc-live" in attrs.get("class", "").split():
            self.current = {"id": attrs["href"].strip("/"), "title": "", "topic": "",
                            "referenceUrl": urljoin(ORIGIN, attrs["href"])}
            self.entries.append(self.current)
        if self.current:
            self.field = {"pc-title": "title", "tag": "topic"}.get(attrs.get("class"), self.field)
    def handle_endtag(self, tag):
        if tag in ["div", "span"]: self.field = None
        if tag == "a": self.current, self.field = None, None
    def handle_data(self, data):
        if self.current and self.field: self.current[self.field] += data

class PrimaryLinks(HTMLParser):
    def __init__(self):
        super().__init__()
        self.arxiv = []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "a":
            url = attrs.get("href", "")
            parsed = urlparse(url)
            if parsed.hostname in ["arxiv.org", "www.arxiv.org"]:
                match = re.match(r"/(?:abs|html|pdf)/(.+?)(?:\.pdf)?$", parsed.path)
                if match:
                    paper_id = re.sub(r"v\d+$", "", match[1])
                    if paper_id not in self.arxiv: self.arxiv.append(paper_id)

def enrich(entry):
    links = PrimaryLinks()
    links.feed(fetch(entry["referenceUrl"]))
    if not links.arxiv:
        raise RuntimeError(f"No primary paper found for {entry['id']}")
    # The source paper appears before inline references to prerequisite papers.
    return {**entry, "arxivId": links.arxiv[0],
            "primaryUrl": "https://arxiv.org/abs/" + links.arxiv[0]}

if __name__ == "__main__":
    catalog = Catalog()
    catalog.feed(fetch(ORIGIN + "/library/"))
    if not catalog.entries or len({x["id"] for x in catalog.entries}) != len(catalog.entries):
        raise RuntimeError("Empty or duplicate catalog")
    with ThreadPoolExecutor(max_workers=5) as executor:
        entries = list(executor.map(enrich, catalog.entries))
    destination = ROOT / "src/content/subjects/catalog.json"
    destination.parent.mkdir(parents=True, exist_ok=True)
    result = {"version": 1, "checkedAt": datetime.now(timezone.utc).isoformat(),
              "reference": ORIGIN + "/library/", "entries": entries}
    destination.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(f"Verified {len(entries)} subject entries and primary-paper links.")
