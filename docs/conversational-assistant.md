# Conversational assistant and saved court sessions

The user and advocate portals now share `assistant_threads.js`, `assistant_chat.js`
and `live_court.js`. These extend the existing portal layout and courtroom scene.

## Chat behaviour

The AI selects the answer's organisation and depth from the actual problem and
latest request. Follow-up history is included as conversation context; it no longer
means “user rejected the previous answer”. Explicit feedback retry asks for better
clarity/correctness rather than fabricated alternative facts. The old mandatory
four-section report and embedded judge/lawyer debate have been removed from the
RAG generation path.

Answers use the selected/detected language, explain terms simply and return an
optional structured visual (up to eight flow/comparison nodes). The renderer
supports all Markdown heading levels, paragraphs and lists, escapes HTML, and
renders visuals and retrieved source excerpts without executing generated code.

An independent model review checks consistency with supplied facts/excerpts. Source
IDs outside the retrieved set are removed. No-retrieval responses include a localised
brief coverage note at the end, after useful conditional guidance. Substantial case
questions target 450–650 words with explanations, document priorities and essential
unknowns; narrow follow-ups remain concise. A review below 350 words triggers a
bounded detail-repair pass. Review includes attachment context and explicit checks
for facts, relevance, language, evidence support and balanced detail. Cited excerpts
are audited for supported propositions and limitations; retrieval analysis is not
treated as an authority for user facts. Unsupported specific law
references trigger correction or a limited practical fallback, rather than being
displayed as verified law. This is not an
independent current-law verification service and cannot guarantee legal accuracy.

## Corpus audit, 26 October 2026

Read-only SQLite inspection found:

| Folder | Collection | Indexed embeddings |
| --- | --- | ---: |
| Narcotics / NDPS | `sc_narcotics_ndps` | 24,776 |
| Murder / Homicide | No collection | 0 |
| Rape / POCSO | No collection | 0 |
| Terrorism / UAPA | No collection | 0 |
| Writ / Constitutional | No collection | 0 |

Unrelated civil questions must not inherit NDPS sources merely because terms like
“witness” or “recovery” overlap. Populating broader, authoritative statutory and
case-law datasets remains necessary for broader source-grounded coverage.

## Persistence

New Chat creates a new thread; existing chats and court sessions are preserved.
Conversation history is namespaced by signed-in account ID locally and saved through
authenticated `/api/assistant/threads` endpoints to MySQL's additive
`ai_conversation_threads` table. The server derives owner ID from authentication,
never from request-body identity. No existing user/auth tables are modified.

Each row stores one thread, its messages and court sessions. Optimistic revision
checks return 409 for stale writes, preserving the local copy instead of silently
overwriting another tab. Failed sync remains locally cached and retries on later
edits/reconnection. UI distinguishes account save from device-only storage.
Chat deletion clears its messages and syncs a tombstone, avoiding accidental
resurrection by old tabs. Saved court preparation snapshots remain accessible in
the Court Prep library, including their case brief and exact hearing progress.
They can be resumed or deleted independently; deleting a session does not delete
other sessions or chats. The simulation/hearing choreography is unchanged by these
storage and navigation controls.
Export downloads a JSON copy. Local storage quotas and the 2.5 MB per-thread sync
limit are reported; no automatic pruning is performed.

The former account-scoped citizen chat can migrate when its profile identity matches.
Unattributed legacy advocate history is retained in its old key and can be explicitly
recovered by its owner; it is not silently assigned to whichever account logs in next.

## Virtual Court

Opening Virtual Court from a message creates/resumes a separate session associated
with that message and chat. Its brief uses the conversation's user-supplied facts
and attachments, rather than parsing a courtroom script out of the chat answer.
The opening contains a few fresh AI turns; later reactions are generated only as
needed from the actual completed transcript and witness response.

