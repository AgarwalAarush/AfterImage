import { readFile } from "node:fs/promises";
import { mutate } from "../src/lib/store";
import { studySchema, validateStudy, arrangeQuiz } from "../src/lib/study";
import { validateRecall } from "../src/lib/recall-validation";
async function main(){
 const [paperId,resultFile,reviewFile]=process.argv.slice(2);if(!paperId||!resultFile||!reviewFile)throw Error("paperId, result file and passed review required");
 const review=JSON.parse(await readFile(reviewFile,"utf8"));if(review.paperId!==paperId||!review.review.approved||review.review.issues.some((i:{severity:string})=>i.severity==="must-fix"))throw Error("Study review has not passed");
 const result=JSON.parse(await readFile(resultFile,"utf8"));const pack=arrangeQuiz(studySchema.parse(result.study));
 await mutate(s=>{const p=s.papers.find(p=>p.id===paperId);if(!p)throw Error("Paper missing");const sources=result.sources||p.sources;validateStudy(pack,sources);if(p.recall)validateRecall(p.recall,sources);if(result.sources)p.sources=result.sources;p.study=pack;});
 console.log(JSON.stringify({paperId,figures:pack.figures.length,quizQuestions:pack.quiz.length,published:true}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
