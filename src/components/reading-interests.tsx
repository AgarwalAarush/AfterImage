"use client";
import { useId, useRef, useState, type FormEvent } from "react";
import type { AppState } from "@/lib/types";
import { useApp } from "./app";
import styles from "./reading-interests.module.css";

type InterestSummary = NonNullable<AppState["preferenceSummary"]>;
type InterestOperation = { kind: "add" | "suggestion" | "refresh" | "remove"; id?: string; decision?: "add" | "ignore" };
const strengths = [
  {value: "off", label: "Off"},
  {value: "less", label: "Less"},
  {value: "normal", label: "Normal"},
  {value: "stronger", label: "More"},
] as const;
const topicKey = (label: string) => label.trim().replace(/\s+/g, " ").toLocaleLowerCase();
// Only known domain responses can replace uncertain-write guidance. Never echo
// arbitrary transport diagnostics or a raw validation payload into this panel.
const interestErrorMessages = new Map([
  ["Use an interest name between 2 and 70 characters.", "Use an interest name between 2 and 70 characters."],
  ["Wait a minute before checking for interests again.", "Wait a minute before checking for interests again."],
  ["Interest checks are taking a short break. Try again in an hour.", "Interest checks are taking a short break. Try again in an hour."],
  ["You can keep up to 24 reading interests.", "You can keep up to 24 interests. Remove one below to add another."],
  ["This interest is no longer available.", "This interest is no longer available. Reload the page to see your current interests."],
  ["Unknown interest", "This interest is no longer available. Reload the page to see your current interests."],
  ["This interest suggestion is no longer available.", "This suggestion is no longer available. Reload the page to see your current suggestions."],
  ["This interest suggestion has changed. Refresh and try again.", "This suggestion has changed. Reload the page before choosing it again."],
  ["Interest action already used.", "This action has already been used. Reload the page before trying again."],
  ["Duplicate interest", "Your interests have changed. Reload the page before trying again."],
  ["Please sign in again.", "Please sign in again to update your interests."],
]);
function interestErrorMessage(error: unknown, uncertainMessage: string) {
  return error instanceof Error ? interestErrorMessages.get(error.message) ?? uncertainMessage : uncertainMessage;
}