The existing permission/approach/witness-box choreography is retained. Your side's
witnesses retain manual submission and the existing AI answer-and-submit action
during both direct and cross-examination. A pending manual answer waits. Edits made
while AI assistance is running prevent its late response from replacing your answer.
Opposing witnesses answer automatically during both stages; their controls never
ask the user to supply testimony. Their answers follow established facts, knowledge
and previous testimony, with plausible minor simulated details permitted where
unspecified, but no invented decisive evidence or automatic admissions.

Direct follow-ups stay with the presenting lawyer. When direct examination finishes,
opposing counsel can generate one adaptive cross question or decline. For opposing
witnesses, the user can enter a cross question, request an optional AI question draft,
or decline. A question draft is submitted only with Ask question. The separate
question and answer fields retain independent drafts when an objection requires
rephrasing. Existing practice rulings are retained; necessary generated judicial
clarifications play before the associated question. The judge does not have to
comment after each answer. Cross completion returns counsel and releases the witness
before existing proceedings resume. Continue hearing retains this sequence when it
introduces another witness question.

Witness IDs, sides, questioners, examination stages, pending/drafted/submitted answer
state, answer choices and rulings travel with saved timelines and accepted testimony.
Older saved plans gain this metadata without rebuilding or discarding their answers.
Court generation receives the full testimony/ruling record with speaker and witness
identity; lawyer allegations and procedural directions are explicitly distinguished
from testimony. Unchanged case retrieval is cached in a bounded in-process cache,
selected languages skip repeated detection, and four focused internal checks are
requested within the same generation. Speaker/stage/duplicate-question validation
rejects malformed responses before display; none of these checks claims external
legal verification. The model does not impose a fixed final-order endpoint.

Judicial clarification questions retain the judge as speaker and create an answer
gate for the same witness, with the existing answer choices. When a response supplies
a judicial direction and a separate question field, the direction is retained and
that exact question is assigned to the active lawyer without another model call.
Directions are never converted into witness answers.

