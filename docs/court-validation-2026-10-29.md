# Court simulator fixes and verification

Checked on 29 October 2026 in the local PROJECT-LAW workspace.

## Why the reported error appeared

The AI log showed both model attempts timing out at ten seconds. Those failures put
the models into a shared sixty-second cooldown. A slow review could therefore block
the next witness answer, and an immediate retry could fail without making a request.
Consecutive live checks also exposed provider rate limiting. A fallback listed by the
provider returned HTTP 404 when actually called, so model-list metadata alone was not
sufficient to establish usable fallback access.

## Changes

- Allow up to sixteen seconds per generation attempt, at most two attempts within a
  thirty-four-second generation budget. Preserve a separate bounded review budget.
  The proxy and browser timeouts now leave room for generation and review.
- Separate generation and review timeout cooldowns. Share actual provider rate-limit
  cooldowns, respect Retry-After, and avoid artificial sleeps between model attempts.
- Use the directly tested `gemini-3.5-flash-lite` fallback. Apply minimal thinking to
  the structured courtroom requests without changing ordinary chat generation.
- Retry incomplete provider JSON within the same budget. If both models return
  incomplete output, return a recoverable service error rather than another crash.
- Return HTTP 503 and a retry delay for temporary provider failures; return HTTP 400
  for invalid witness contexts and malformed requests. Keep credentials and raw
  provider URLs out of courtroom error responses and logs.
- Retry one short provider pause automatically while retaining the exact witness,
  question and transcript. Keep manual retry and draft controls usable after failure.
- Abort requests and retry timers on leaving or changing the hearing; reject late
  responses. Preserve manual edits and accepted testimony.
- Keep objections to a judge clarification associated with the correct questioning
  lawyer and witness. Continuing a hearing cannot implicitly request AI testimony for
  a pending manual answer.
- Keep opening dialogue separate from witness-answer gates. If opening review is
  unavailable, retain neutral opening turns for both counsel so both witness practice
  branches remain available.
- Update the courtroom asset versions in both portals.
- Add duplicate detection to the backend launcher. Stop the verified duplicate local
  launcher and restore a single PM2-managed backend on port 3000.

## Verification results

| Check | Result |
|---|---|
| JavaScript regression suite | 80 passed, 0 failed |
| Python regression suite | 83 passed, 0 failed |
| Consecutive real courtroom API requests through the backend | 33 passed, 0 failed |
| Final post-restart witness answer and next response | 2 passed, 0 failed |
| Longest request in the 33-request matrix | 19.20 seconds |
| Total request time in that matrix | 153.65 seconds |
| Both portal pages, courtroom scripts/styles and three avatar models | All 12 resource requests returned HTTP 200 |
| Invalid witness request through the running backend | HTTP 400 with a useful error |
| JavaScript syntax, Python compilation, Git whitespace checks | Passed |
| Duplicate backend launcher | Exited cleanly without starting a second server |

The live matrix exercised District, High and Supreme Court settings; both witnesses
in direct and cross-examination; reactions to submitted answers; opposing questions;
continued hearings; question rephrasing; manual-question review; and speech review.
High Court checks used Hindi, and District/Supreme Court checks used English.
Only synthetic case facts were sent in these checks.

The automated suite additionally checked saved-session restore, account/case/room
isolation, exactly-once testimony recording, drafts, objections, no-further-questions,
manual versus AI ownership, pending request cancellation, stale responses, language
prompts, voice cancellation, private-text protection, HTML escaping, room geometry,
and both portals' script integration. Timeout, quota and malformed-provider failures
were deliberately simulated to verify recovery.

Reproduce the automated checks from the workspace root:

```powershell
node --test tests/*.test.cjs
python -m unittest discover -s tests -p 'test_*.py'
```

Detailed synthetic live responses are retained under
`.tmp-test/court-regression/`, with the matrix totals in `live-results.json`.

## Limits of this verification

The browser-control tool stopped because it could not establish the active browser
URL confidently. Visual layout, actual WebGL rendering, audible voice quality and
fullscreen interaction could not be verified through the browser in this run.
Geometry, state and speech lifecycle logic were exercised by the automated tests.

The local retrieval service currently reports one populated narcotics collection;
the four other configured collections are absent. These changes do not add missing
legal-source coverage or establish the correctness of every generated legal claim.
Provider-wide outages or exhausted account quotas can still require a later retry;
the hearing now retains its state and offers recovery controls.

Refresh the existing courtroom page with Ctrl+Shift+R to load the updated scripts.