export function InterestControls() {
  const {state, act, busy} = useApp();
  const id = useId();
  const [pending, setPending] = useState<InterestSummary | null>(null);
  const [operation, setOperation] = useState<InterestOperation | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [messageArea, setMessageArea] = useState<"suggestions" | "add" | "interests">("interests");
  const [label, setLabel] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const suggestionsHeadingRef = useRef<HTMLHeadingElement>(null);
  const interestListRef = useRef<HTMLDivElement>(null);
  const interestsHeadingRef = useRef<HTMLHeadingElement>(null);
  const profile = pending ?? state?.preferenceSummary;
  if (!profile) return null;
  const locked = busy || pending !== null || operation !== null;
  const existingInterests = profile.interests;
  const suggestions = profile.suggestedInterests ?? [];
  const discoveryStatus = profile.interestDiscoveryStatus ?? "idle";
  const discovering = discoveryStatus === "queued" || discoveryStatus === "running";
  const duplicate = profile.interests.some(interest => topicKey(interest.label) === topicKey(label));

  async function update(next: InterestSummary) {
    if (locked) return;
    setPending(next);
    setMessageArea("interests");
    setError("");
    setNotice("");
    try {
      await act({action: "interests", learningFromReading: next.learningFromReading,
        interests: next.interests.map(({id, strength}) => ({id, strength}))});
    } catch (error) {
      setError(interestErrorMessage(error, "We couldn’t confirm the change. Check your connection and review your interests before trying again."));
    } finally {
      setPending(null);
    }
  }

  async function addInterest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submittedLabel = label.trim().replace(/\s+/g, " ");
    if (locked || submittedLabel.length < 2 || duplicate) return;
    const submittedFrom = document.activeElement;
    setOperation({kind: "add"});
    setMessageArea("add");
    setError("");
    setNotice("");
    try {
      const result = await act({action: "interest-add", label: submittedLabel, eventId: crypto.randomUUID()});
      const nextProfile = result.state?.preferenceSummary as InterestSummary | undefined;
      const added = nextProfile?.interests.find(interest => !existingInterests.some(existing => existing.id === interest.id));
      setLabel("");
      setNotice(added ? `${added.label} added to your interests.` : "That topic is already covered by your interests.");
      requestAnimationFrame(() => {
        if (document.activeElement === submittedFrom || document.activeElement === document.body) inputRef.current?.focus();
      });
    } catch (error) {
      setError(interestErrorMessage(error, "We couldn’t confirm that interest was added. Your topic is still here. Check your interests before trying again."));
    } finally {
      setOperation(null);
    }
  }

  async function decideSuggestion(suggestionId: string, suggestionLabel: string, decision: "add" | "ignore") {
    if (locked) return;
    const submittedFrom = document.activeElement;
    const hadFocus = suggestionsRef.current?.contains(submittedFrom);
    const index = suggestions.findIndex(suggestion => suggestion.id === suggestionId);
    const nextId = suggestions[index + 1]?.id ?? suggestions[index - 1]?.id;
    setOperation({kind: "suggestion", id: suggestionId, decision});
    setMessageArea("suggestions");
    setError("");
    setNotice("");
    try {
      const result = await act({action: "interest-suggestion", suggestionId, decision, eventId: crypto.randomUUID()});
      const nextProfile = result.state?.preferenceSummary as InterestSummary | undefined;
      const added = nextProfile?.interests.find(interest => !existingInterests.some(existing => existing.id === interest.id));
      setNotice(decision === "ignore" ? `${suggestionLabel} ignored.` : added ? `${added.label} added to your interests.` : "That topic is already covered by your interests.");
      if (hadFocus) requestAnimationFrame(() => {
        if (document.activeElement !== submittedFrom && document.activeElement !== document.body) return;
        const actions = suggestionsRef.current?.querySelectorAll<HTMLButtonElement>("[data-suggestion-add]");
        const nextAction = actions && Array.from(actions).find(button => button.dataset.suggestionAdd === nextId);
        (nextAction ?? suggestionsHeadingRef.current)?.focus();
      });
    } catch (error) {
      setError(interestErrorMessage(error, "We couldn’t confirm that choice. Check your connection and review your suggestions before trying again."));
    } finally {
      setOperation(null);
    }
  }

  async function removeInterest(interestId: string, interestLabel: string) {
    if (locked) return;
    const submittedFrom = document.activeElement;
    const hadFocus = interestListRef.current?.contains(submittedFrom);
    const index = existingInterests.findIndex(interest => interest.id === interestId);
    const nextId = existingInterests[index + 1]?.id ?? existingInterests[index - 1]?.id;
    setOperation({kind: "remove", id: interestId});
    setMessageArea("interests");
    setError("");
    setNotice("");
    try {
      await act({action: "interest-remove", interestId, eventId: crypto.randomUUID()});
      setNotice(`${interestLabel} removed. You can add it again.`);
      if (hadFocus) requestAnimationFrame(() => {
        if (document.activeElement !== submittedFrom && document.activeElement !== document.body) return;
        const rows = interestListRef.current?.querySelectorAll<HTMLFieldSetElement>("[data-interest-row]");
        const nextRow = rows && Array.from(rows).find(row => row.dataset.interestRow === nextId);
        const nextControl = nextRow?.querySelector<HTMLInputElement>('input[type="radio"]:checked');
        (nextControl ?? interestsHeadingRef.current)?.focus();
      });
    } catch (error) {
      setError(interestErrorMessage(error, "We couldn’t confirm that interest was removed. Check your interests before trying again."));
    } finally {
      setOperation(null);
    }
  }

  async function retrySuggestions() {
    if (locked || discovering) return;
    setOperation({kind: "refresh"});
    setMessageArea("suggestions");
    setError("");
    setNotice("");
    try {
      const result = await act({action: "refresh-interest-suggestions", eventId: crypto.randomUUID()});
      const status = result.state?.preferenceSummary?.interestDiscoveryStatus;
      setNotice(status === "queued" ? "New interests are queued for discovery." : status === "running"
        ? "Looking for new interests in your papers…" : "Your interests are saved. A new check wasn’t started.");
    } catch (error) {
      setError(interestErrorMessage(error, "We couldn’t confirm the request. Check your connection before trying again."));
    } finally {
      setOperation(null);
    }
  }

  const feedback = <>
    {error && <p className="form-error interest-error" role="alert">{error}</p>}
    <p className={styles.actionStatus} role="status" aria-live="polite">{notice}</p>
  </>;

  return <section className={`reading-interests panel ${styles.root}`} aria-labelledby={`${id}-heading`}>
    <header className="interest-heading">
      <h2 id={`${id}-heading`}>Reading interests</h2>
      <span className="interest-save-status" role="status">{operation?.kind === "refresh" ? "Requesting…" : pending || operation ? "Saving…" : error ? "Check the message below" : "Saved automatically"}</span>
    </header>
    <section className={styles.suggestions} aria-labelledby={`${id}-suggestions-heading`}>
      <h3 ref={suggestionsHeadingRef} id={`${id}-suggestions-heading`} tabIndex={-1}>Suggested interests</h3>
      <p className={styles.description}>Topics connected to your papers and feedback. Choose what to explore next.</p>
      <div ref={suggestionsRef} className={styles.suggestionList}>
        {suggestions.map(suggestion => <article className={styles.suggestion} key={suggestion.id} aria-labelledby={`${id}-suggestion-${suggestion.id}`}>
          <h4 id={`${id}-suggestion-${suggestion.id}`}>{suggestion.label}</h4>
          <p className={styles.reason}>{suggestion.reason}</p>
          {suggestion.evidence.length > 0 && <details className={styles.evidence}>
            <summary>Based on {suggestion.evidence.length} {suggestion.evidence.length === 1 ? "paper" : "papers"}</summary>
            <ul>{suggestion.evidence.map(paper => <li key={paper.paperId}>{paper.title}</li>)}</ul>
          </details>}
          <div className={styles.suggestionActions}>
            <button className="button small" type="button" data-suggestion-add={suggestion.id} aria-label={`Add ${suggestion.label} to your interests`}
              aria-disabled={locked} onClick={() => void decideSuggestion(suggestion.id, suggestion.label, "add")}>
              {operation?.id === suggestion.id && operation.decision === "add" ? "Adding…" : "Add interest"}
            </button>
            <button className="text-button" type="button" aria-label={`Ignore ${suggestion.label}`} aria-disabled={locked}
              onClick={() => void decideSuggestion(suggestion.id, suggestion.label, "ignore")}>
              {operation?.id === suggestion.id && operation.decision === "ignore" ? "Ignoring…" : "Ignore"}
            </button>
          </div>
        </article>)}
      </div>
      {suggestions.length === 0 && !discovering && discoveryStatus !== "failed" && <p className={styles.empty}>
        New interests will appear as you save papers, give feedback{profile.learningFromReading ? " and read" : ""}. You can also add any topic below.
      </p>}
      {discovering && <p className={styles.discoveryStatus} role="status">
        {discoveryStatus === "running" ? "Looking for new interests in your papers…" : "New interests are queued for discovery."}
      </p>}
      {discoveryStatus === "failed" && !operation && <div className={styles.discoveryError}>
        <p>We couldn’t check for new interests. Your existing interests are saved.</p>
        <button className="text-button" type="button" aria-disabled={locked} onClick={() => void retrySuggestions()}>Try again</button>
      </div>}
      {messageArea === "suggestions" && feedback}
    </section>
    <form className={styles.addForm} onSubmit={event => void addInterest(event)}>
      <label htmlFor={`${id}-new-interest`}>Add your own interest</label>
      <div className={styles.addRow}>
        <input ref={inputRef} id={`${id}-new-interest`} value={label} minLength={2} maxLength={70} placeholder="Any topic you want to explore"
          autoComplete="off" readOnly={operation?.kind === "add"} aria-describedby={duplicate ? `${id}-duplicate` : undefined}
          onChange={event => setLabel(event.target.value)}/>
        <button className="button small" type="submit" disabled={locked || label.trim().length < 2 || duplicate}>
          {operation?.kind === "add" ? "Adding…" : "Add"}
        </button>
      </div>
      {duplicate && <p className={styles.inlineHelp} id={`${id}-duplicate`}>Already in your interests. Adjust it below.</p>}
      {messageArea === "add" && feedback}
    </form>
    <section className={styles.yourInterests} aria-labelledby={`${id}-your-interests-heading`}>
      <h3 ref={interestsHeadingRef} id={`${id}-your-interests-heading`} tabIndex={-1}>Your interests</h3>
      <p className="interest-description" id={`${id}-strength-help`}>More gives an interest extra weight. Off pauses it.</p>
      {profile.interests.length === 0 && <p className={styles.empty}>Add a suggested interest or a topic of your own to get started.</p>}
      <div ref={interestListRef} className="interest-list">{profile.interests.map(interest => <fieldset className={`interest-row ${styles.interestRow}`} key={interest.id}
        data-interest-row={interest.id} aria-describedby={`${id}-strength-help`}>
        <legend><span className={styles.interestLabel}>{interest.label}</span></legend>
        <button className={`text-button ${styles.removeInterest}`} type="button" aria-disabled={locked}
          aria-label={`Remove ${interest.label} from your interests`} onClick={() => void removeInterest(interest.id, interest.label)}>
          {operation?.kind === "remove" && operation.id === interest.id ? "Removing…" : "Remove"}
        </button>
        <div className="interest-strengths">{strengths.map(({value, label}) => <label className="interest-choice" key={value}>
          <input type="radio" name={`${id}-${interest.id}`} value={value} checked={interest.strength === value}
            aria-disabled={locked} onChange={() => {
              if (!locked) void update({...profile, interests: profile.interests.map(item => item.id === interest.id ? {...item, strength: value} : item)});
            }}/>
          <span>{label}</span>
        </label>)}</div>
      </fieldset>)}</div>
    </section>
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
    {messageArea === "interests" && feedback}
  </section>;
}
