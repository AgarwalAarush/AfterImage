"use client";

import { useEffect, useId, useRef, useState, type ComponentType } from "react";
import { ArrowRight, Check, RotateCcw } from "lucide-react";
import { InlineText } from "./math";

export type ReaderQuizQuestion = {
  id: string;
  question: string;
  options: { text: string; explanation: string }[];
  answer: number;
  source?: { url: string; label?: string };
};

export type ReaderQuizProps = {
  questions: ReaderQuizQuestion[];
  answers: Record<string, number>;
  checked: Record<string, boolean>;
  onSelect: (id: string, choice: number) => void;
  onCheck: (id: string) => void;
  onRetry: (id: string) => void;
  id?: string;
  "aria-label"?: string;
  Text?: ComponentType<{ text: string }>;
};

function selectedChoice(question: ReaderQuizQuestion, answers: Record<string, number>) {
  const choice = answers[question.id];
  return Number.isInteger(choice) && choice >= 0 && choice < question.options.length ? choice : undefined;
}

/** The reader owns persistence; both paper and Subjects quizzes share this presentation. */
export function ReaderQuiz({ questions, answers, checked, onSelect, onCheck, onRetry, id, "aria-label": label = "Reader quiz", Text = InlineText }: ReaderQuizProps) {
  const [index, setIndex] = useState(0);
  const groupId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const focusQuestion = useRef(false);
  const identity = JSON.stringify(questions.map(question => [question.id, question.question]));
  useEffect(() => { focusQuestion.current = false; setIndex(0); }, [identity]);
  useEffect(() => {
    if (focusQuestion.current) { heading.current?.focus(); focusQuestion.current = false; }
  }, [index]);
  if (!questions.length) return null;
  const currentIndex = Math.min(index, questions.length - 1);
  const question = questions[currentIndex];
  const choice = selectedChoice(question, answers);
  const isChecked = checked[question.id] === true && choice !== undefined;
  const correct = choice === question.answer;
  const completed = questions.filter(item => checked[item.id] === true && selectedChoice(item, answers) !== undefined);
  function move(next: number) { focusQuestion.current = true; setIndex(next); }

  return <section id={id} className="paper-quiz panel" aria-label={label}>
    <div className="quiz-heading"><span className="eyebrow">CHECK YOUR UNDERSTANDING</span><span className="eyebrow">{String(currentIndex + 1).padStart(2, "0")} / {String(questions.length).padStart(2, "0")}</span></div>
    <h2 ref={heading} tabIndex={-1}><Text text={question.question}/></h2>
    <fieldset><legend className="sr-only">{question.question}</legend>{question.options.map((option, optionIndex) => <label key={optionIndex} className={`quiz-option ${isChecked && optionIndex === question.answer ? "correct" : ""} ${isChecked && optionIndex === choice && !correct ? "incorrect" : ""}`}>
      <input type="radio" name={`quiz-${groupId}-${question.id}`} checked={choice === optionIndex} disabled={isChecked} onChange={() => onSelect(question.id, optionIndex)}/>
      <span><Text text={option.text}/></span>{isChecked && optionIndex === question.answer && <Check size={16} aria-hidden="true"/>}
    </label>)}</fieldset>
    {isChecked && <div className="quiz-feedback" role="status"><strong>{correct ? "Exactly." : "Not quite. Here’s the distinction."}</strong><p><Text text={question.options[choice].explanation}/></p>{!correct && <p><Text text={question.options[question.answer].explanation}/></p>}{question.source && <a href={question.source.url} target="_blank" rel="noreferrer">Revisit the source ↗</a>}</div>}
    <div className="quiz-actions">{!isChecked ? <button className="button primary" disabled={choice === undefined} onClick={() => onCheck(question.id)}>Check answer</button> : <button className="text-button" onClick={() => onRetry(question.id)}><RotateCcw size={13} aria-hidden="true"/>Try again</button>}<div>{currentIndex > 0 && <button className="text-button" onClick={() => move(currentIndex - 1)}>Previous</button>}{currentIndex < questions.length - 1 && <button className="text-button" onClick={() => move(currentIndex + 1)}>Next question<ArrowRight size={14} aria-hidden="true"/></button>}</div></div>
    {completed.length === questions.length && <p className="quiz-score">{questions.filter(item => selectedChoice(item, answers) === item.answer).length} of {questions.length} correct. Revisit any question to work through the distinction.</p>}
  </section>;
}
