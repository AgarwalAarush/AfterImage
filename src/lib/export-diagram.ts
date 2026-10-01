/** Export the diagram actually on screen, with its computed typography embedded. */
export async function exportDiagram(id: string) {
  const source = document.querySelector<SVGSVGElement>(
    ".mechanism-panel .graphic-desktop, .mechanism-panel .scene-wide svg",
  );
  if (!source) throw new Error("Diagram unavailable");
  return exportSvg(source, id);
}

export async function exportSvg(source: SVGSVGElement, id: string) {
  const clone = source.cloneNode(true) as SVGSVGElement;
  const originals = [source, ...source.querySelectorAll("*")],
    copies = [clone, ...clone.querySelectorAll("*")];
  originals.forEach((el, i) => {
    const computed = getComputedStyle(el);
    for (const property of [
      "font-family",
      "font-size",
      "font-weight",
      "letter-spacing",
      "fill",
      "stroke",
      "stop-color",
      "fill-opacity",
      "stroke-opacity",
      "opacity",
    ]) {
      const value = computed.getPropertyValue(property);
      (copies[i] as SVGElement).style.setProperty(
        property,
        value,
      );
      if (["fill", "stroke", "stop-color"].includes(property))
        copies[i].setAttribute(property, value);
    }
  });
  const fonts = [
    ["Departure Mono", "/fonts/DepartureMono-Regular.woff2"],
    ["IBM Plex Mono", "/fonts/IBMPlexMono-Regular.woff2"],
  ];
  const rules = await Promise.all(
    fonts.map(async ([name, url]) => {
      const r = await fetch(url);
      if (!r.ok) throw new Error("Font unavailable");
      const bytes = new Uint8Array(await r.arrayBuffer());
      let binary = "";
      for (const byte of bytes) binary += String.fromCharCode(byte);
      return `@font-face{font-family:'${name}';src:url(data:font/woff2;base64,${btoa(binary)}) format('woff2')}`;
    }),
  );
  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  style.textContent = rules.join("\n");
  clone.prepend(style);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.removeAttribute("class");
  clone.style.width = "";
  clone.style.height = "";
  // Standalone files need the surface that the on-screen palette was designed for.
  const background = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  const viewBox = source.viewBox.baseVal;
  background.setAttribute("x", String(viewBox.x));
  background.setAttribute("y", String(viewBox.y));
  background.setAttribute("width", String(viewBox.width));
  background.setAttribute("height", String(viewBox.height));
  background.setAttribute("fill", getComputedStyle(document.documentElement).getPropertyValue("--paper").trim());
  clone.insertBefore(background, clone.firstChild);
  const url = URL.createObjectURL(
    new Blob([new XMLSerializer().serializeToString(clone)], {
      type: "image/svg+xml",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `${id}.svg`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
