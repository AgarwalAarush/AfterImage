/** A contradictory passing flag never suppresses an actionable review finding. */
export function requireCleanSubjectReview(review:Record<string,{passed:boolean;findings:string[]}>){
  const defects=Object.entries(review).flatMap(([name,check])=>check.findings.length?check.findings.map(finding=>`${name}: ${finding}`):check.passed?[]:[`${name}: Reviewer rejected a check without findings`]);
  if(defects.length)throw new Error(defects.join("\n"));
}
