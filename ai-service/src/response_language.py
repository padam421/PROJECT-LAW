"""Choose reply language from the latest human words, independently of saved preferences."""
import re

LANGUAGES = {'en': 'English', 'hi': 'Hindi', 'te': 'Telugu', 'ta': 'Tamil', 'mr': 'Marathi',
             'gu': 'Gujarati', 'bn': 'Bengali', 'kn': 'Kannada', 'ml': 'Malayalam',
             'pa': 'Punjabi', 'ur': 'Urdu', 'or': 'Odia', 'as': 'Assamese',
             'ne': 'Nepali', 'sa': 'Sanskrit'}


def input_language(engine, message, fallback=''):
    sample = str(message or '').strip() or str(fallback or '').strip()
    sample = sample[:8000] + ('\n' + sample[-2000:] if len(sample) > 8000 else '')
    info = dict(engine.detect_and_translate_query(sample, preferred_lang='auto'))
    code = str(info.get('detected_language_code', 'en')).lower().split('-')[0]
    scripts = {'gu': r'[\u0a80-\u0aff]', 'pa': r'[\u0a00-\u0a7f]',
               'ta': r'[\u0b80-\u0bff]', 'te': r'[\u0c00-\u0c7f]',
               'kn': r'[\u0c80-\u0cff]', 'ml': r'[\u0d00-\u0d7f]',
               'or': r'[\u0b00-\u0b7f]', 'ur': r'[\u0600-\u06ff]',
               'hi': r'[\u0900-\u097f]', 'bn': r'[\u0980-\u09ff]'}
    counts = {lang: len(re.findall(pattern, sample)) for lang, pattern in scripts.items()}
    script = max(counts, key=counts.get)
    native = counts[script] > 0
    latin_letters = len(re.findall(r'[A-Za-z]', sample))
    if native and (code not in LANGUAGES or counts[script] >= latin_letters * .5):
        compatible = {'hi': {'hi', 'mr', 'ne', 'sa'}, 'bn': {'bn', 'as'},
                      'ur': {'ur', 'ar', 'fa'}}.get(script, {script})
        if code not in compatible:
            code = script
    hindi_words = set(re.findall(
        r'\b(?:mujhe|mera|mere|meri|kya|kaise|kyun|kyunki|nahi|nahin|hain|hai|hoon|hun|'
        r'batao|bataiye|samjhao|chahiye|liye|isme|iska|uska|karna|karu|hoga|hogi|'
        r'tha|thi|theek|madad|karo|kab|milega|raha|rahi|wapas)\b', sample.lower()))
    english_words = set(re.findall(
        r'\b(?:what|which|when|where|why|how|explain|please|should|would|could|'
        r'does|documents|evidence|keep|organise|organize)\b', sample.lower()))
    # A stale/mistaken Hindi detection must not turn an English-only message into Hindi.
    if (not native and not hindi_words and (code == 'hi' or code not in LANGUAGES and english_words)
            or native and counts[script] < latin_letters * .5 and len(english_words) >= 3
            and code in ('hi', 'auto')):
        code = 'en'
    hinglish = not native and (code == 'hi' or code in ('en', 'auto') and len(hindi_words) >= 2)
    name = ('Hinglish (Hindi in Latin script, with natural English legal terms)' if hinglish
            else LANGUAGES.get(code, 'the same language as the language_reference'))
    if hinglish:
        code = 'hi-Latn'
    elif not native and code in LANGUAGES and code != 'en':
        name += ' in Latin script'
    if code not in LANGUAGES and code != 'hi-Latn':
        code = 'auto'
    info.update(detected_language_code=code, language_name=name, language_reference=sample)
    return info


def chat_language_rule(info):
    return ('\nRESPONSE LANGUAGE: Match language_reference, the latest human input, including its '
            'script and natural code-switching. Write the entire answer, headings, visual labels and '
            'follow-up questions in ' + info['language_name'] + '. Previous user/assistant messages, '
            'attachments, retrieved English excerpts and saved language preferences must not override '
            'this turn. Keep citation IDs, proper names and source quotations unchanged. '
            'Hinglish stays in Latin letters; do not convert it to Devanagari or English-only prose.\n')
