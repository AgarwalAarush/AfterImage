"use client";
import { useApp } from "./app";
export function InterestControls() {
  const {state,act,busy,toast} = useApp(), profile = state?.preferenceSummary;
  if (!profile) return null;
  function update(interests = profile!.interests, learningFromReading = profile!.learningFromReading) {
    void act({action: "interests",learningFromReading,interests: interests.map(({id,strength}) => ({id,strength}))})
      .then(() => toast("Reading interests updated.")).catch(() => {});
  }
  return <section className="reading-interests panel" aria-label="Reading interests">
    <div className="section-heading"><h2>Interests</h2><label className="engagement-switch">
      <input type="checkbox" role="switch" checked={profile.learningFromReading} disabled={busy}
        onChange={e => update(undefined,e.target.checked)}/> Learn from engaged reading</label></div>
    <div className="interest-list">{profile.interests.map(interest => <div className="interest-row" key={interest.id}>
      <span>{interest.label}</span><div role="group" aria-label={interest.label}>
        {(["stronger","normal","less","off"] as const).map(strength => <button type="button" className="text-button"
          aria-pressed={interest.strength === strength} disabled={busy} key={strength}
          onClick={() => update(profile.interests.map(i => i.id === interest.id ? {...i,strength} : i))}>
          {{stronger:"More",normal:"Normal",less:"Less",off:"Off"}[strength]}</button>)}
      </div></div>)}</div>
    <small>Reading counts after 45 seconds while this paper is visible and your browser is focused.</small>
  </section>;
}
