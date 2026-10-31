# Chat Listen readout

The user portal's saved-conversation integration now uses `NyaySetuTTS` instead of a second, incomplete speech implementation. The clicked saved answer supplies the text and language; `auto` and regional tags such as `hi-IN` are resolved correctly.

The controller waits briefly for browser voices, retains utterances, splits long answers into bounded sentence chunks, and updates Loading/Stop/Listen controls. Stop, navigation, conversation changes and stale callbacks cannot restart an old answer. Errors and stalled playback end with a visible message rather than an engine fallback loop.

When no matching voice is available, or browser speech fails, the user can allow online speech for that answer. The dialog identifies Google as the speech provider and explains that the answer text will be sent. Declining makes no online request. Online playback uses authenticated `POST /api/ai/tts` through the normal application backend, with bounded inputs, timeouts and no-store responses. It does not put case text in application request URLs. Audio objects and blob URLs are released on completion/cancellation.

Online speech depends on the existing AI-service speech provider and internet connectivity. Browser sound/autoplay policy and installed voices still apply; the UI reports failure and allows retry. Lawyer chat and court simulation are unchanged.

Validation: run `node --test tests/*.test.cjs`. Focused tests in `tests/chat_tts.test.cjs` cover delayed voices, language detection, chunking, native and online playback, permission denial, cancellation, account switching, stale responses, errors, chat wiring and the authenticated proxy. Synthetic Hindi and English samples returned MPEG audio from the local AI service. Synthetic Hindi browser playback reached the playing state; no user case text was used in validation.