Court generation supplies a stage-specific JSON schema to the provider: witness
answers permit only that witness, and examination questions permit only the active
lawyer and judge. This constrains role labels at generation time; it does not prove
factual or legal correctness. The transport uses the provider's documented
[`responseJsonSchema` field](https://ai.google.dev/api/generate-content#v1beta.GenerationConfig).
If no new question is produced and the proposal repeats an earlier question, the
line finishes without asking it again or creating a retry loop. A failed automatic
cross question retains styled Retry and Skip this practice cross-examination actions;
a failed rephrase can be explicitly withdrawn. Neither recovery action can bypass
a pending witness answer or create testimony. Error details stay visible in the
panel so a temporary provider failure is distinguishable from a validation issue.

Courtroom requests use a separate latency profile: at most two model attempts,
10-second socket timeouts, a 24-second retry budget, no retry sleeps, and a brief
cooldown for unavailable models. The last working fast model is preferred. Normal
chat generation keeps its existing budget. Witness answers/reactions/cross questions
reuse supplied case facts and any cached legal excerpts without loading embeddings
or running another precedent search. The court HTTP client waits at most 45 seconds.
While a reaction is pending, Continue manually preserves the submitted testimony and
discards any late result. Retry/continue buttons retain their normal action styling.
Live synthetic Hindi court checks on 28 October 2026 returned successful responses
in 2.38 seconds (recording follow-up), 6.77 seconds (witness answer), and 3.22 seconds
(opposing cross question). These are observed samples, not a latency guarantee.

After AI route/engine changes, restart the running `nyaysetu-ai` service so both
layers forward the same witness context. The batch launcher now skips startup when
the AI port is already serving, preventing an old parallel instance from handling
requests instead of the managed service. Court assets use updated cache versions
in both portals. `tests/test_court_api.py` checks witness context through the actual
Flask route and engine wrapper for both sides and examination stages.

Each session stores transcript, source script, per-room timeline/position,
interactions, camera and pause state. Saving occurs at stage transitions, route exit
and visibility/pagehide. A reload can replay the current unfinished utterance; it
does not restore an audio playback timestamp. Opening another chat detaches the old
court session while retaining its saved record. Stale asynchronous responses cannot
navigate a newly selected chat into an old hearing.

## Data and AI processing choices

The user explicitly authorised sending selected case text, witness answers,
conversation context and retrieved legal excerpts to the existing Gemini API for
analysis and courtroom reactions. Other chats are not part of that request.
Stored history is retained; model context is bounded to opening facts and recent
turns for long conversations (first four plus latest sixteen, with text limits).

The user's separate voice preference remains: private case text stays in the browser
for matching Web Speech voices/captions, not Google Translate TTS. Only exact,
built-in procedural phrases may use the existing procedural speech fallback.

## Verification

Courtroom speech has an additional private review in `ai-service/src/court_review.py`.
Every generated judge/counsel turn and submitted counsel question is reviewed before
captions or speech. The reviewer checks the accepted record, witness identity,
questioning side, examination stage, facts, procedure, language and legal claims.
Human witness answers remain outside this review and are not rewritten or rejected.
AI witness answers keep the existing generation/role checks.

The independent review has up to 20 seconds after drafting (within the overall
40-second draft/review target); there is no artificial sleep. Late or malformed
reviews never release the unchecked draft. Unsupported substantive speech becomes
a neutral factual clarification; an unsupported saved procedural direction may be
withdrawn without creating an unplanned witness answer. Network/socket deadlines
are bounded, but process scheduling and PDF extraction are not hard real-time guarantees.

Only fetched, fixed India Code documents currently provide primary legal text:
NDPS, BNS, BNSS and BSA. The BSA document uses the official
[India Code PDF](https://www.indiacode.nic.in/indiacode/bitstream/123456789/20063/1/aa202347.pdf).
Other laws and precedents are subject to the same review but cannot be asserted
without supporting authority. Indexed case excerpts are background, not proof of
current law. Retrieval dates do not establish amendment status, commencement,
savings, jurisdiction or incident-date applicability. Reported FIR/section details
are allegations or record entries, never proof of a rule of law. Every legal
sentence needs a complete audit entry; unrelated numbers in testimony cannot
support an invented section. Redirects cannot leave the fixed official host.

Fixed practice requests/directions contain no case-specific facts or legal rules;
their exact dictionary text, language and speaker are checked locally on every
playback. Questions and edited directions use server review. Saved approvals are
bound to text, session, court, language, examination, record epoch and a five-minute
expiry window. New testimony
or judicial directions invalidate earlier approvals. Old script-only caches without
a live case record use the neutral demonstration until relaunched from a case chat.

Checks, authority audits and pass/fail details stay internal. No verification
badges, scores or coverage reports are added to the courtroom UI. These safeguards
reduce errors; neither the model review nor source matching guarantees legal accuracy.
After changing AI modules, restart the AI service; reload both portals to use the
updated courtroom asset versions.

`node --test tests/*.test.cjs` covers persistence, account isolation, stale responses,
court restoration, Markdown/visual escaping and the existing courtroom behaviour.
`python -m unittest discover -s tests -p test_conversation_engine.py` covers evidence
filtering, citation validation, review passes, language and structured turns.
`tests/test_court_latency.py` checks overload fallback, retry limits, model cooldown
and separation from the normal chat budget without making provider requests.

`tests/cross_examination.test.cjs` exercises the real director, simulator controls
and live session integration with deterministic AI fixtures: both ownership rules,
manual and AI submission in both stages, adaptive context, declines, pending edits,
objections/rephrasing, judicial clarifications, continuation and saved-plan migration.
The cross-examination update's browser check used isolated production controls and
synthetic responses, not live provider output or real account data.

Live synthetic Hindi tests exercise covered NDPS and uncovered tenancy questions,
a follow-up diagram,
an independent court opening and a reaction to a witness's new answer. Real MySQL
smoke tests create uniquely named synthetic rows, verify persistence/isolation and
revision conflicts, then remove only those rows. An isolated authenticated API test
verifies 401/200/409/400 behaviour without using real account credentials.

Browser visual QA was unavailable because local browser use was disabled in Work
settings. No claim of a verified final browser screenshot is made for this change.
