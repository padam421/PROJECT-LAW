# User Find Lawyers directory

The user portal includes 12 fictional advocates covering 18 practice filters. The catalog is shared across user accounts; demo reservations, notes and messages are stored separately per signed-in account in this browser. Real API listings retain their existing profile and booking handlers. No advocate account or lawyer workspace is created or changed.

Search supports names, specialisations, cities and languages. Sort by experience, fee or rating; compare up to three demo profiles. Profile cards link to chat, voice and video booking options. Select 15, 30 or 60 minutes and a date/time in India. The estimate updates with mode and duration; duplicate reservations for the same account/advocate/time are rejected. Saved bookings support notes, local messages, completion, cancellation and JSON download.

These are **demo consultations**: no payment is collected, no advocate receives messages, and voice/video previews do not connect a live call. Profiles, ratings, experience, courts and fees are illustrative, not verified credentials or client reviews. Reservations are local browser data, not cross-device synchronized appointments. Clearing browser storage removes them. All of these limits are stated in the UI.

## Generated portraits

Created with the built-in image-generation tool. No external portrait service or real-person photo was used. Final PNGs are in `frontend/user/assets/lawyers/portrait-1.png` through `portrait-12.png`, loaded with lazy image loading.

Prompt set: square realistic professional headshot of a fictional Indian advocate; head and upper shoulders centered, full hair visible; formal blazer/suit, warm grey studio background, soft daylight, natural skin texture; no text, logos or watermark. Individual variations:

| Asset | Fictional profile | Portrait direction |
| --- | --- | --- |
| portrait-1.png | Arjun Mehra | Man about 45, short greying black hair, clean-shaven, charcoal suit |
| portrait-2.png | Ananya Rao | Woman about 34, pulled-back dark hair, navy blazer and ivory blouse |
| portrait-3.png | Devendra Shah | Man about 58, salt-and-pepper moustache, thin rectangular glasses |
| portrait-4.png | Kavita Menon | Woman about 42, shoulder-length wavy black hair, bindi, blazer and cream sari |
| portrait-5.png | Rohan Desai | Man about 31, curly hair, neatly trimmed beard, navy suit |
| portrait-6.png | Farah Siddiqui | Woman about 52, salt-and-pepper bob, spectacles |
| portrait-7.png | Aman Gill | Sikh man about 38, navy turban and groomed beard |
| portrait-8.png | Priya Iyer | Woman about 29, sleek long dark hair, navy jacket |
| portrait-9.png | Sanjay Kulkarni | Man about 50, receding salt-and-pepper hair, round glasses, clean-shaven |
| portrait-10.png | Neha Banerjee | Woman about 38, dark complexion, curly hair tied back |
| portrait-11.png | Vivek Reddy | Man about 36, short hair and moustache |
| portrait-12.png | Meera Joshi | Woman about 46, bun with silver streaks, blazer over sari |

## Validation

Run `node --test tests/*.test.cjs`. Directory tests cover practice coverage, assets, pricing and rounding, filtering, local persistence, account isolation, stale forms, duplicate slots, escaping, comparison limits, API failure and preserving real-lawyer handlers. Browser checks use an isolated preview account and the actual user component, stylesheet and directory module.
