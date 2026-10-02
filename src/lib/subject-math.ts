import katex from "katex";
import type { SubjectPublicLesson } from "./subjects";
import { subjectMarkdown } from "./subject-markdown";

/** Check every rendered Markdown field, including quiz distractors and small labels. */
export function validateSubjectMath(lesson:SubjectPublicLesson){
  const fields=[{identity:"title",value:lesson.title},{identity:"summary",value:lesson.summary},
    ...lesson.prerequisites.map((value,index)=>({identity:`prerequisites[${index}]`,value})),
    ...lesson.objectives.map((value,index)=>({identity:`objectives[${index}]`,value})),
    ...lesson.sections.map(section=>({identity:`sections[${section.id}].markdown`,value:section.markdown})),
    ...lesson.claims.flatMap(claim=>[{identity:`claims[${claim.id}].statement`,value:claim.statement},{identity:`claims[${claim.id}].conditions`,value:claim.conditions}]),
    ...lesson.figures.flatMap(figure=>(["title","question","caption","limitation"] as const).map(key=>({identity:`figures[${figure.id}].${key}`,value:figure[key]}))),
    ...lesson.quiz.flatMap((question,questionIndex)=>[{identity:`quiz[${questionIndex}].question`,value:question.question},...question.options.flatMap((option,index)=>[{identity:`quiz[${questionIndex}].options[${index}].text`,value:option.text},{identity:`quiz[${questionIndex}].options[${index}].explanation`,value:option.explanation}])])];
  for(const {identity,value:field} of fields){
    if(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(field))throw new Error(`Unexpected control character in lesson prose: ${identity}`);
    const markdown=subjectMarkdown(field).replace(/(?:```|~~~)[\s\S]*?(?:```|~~~)/g,"").replace(/`[^`\n]*`/g,"");
    let open:"$"|"$$"|undefined;
    for(const match of markdown.matchAll(/(?<!\\)(?:\\\\)*\$\$?/g)){
      const delimiter=match[0].endsWith("$$")?"$$":"$";
      if(open&&open!==delimiter)throw new Error(`Mismatched math delimiters in lesson prose: ${identity}`);
      open=open?undefined:delimiter;
    }
    if(open)throw new Error(`Unclosed math delimiter in lesson prose: ${identity}`);
    for(const match of markdown.matchAll(/\$\$([\s\S]*?)\$\$|(?<!\$)\$([^\n$]+)\$(?!\$)/g)){
      try{katex.renderToString(match[1]||match[2],{throwOnError:true,strict:"error"});}
      catch(error){throw new Error(`${identity}: ${(error as Error).message}`);}
    }
  }
}
