# Suggestion refresh feedback

Next reads uses the existing “Updating suggestions…” header control and spinning refresh icon while a recommendation job is queued or running. The full-width “Finding your next paper…” notice is removed from partial shortlists so existing suggestion cards sit directly below the section heading.

Refresh submission, job polling, refill behavior, failure feedback, and the empty-shortlist explanation retain their existing behavior. This is a web presentation change; it needs no worker, storage, or content migration.

The current Home owner is `src/components/home.tsx`. Recommendation source changes remain bound to the Subjects shared-workspace integration digest. A web release must retain the existing core, scientific, and renderer approvals and renew the affected workspace acceptance before deployment.

## Local validation

- TypeScript checking passes.
- All fifteen existing recommendation and recommendation-flow tests pass.
- Dia shows the retained header indicator, existing card, and absence of the full-width notice using an isolated SQLite fixture with one suggestion and a queued refill.

This change has not been deployed.
