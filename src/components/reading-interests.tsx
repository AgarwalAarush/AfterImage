"use client";
import { useId, useState } from "react";
import type { AppState } from "@/lib/types";
import { useApp } from "./app";

type InterestSummary = NonNullable<AppState["preferenceSummary"]>;
const strengths = [
  {value: "off", label: "Off"},
  {value: "less", label: "Less"},
  {value: "normal", label: "Normal"},
  {value: "stronger", label: "More"},
] as const;

export function InterestControls() {
  const {state, act, busy} = useApp();
  const id = useId();
  const [pending, setPending] = useState<InterestSummary | null>(null);
  const [error, setError] = useState("");
  const profile = pending ?? state?.preferenceSummary;
  if (!profile) return null;
  const locked = busy || pending !== null;

  async function update(next: InterestSummary) {
    if (locked) return;
    setPending(next);
    setError("");
    try {
      await act({action: "interests", learningFromReading: next.learningFromReading,
        interests: next.interests.map(({id, strength}) => ({id, strength}))});
    } catch {
      setError("Could not save your interests. Try that choice again.");
    } finally {
      setPending(null);
    }
  }

  return <section className="reading-interests panel" aria-labelledby={`${id}-heading`}>
    <header className="interest-heading">
      <h2 id={`${id}-heading`}>Reading interests</h2>
      <span className="interest-save-status" role="status">{pending ? "Saving…" : error ? "Changes not saved" : "Saved automatically"}</span>
    </header>
    <p className="interest-description" id={`${id}-strength-help`}>More gives an interest extra weight. Off pauses it.</p>
    <div className="interest-list">{profile.interests.map(interest => <fieldset className="interest-row" key={interest.id}
      aria-describedby={`${id}-strength-help`}>
      <legend>{interest.label}</legend>
      <div className="interest-strengths">{strengths.map(({value, label}) => <label className="interest-choice" key={value}>
        <input type="radio" name={`${id}-${interest.id}`} value={value} checked={interest.strength === value}
          aria-disabled={locked} onChange={() => {
            if (!locked) void update({...profile, interests: profile.interests.map(item => item.id === interest.id ? {...item, strength: value} : item)});
          }}/>
        <span>{label}</span>
      </label>)}</div>
    </fieldset>)}</div>
    <div className="engagement-setting">
      <label className="engagement-switch">
        <input type="checkbox" role="switch" checked={profile.learningFromReading} aria-disabled={locked}
          aria-describedby={`${id}-engagement-help`} onChange={event => {
            if (!locked) void update({...profile, learningFromReading: event.target.checked});
          }}/>
        <span className="engagement-switch-face" aria-hidden="true" />
        <span>Learn from reading</span>
      </label>
      <p id={`${id}-engagement-help`}>Reading helps shape suggestions after 45 seconds with a paper visible and your browser focused.</p>
    </div>
    {error && <p className="form-error interest-error" role="alert">{error}</p>}
  </section>;
}
