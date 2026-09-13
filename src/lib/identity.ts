export function parsePaperId(input: string): string {
  const value = input.trim();
  if (/^(\d{4}\.\d{4,5}|[a-z-]+(?:\.[A-Z]{2})?\/\d{7})(v\d+)?$/.test(value))
    return value.replace(/v\d+$/, "");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Paste an arXiv or alphaXiv paper link, or an arXiv ID.");
  }
  if (
    ![
      "arxiv.org",
      "www.arxiv.org",
      "alphaxiv.org",
      "www.alphaxiv.org",
    ].includes(url.hostname) ||
    url.protocol !== "https:"
  )
    throw new Error("Use an https arXiv or alphaXiv paper link.");
  const id = url.pathname
    .replace(/^\/(abs|pdf|html|overview)\//, "")
    .replace(/\.pdf$/, "")
    .replace(/v\d+$/, "");
  if (!/^(\d{4}\.\d{4,5}|[a-z-]+(?:\.[A-Z]{2})?\/\d{7})$/.test(id))
    throw new Error("This link does not contain a recognized paper ID.");
  return id;
}
export const sourceUrl = (p: { arxivId: string }) =>
  `https://arxiv.org/abs/${p.arxivId}`;
export const readerUrl = (p: { arxivId: string }) =>
  `https://www.alphaxiv.org/abs/${p.arxivId}`;
