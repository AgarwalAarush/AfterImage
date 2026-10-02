import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { subjectMarkdown,subjectSectionBody } from "../src/lib/subject-markdown";
import { SubjectProse } from "../src/components/subject-prose";

test("subject math recognizes TeX delimiters and single-line display math",()=>{
  assert.equal(subjectMarkdown(String.raw`Use \(QK^\top\), then \[O=PV\].`),"Use $QK^\\top$, then \n\n$$\nO=PV\n$$\n\n.");
  assert.equal(subjectMarkdown("$$x^2$$",true),"$x^2$");
});

test("literal code retains its original math delimiters",()=>{
  const input=String.raw`Code: \`\(x\)\`.

\`\`\`tex
\[x+y\]
\`\`\``.replaceAll("\\`","`");
  assert.equal(subjectMarkdown(input),input);
});

test("inline subject labels render mathematical notation without paragraph nesting",()=>{
  const html=renderToStaticMarkup(createElement(SubjectProse,{text:String.raw`Notation \(O(\cdot)\) and $\Theta(\cdot)$`,inline:true}));
  assert.match(html,/class="katex"/);
  assert.doesNotMatch(html,/<p[ >]|katex-error/);
  assert.doesNotMatch(html,/\\\(|\$\\Theta/);
});

test("display equations are rendered and raw HTML never executes",()=>{
  const html=renderToStaticMarkup(createElement(SubjectProse,{text:"$$O=PV$$\n\n<script>alert(1)</script>"}));
  assert.match(html,/class="katex-display"/);
  assert.doesNotMatch(html,/<script|katex-error/);
});
test("only the equivalent leading section heading is suppressed in presentation",()=>{
  assert.equal(subjectSectionBody("## What the Paper Establishes\n\nThe result follows.","What the paper establishes"),"The result follows.");
  assert.equal(subjectSectionBody("## 3. Policy Geometry ##\n\nThe result follows.","Policy Geometry"),"The result follows.");
  for(const input of ["## A Different Point\n\nThe result follows.","```md\n## Policy Geometry\n```","First paragraph.\n\n## Policy Geometry\n\nBody."]){assert.equal(subjectSectionBody(input,"Policy Geometry"),input);}
});
