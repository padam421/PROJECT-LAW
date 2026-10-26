# Courtroom environments and practice director

Both the client and advocate portals load the same courtroom code. Authentication,
database records, the landing website and other portal sections are unchanged.

## Rooms and controls

- Supreme Court: three-member practice bench, walnut and burgundy, larger gallery.
- High Court: two-member practice bench, teak and green, arched window surrounds.
- District Court: single-judge practice bench, tiled floor, separate dock and staff desks.
- All three have two **practice witness stations**, both witness cameras, counsel,
  bench, gallery and court-staff views. These are representative educational rooms,
  not exact replicas or a claim that every hearing involves witness examination.
- Begin/pause/resume, restart, previous/next stage, automatic/manual camera, witness
  practice on/off, live typing record, voice toggle, quality selector and fullscreen.
  Fullscreen can be exited with its button or Esc. The room root is retained during
  court switches, including fullscreen switches.

Full HD targets 1920 render pixels across where the viewport and scale cap permit.
Ultra HD targets 3840 across, capped at 3x scale and 8,294,400 total pixels. Small
phone viewports may render below these targets. These are rendering-resolution
options, not a claim of photorealistic assets. The existing GLBs have body animation
but no facial blend shapes; head motion and gaze are procedural, not phoneme lip-sync.

## Choreography

`courtroom_director.js` builds a deterministic timeline around the unchanged source
dialogue. Each side gets a permission request, a bench response, witness entry,
counsel approach, questioning, optional cross-examination, release and a return
along the aisles. Multi-member benches rotate speaking turns.
Every inserted cue is visibly labelled **PRACTICE DIRECTION**. Source dialogue is
labelled separately; switching the room does not change legal content.

Supplied witness turns (`👤 Witness:`, `Defense witness:`, `Prosecution witness:`,
`गवाह:`, `साक्षी:` or `సాక్షి:`) are placed inside the relevant witness sequence.
Without supplied testimony, an answer form holds the hearing until the user supplies
an answer. The witness then reads that answer; the timeline waits for speech to end.
When a matching local voice is unavailable, the answer remains visible and a
localised “Answer finished — continue” button controls progression. Next stage
cannot bypass an unanswered question or interrupt a witness answer.

Opposing counsel's follow-up is optional: “No further questions” skips the
examination branch and keeps both counsel at their desks. Entering a follow-up
question runs permission, approach, question and another answer gate. Further
questions can be repeated, with each answer completed before the next question.
An optional objection inserts an objection, bench direction and a question editor;
the rephrased question is asked before the witness answers. These actions rehearse
procedure, rather than decide the legal merits of a real objection.

Typed answers and follow-up questions stay in page memory, isolated by room/case.
They are escaped before rendering and are excluded from external speech fallback.
Repeated supplied witness turns receive their own entry/exit sequence.

Waypoints and stage snapshots make skip, pause, room switching and restore
deterministic. Each court keeps its stage, elapsed movement, pause state and camera
in page memory for the current case. A new case clears those positions. A page
reload resets progress; only the room choice is saved to sessionStorage. Existing
case-script persistence remains unchanged.

The main characters reuse the project's existing rigged GLBs with normalised
height, court bands, clothing/skin colours, eyes and hair. Duplicate skin-proxy
joints are excluded from procedural rotation so facial parts stay aligned. Walking adds alternating leg
and arm movement; speaker gestures, objections, head motion and gaze are layered
over the speaking clips. Gallery figures have subtle gaze/blink/posture movement;
staff arms animate over keyboards while dialogue is spoken. Instanced supporting
figures reduce draw calls. Reduced-motion preferences disable procedural movement.

## Languages and privacy

Procedural prompts are provided in English, Hindi, Telugu, Tamil, Kannada, Malayalam,
Gujarati, Marathi, Bengali, Punjabi, Odia, Assamese, Urdu, Nepali and Sanskrit.
Unsupported languages do not receive English procedural inserts.

Case dialogue uses a matching browser/OS speech voice. If unavailable, captions
continue and a clear notice is shown. **Private case dialogue is never sent by this
new simulator fallback to the AI speech endpoint.** Only exact, built-in procedural
phrases are allowlisted for the existing `/api/ai/tts` service, which uses Google
Translate TTS. Two checks enforce this: the stage must be a practice cue, and the
outbound text must exactly match the selected language's fixed dictionary. Pause,
room switch and route exit abort requests and stop/revoke stream audio.

## Lifecycle and validation

Scene and speech generations reject stale callbacks after pause/switch/restart.
Route removal stops playback. Renderers, observers, geometry, textures, skeleton
textures and shadow maps are disposed; the three source model buffers are cached
in memory so room switches do not redownload them. Failed character loads use
simple fallback figures after 18 seconds; WebGL failure presents Retry.

Run `node --test tests/courtrooms.test.cjs` without accounts, network or services.
The tests cover original-script preservation, witness ordering, path clearance,
bench speakers, all prompt dictionaries, case isolation, stale speech cancellation,
private-text protection, HTML escaping, answer waiting/completion, optional
cross-examination and both portals' asset references.

## Research references

- [Balangir District Court official interior photos](https://balangir.dcourts.gov.in/gallery/district-court-building-balangir/): dais, staff desks, light walls and trial-court zoning.
- [Court Development Planning System report](https://cdnbbsr.s3waas.gov.in/s3ec0490f1f4972d133619a60c30f3559e/uploads/2024/01/2024011747.pdf): functional relationships and workstation placement.
- [Delhi High Court annual report](https://www.delhihighcourt.nic.in/files/2024-04/annualreportfile_sgnpj8jt.pdf) and [Supreme Court gallery](https://www.sci.gov.in/photo-gallery/): institutional references.
- [Bharatiya Sakshya Adhiniyam, Chapter X](https://www.indiacode.nic.in/indiacode/bitstream/123456789/20063/1/aa202347.pdf): examination, cross-examination, relevance and the court's control of questioning.
- [Supreme Court discussion of additional evidence on appeal](https://api.sci.gov.in/jonew/judis/44589.pdf): appellate evidence is conditional, rather than an automatic part of every appeal.
