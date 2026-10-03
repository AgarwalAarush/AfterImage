"""Bounded, worker-only extraction of arXiv PDF pages; no arbitrary URLs."""
import io, json, re, sys, urllib.request, urllib.parse
from pypdf import PdfReader

paper_id = sys.argv[1]
if not re.fullmatch(r"(?:\d{4}\.\d{4,5}|[a-z-]+(?:\.[A-Z]{2})?/\d{7})(?:v\d+)?", paper_id):
    raise ValueError("Invalid arXiv ID")
url = "https://arxiv.org/pdf/" + paper_id
with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "AfterImage/0.1"}), timeout=35) as response:
    received = urllib.parse.urlparse(response.geturl())
    if received.scheme != "https" or received.netloc != "arxiv.org" or received.path not in ("/pdf/" + paper_id, "/pdf/" + paper_id + ".pdf") or received.query:
        raise ValueError("Unexpected PDF identity")
    data = response.read(25_000_001)
if len(data) > 25_000_000 or not data.startswith(b"%PDF"):
    raise ValueError("Invalid or oversized PDF")
reader = PdfReader(io.BytesIO(data))
sources = []
truncated = []
for i, page in enumerate(reader.pages[:12]):
    text = (page.extract_text() or "").strip()
    if len(text) > 9500:
        marker = "\n[EXTRACTION TRUNCATED: PDF page exceeds the bound.]"
        text = text[:9500-len(marker)] + marker
        truncated.append(i+1)
    if len(text) > 150:
        sources.append({"id": "page-"+str(i+1), "label": "Original paper · page "+str(i+1), "url": url+"#page="+str(i+1), "excerpt": text})
print(json.dumps({"pages": sources, "totalPages": len(reader.pages), "truncatedPages": truncated}))
