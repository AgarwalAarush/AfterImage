import { readFileSync } from "node:fs";
import { mutate } from "../src/lib/store";
import { validateRecall } from "../src/lib/recall-validation";
import { resultSchema } from "../src/lib/scene";
import type { Paper } from "../src/lib/types";

// Deliberate, source-reviewed correction. Run with --apply only after validation.
// Backup is created separately before editing; CAS changes only this paper's recall.
export const reviewedEagle = JSON.parse(readFileSync(".data/eagle-before-review.json", "utf8")) as Paper;
const r = reviewedEagle.recall!;
r.provenance = "editorial";
r.idea = "EAGLE-3 trains a cheap drafter to continue from its own internal states, so the target accepts longer drafts.";
r.mechanism = "Start with a target-model pass over the existing prefix. EAGLE-3 saves features from low, middle, and high layers, concatenates them, and learns a projection back to the target hidden width. These fused features give the small draft decoder information beyond the final layer alone. The target model stays fixed.\n\nNow follow one branch of the paper’s example. The target has processed ‘How can’ and sampled ‘I’. The draft combines the fused representation at ‘can’ with the embedding of ‘I’. Its decoder produces an internal vector, and the shared language-model head converts that vector to a distribution from which ‘do’ can be sampled. To draft the next token, the model reuses that internal vector together with the embedding of ‘do’. It does not run the large target again just to obtain the missing feature. The state vector carries information forward; the token embedding tells the model which word was actually sampled.\n\nThis is where training-time test matters. Removing the old feature-matching loss gives the drafter more freedom, but its output vectors need not resemble target features. A model trained only on real target features can therefore fail when its next input is its own output. EAGLE-3 includes those later self-fed steps during training and supervises token prediction. Attention masks keep separate simulated branches from seeing each other’s tokens. At inference, the full method uses EAGLE-2’s dynamic draft tree. The target scores candidates together, then strict speculative sampling accepts or corrects them; the simplified branch below is a teaching example.";
r.evidence += "\n\nReading Table 1: compare methods within the same target model, temperature, and task. For LLaMA 3.1 8B at temperature 0, mean speedup rises from 3.23× (EAGLE-2) to 4.44× (EAGLE-3), while average acceptance length rises from 4.11 to 6.23 tokens per cycle. The first ratio measures elapsed-time acceleration; the second counts useful tokens per draft/verify cycle. They differ because drafting and verification also take time. The 6.47× headline is the Vicuna-13B HumanEval case, not the result for every workload.";
r.equations = [
  {
    title: "Fuse three views of the prefix",
    latex: String.raw`g_i=W_f[\ell_i;m_i;h_i]`,
    explanation: String.raw`At prefix position $i$, the target supplies low-, middle-, and high-layer vectors $\ell_i,m_i,h_i\in\mathbb{R}^d$. The brackets mean concatenation, so the input has $3d$ entries. The learned projection $W_f\in\mathbb{R}^{d\times3d}$ mixes those entries into one vector $g_i\in\mathbb{R}^d$. Here $d$ is the target hidden width (called $k$ in the paper). This is explanatory notation for the fully connected layer in Section 3.1; any bias is omitted.\n\nThe output is a representation, not a probability distribution or a token. Fusion lets the drafter use information from several depths while retaining the same vector width.`,
    example: String.raw`Illustrative dimensions: if $d=4$, concatenate three 4-entry vectors into 12 entries. A $4\times12$ matrix returns 4 entries. For the running sentence, $g_{\text{can}}$ summarizes the target’s features at “can”; it does not reveal that sampling selected “I”. The next step supplies that information separately.`,
    sourceId: "section-3",
  },
  {
    title: "Turn features and a known token into a draft",
    latex: String.raw`\begin{aligned}u_{i+1}&=W_{\rm in}[g_i;e(x_{i+1})]\\a_{i+1}&=D_\theta(u_{i+1};C_{i+1})\\q_{i+2}&=\operatorname{softmax}(W_{\rm LM}a_{i+1})\end{aligned}`,
    explanation: String.raw`The known sampled token is $x_{i+1}$; its embedding $e(x_{i+1})\in\mathbb{R}^d$ is concatenated with $g_i$. The input projection $W_{\rm in}\in\mathbb{R}^{d\times2d}$ produces $u_{i+1}\in\mathbb{R}^d$. The draft Transformer decoder $D_\theta$ uses this input and its permitted causal context $C_{i+1}$ to produce state $a_{i+1}\in\mathbb{R}^d$. It is not a context-free function of one vector.\n\nThe shared target LM head $W_{\rm LM}\in\mathbb{R}^{V\times d}$ maps the state to $V$ vocabulary logits. Softmax gives draft distribution $q_{i+2}$ over the next token. This schematic uses temperature 1 and omits bias terms. Direct token prediction means supervising that prediction without additionally forcing $a$ to equal a target hidden feature; a hidden state still exists.`,
    example: String.raw`Set $x_i=$ “can” and $x_{i+1}=$ “I”. The inputs are $g_{\text{can}}$ and $e(\text{I})$. The decoder creates $a_{\text{I}}$, the head creates a distribution over words after “How can I”, and a sample can be “do”. State $a_{\text{I}}$ and token “do” are different outputs with different jobs.`,
    sourceId: "section-3",
  },
  {
    title: "Reuse the draft state—and train on that reuse",
    latex: String.raw`\begin{aligned}u_{i+2}&=W_{\rm in}[a_{i+1};e(x_{i+2})]\\a_{i+2}&=D_\theta(u_{i+2};C_{i+2})\end{aligned}`,
    explanation: String.raw`To continue cheaply, replace the unavailable fused target feature $g_{i+1}$ with the previous draft state $a_{i+1}$. Combine it with the newly sampled token embedding $e(x_{i+2})$, then run the same input projection and decoder. The new context $C_{i+2}$ includes the permitted history of this branch. The resulting state $a_{i+2}$ feeds the LM head again to predict the following token.\n\nTraining-time test exposes the draft model to these self-generated inputs during training, with token-prediction supervision and no target-feature regression loss. This addresses a concrete mismatch: training on target features alone does not teach a decoder how to interpret its own unconstrained states. The equations show the recurrence, not an invented exact training-loss formula.`,
    example: String.raw`After proposing “do”, concatenate $a_{\text{I}}$ with $e(\text{do})$. The decoder produces $a_{\text{do}}$; its head can propose “it”. A target pass has not computed the features needed for this new step. Reusing $a_{\text{I}}$ avoids that expensive pass. Training rehearses the same kind of state substitution.`,
    sourceId: "section-3",
  },
  {
    title: "Let the target accept or correct proposals",
    latex: String.raw`\begin{aligned}\alpha(\hat x)&=\min\left(1,\frac{p(\hat x)}{q(\hat x)}\right)\\p_{\rm fix}(v)&=\frac{[p(v)-q(v)]_+}{\sum_w[p(w)-q(w)]_+}\end{aligned}`,
    explanation: String.raw`This is the background speculative-sampling rule, not the new EAGLE-3 training idea. At the current candidate position, $q$ is the draft distribution and $p$ is the target distribution conditioned on the same accepted prefix. For proposed token $\hat x$, accept with probability $\alpha$. The target can score candidates in parallel, but acceptance decisions proceed in order.\n\nIf a proposal is rejected, sample its replacement $v$ from $p_{\rm fix}$ and discard later proposals on that continuation. Here $[z]_+=\max(0,z)$ and $w$ ranges over the vocabulary. The denominator normalizes the positive probability deficit; this correction is used only on rejection. Acceptance plus correction preserves the target distribution. Better drafts improve efficiency; they do not change the target weights or relax this rule.`,
    example: String.raw`Illustrative probabilities: the draft assigns “do” $q=0.40$ and the target assigns it $p=0.30$. Accept that proposal with probability $0.30/0.40=0.75$. A rejection does not mean simply choosing the target’s top token: use the normalized positive difference across the entire vocabulary. If instead $p=0.50$ and $q=0.40$, the proposal is always accepted.`,
    sourceId: "section-2",
  },
];
// Raw strings keep LaTeX intact; convert only intentional paragraph separators.
for (const eq of r.equations) eq.explanation = eq.explanation.replaceAll(String.raw`\n\n`, "\n\n");
r.walkthrough = {
  title: "Follow one draft branch, step by step",
  introduction: "Read each row left to right. The sentence is the paper’s Figure 5 example; sampled words illustrate one possible branch. Symbols beginning with g or a are vectors, while quoted words are tokens. The real implementation can explore several branches before verification.",
  sourceId: "section-3",
  steps: [
    { label: "Target pass", input: "The prefix “How can”.", operation: "Run the fixed target, retain low/mid/high features, and sample its next token.", output: String.raw`Fused features including $g_{\text{can}}$, plus token “I”.` },
    { label: "First draft", input: String.raw`$g_{\text{can}}$ and the embedding of “I”, with earlier context.`, operation: "Project the concatenated pair, run the draft decoder, then use the shared LM head and sample.", output: String.raw`Internal state $a_{\text{I}}$ and proposed token “do”.` },
    { label: "Next draft", input: String.raw`$a_{\text{I}}$ and the embedding of “do”, with the branch context.`, operation: "Substitute the draft state for the missing target feature and repeat the small draft computation.", output: String.raw`Internal state $a_{\text{do}}$ and proposed token “it”.` },
    { label: "Training rehearsal", input: "Real prefix features followed by self-generated draft states.", operation: "Train later draft steps on those states; mask out unrelated branches and supervise token prediction.", output: "A drafter practiced at continuing from its own outputs, without a feature-matching objective." },
  ],
};
validateRecall(r, reviewedEagle.sources);
resultSchema.parse({ recall: r, scene: reviewedEagle.scene });
async function main() {
if (process.argv.includes("--apply")) {
  await mutate(state => {
    const paper = state.papers.find(p => p.id === reviewedEagle.id);
    if (!paper || paper.generationStatus === "running" || paper.generationStatus === "queued") throw new Error("Paper missing or generation active; refusing to overwrite it.");
    if (JSON.stringify(paper.recall) !== JSON.stringify(JSON.parse(readFileSync(".data/eagle-before-review.json", "utf8")).recall)) throw new Error("Recall changed since backup; review before applying.");
    paper.recall = r;
  });
  console.log("Updated only EAGLE-3 recall; unrelated library state preserved.");
} else console.log("EAGLE-3 explanation, equations and citations validated; no data changed.");

}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
