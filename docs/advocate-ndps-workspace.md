# Advocate NDPS workspace

The advocate portal now loads `advocate_chat.js`, `advocate_storage.js` and
`advocate_rehearsal.js`. It no longer loads the citizen chat controller or citizen
court simulator. No citizen frontend files were changed for this work.

Authenticated `/api/advocate` routes require the lawyer role. Advocate history uses
the `advocate:<account-id>` server owner namespace and `nyay_advocate_v2_<account>`
browser key. Existing citizen/shared history is preserved in its original storage;
it is not automatically imported into an advocate case.

Each case accepts text, multiple extracted PDF/DOCX/TXT/CSV documents, or both.
Extraction reports unreadable PDF pages; scanned images need OCR. Limits: 10 MB
per file, 150 PDF pages, 100,000 extracted characters per file. Limits are reported,
not silently truncated. Extracted text is retained with the user message. Follow-up
requests include every saved user turn and its document context; a 260,000-character
context limit asks for a new brief without deleting saved history.

Full research covers chronology, issues, provisions, related historical decisions,
strategy, opposition, evidence and next steps. Source paragraphs have immutable
passage IDs. A separate model call audits every paragraph; local checks reject
unknown sources, mismatched passages, missing citations and common overstatements.
Failed propositions are replaced with explicit verification tasks while supported
analysis is retained. Incomplete independent review still fails closed.

These are source-grounding and model-review safeguards, not a guarantee of legal
correctness. Exact passage matching does not prove semantic support. The system
does not verify every subsequent judgment, amendment, notification or local rule.
It cannot promise an exhaustive precedent search or a litigation outcome.

## Corpus audit, 30 October 2026

- NDPS: 24,776 indexed chunks, 640 distinct case IDs.
- Other four collections: no populated collection.
- Metadata years range from 1958 to 2025; the folder contains pre-Act material.
- All 24,776 citation and judge fields are blank; 11,985 case-number fields are blank.
- Advocate retrieval excludes obvious HTML debris and pre-1985 entries, uses only
  the narcotics collection, groups passages by case and flags incomplete metadata.
- Statutory wording comes from the official [Department of Revenue PDF](https://dor.gov.in/files/inline-documents/NDPS_1985.pdf),
  whose printed update date is 3 January 2022. The extracted snapshot records its
  retrieval date and SHA-256. It is explicitly not confirmed current consolidation.

## Counsel rehearsal

Open **Rehearse this case** below a research answer. The rehearsal snapshots the
facts and papers through that answer, separately from the untrusted research text.
Choose defense/prosecution and bail, charge, cross-examination or final submissions.
Each turn generates opposition, a bench question, private coaching and the next
submission task. It is a simulated counsel exercise, not a real order or prediction.
Transcripts, drafts and stage/side changes persist; a reload can restore the active
session. Deleting a chat retains its separately saved rehearsal snapshots.

## Verification

Run `node --test tests/*.test.cjs` and
`python -m unittest discover -s tests -p 'test_*.py'` from the project root.
Tests cover portal/account isolation, document extraction, original citizen routes,
source validation, complete paragraph audits, follow-up attachment context, stale
responses, rehearsal persistence and retries. Live synthetic tests exercise the
configured model and real NDPS collection. Browser preview uses an isolated
synthetic account; it is not a test of production login or real case data.

Final checks: 125 JavaScript tests and 103 Python tests passed. A live synthetic
full NDPS report produced 1,698 words with statutory and historical case sources;
a Hindi follow-up produced 456 words, and a separate counsel rehearsal produced
309 words. These are sampled successful checks, not an accuracy or latency guarantee.
The existing PM2 AI/backend services were restarted, and the new routes were
confirmed to return the expected authentication/input-validation responses.

Restart both the backend and AI service after applying server changes. Existing
launch scripts and dependencies remain applicable; no new package is required.

## Lawyer response language

Chat and rehearsal now detect the latest human message/submission independently
of saved language preferences, earlier answers and English source documents.
Hinglish stays in Latin script. Both generation and legal review receive the same
language instruction, including section headings, opposition, bench questions and
coaching. Source quotations and citation identifiers remain unchanged.

For an attachment-only message, use the last typed user message's language, or
the extracted document if there is no typed history. The UI's generic upload
label is not sent as an English language sample. Empty hearing openings use the
last counsel submission, then the research session's saved human language sample,
then its factual record for older sessions. The lawyer language selector has been
replaced by an automatic-language note; existing saved overrides are ignored.

Regression checks: 127 JavaScript tests and 113 Python tests pass, including
language switches, mixed-script queries, stale preferences, document-only input,
empty hearing openings, and language instructions in both generation and review.
The citizen assistant's language implementation is unchanged.
Live synthetic checks also returned Hinglish chat (`hi-Latn`), Hindi chat (`hi`),
and English rehearsal (`en`) despite conflicting saved language values. These
sampled model responses verify the language flow, not legal correctness.
