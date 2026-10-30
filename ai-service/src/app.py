"""
=============================================================================
Nyay Setu — AI Service Application
app.py — Flask REST API for Legal RAG Chatbot & Virtual Court Simulator
=============================================================================
"""

import os
import sys

# Ensure UTF-8 on Windows
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

from flask import Flask, Request, request, jsonify
from flask_cors import CORS
from rag_engine import get_rag_engine

class CaseRequest(Request):
    @property
    def max_content_length(self):
        return 11 * 1024 * 1024 if self.path == '/api/ai/advocate/documents' else super().max_content_length


app = Flask(__name__)
app.request_class = CaseRequest
app.config['MAX_CONTENT_LENGTH'] = 2 * 1024 * 1024
CORS(app, resources={r"/api/*": {"origins": "*"}})

print("🚀 Starting Nyay Setu AI Service...")
engine = get_rag_engine()

@app.route('/api/ai/health', methods=['GET'])
def health():
    """Health check returning database status and loaded collection counts."""
    counts = {}
    for key, col in engine.collections.items():
        try:
            counts[key] = col.count()
        except Exception:
            counts[key] = "loaded"

    return jsonify({
        "status": "healthy",
        "service": "Nyay Setu Supreme Court AI RAG Engine",
        "total_vectors": engine.total_vectors,
        "collections": counts,
        "gemini_model": "gemini-3.1-flash-lite (with configured fallbacks)",
        "assistant_mode": "contextual-advice-and-incremental-court"
    })

@app.route('/api/ai/chat', methods=['POST'])
def chat():
    """
    RAG Chat endpoint for both User and Advocate portals.
    Contextual advice with retrieved excerpts and a separate consistency review.
    """
    data = request.get_json() or {}
    message = data.get('message', '').strip()
    user_role = data.get('role', 'user')  # 'user' or 'lawyer'
    case_context = data.get('caseContext', None)
    language = data.get('language', 'auto')
    chat_history = data.get('chatHistory', None) or data.get('chat_history', None)

    if not message:
        return jsonify({
            'ok': False,
            'error': 'Message cannot be empty.'
        }), 400

    try:
        result = engine.answer_query(
            query=message,
            user_role=user_role,
            case_context=case_context,
            language=language,
            chat_history=chat_history,
            retry=bool(data.get('retry'))
        )
        if isinstance(result, tuple):
            response_text, lang_info = result
        else:
            response_text, lang_info = result, {"language_name": "Hindi/English"}

        return jsonify({
            'ok': True,
            'message': response_text,
            'detected_language': lang_info,
            'visual': lang_info.get('visual'),
            'sources': lang_info.get('sources', []),
            'validation': lang_info.get('validation', {})
        })
    except Exception as e:
        print(f"Chat error: {e}")
        return jsonify({
            'ok': False,
            'error': str(e)
        }), 500

@app.route('/api/ai/court', methods=['POST'])
def court():
    """
    Virtual Courtroom Simulator endpoint.
    Generates the next short courtroom turn from the actual case and completed transcript.
    """
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({'ok': False, 'error': 'Send a courtroom request as a JSON object.'}), 400
    case_summary = data.get('summary') or data.get('message') or ''
    if not isinstance(case_summary, str):
        return jsonify({'ok': False, 'error': 'Case summary must be text.'}), 400
    case_summary = case_summary.strip()
    category = data.get('category', None)
    language = data.get('language', 'auto')

    if not case_summary:
        return jsonify({
            'ok': False,
            'error': 'Case summary is required to simulate courtroom proceedings.'
        }), 400

    history = data.get('history') or data.get('chatHistory') or []
    if (not isinstance(history, list) or any(not isinstance(turn, dict) for turn in history) or
        not isinstance(language, str) or not isinstance(data.get('input', ''), str) or
        not isinstance(data.get('action', 'opening'), str) or
        data.get('courtType', 'DISTRICT') not in ('SUPREME', 'HIGH', 'DISTRICT') or
        data.get('examination') is not None and not isinstance(data['examination'], dict)):
        return jsonify({'ok': False, 'error': 'The courtroom request has invalid history, language, setting or witness context.'}), 400

    try:
        result = engine.simulate_courtroom(
            case_summary=case_summary,
            category=category,
            language=language,
            chat_history=history,
            court_type=data.get('courtType', 'DISTRICT'),
            action=data.get('action', 'opening'),
            user_input=str(data.get('input') or ''),
            role=data.get('role', 'user'),
            examination=data.get('examination')
        )
        if isinstance(result, dict):
            return jsonify({'ok': True, **result})
        if isinstance(result, tuple):
            simulation_text, lang_info = result
        else:
            simulation_text, lang_info = result, {"language_name": "Hindi/English"}

        return jsonify({
            'ok': True,
            'simulation': simulation_text,
            'detected_language': lang_info
        })
    except ValueError as e:
        return jsonify({'ok': False, 'error': str(e)}), 400
    except Exception as e:
        # Provider exception messages may contain a URL and credential. Log only the type.
        print(f"Court simulation error: {type(e).__name__}")
        retry_after = getattr(e, 'retry_after', 0)
        response = jsonify({'ok': False,
            'error': str(e) if isinstance(e, RuntimeError) else 'The courtroom response could not be prepared. Your hearing is saved; retry this turn.',
            'retryable': getattr(e, 'retryable', True), 'retry_after': retry_after})
        if retry_after:
            response.headers['Retry-After'] = str(retry_after)
        return response, getattr(e, 'status_code', 500)

@app.route('/api/ai/advocate/chat', methods=['POST'])
def advocate_chat():
    data = request.get_json(silent=True)
    if (not isinstance(data, dict) or not isinstance(data.get('message'), str)
            or not data['message'].strip() or len(data['message']) > 60000
            or not isinstance(data.get('language', 'auto'), str)
            or data.get('caseContext') is not None and not isinstance(data['caseContext'], str)):
        return jsonify(ok=False, error='Provide a case brief or follow-up as text (up to 60,000 characters).'), 400
    try:
        from advocate_engine import answer
        message, info = answer(engine, data['message'].strip(), data.get('caseContext'),
                               data.get('language', 'auto'), data.get('chatHistory'), bool(data.get('retry')))
        return jsonify(ok=True, message=message, sources=info['sources'], sections=info['sections'],
                       validation=info['validation'], detected_language=info, mode='advocate-ndps')
    except ValueError as error:
        return jsonify(ok=False, error=str(error)), 400
    except Exception as error:
        print('Advocate research error:', type(error).__name__)
        return jsonify(ok=False, error='Advocate research is temporarily unavailable. Your case brief is retained; retry this turn.'), 503


@app.route('/api/ai/advocate/rehearsal', methods=['POST'])
def advocate_rehearsal():
    data = request.get_json(silent=True)
    if not isinstance(data, dict) or not isinstance(data.get('submission', ''), str) or not isinstance(data.get('language', 'auto'), str):
        return jsonify(ok=False, error='Provide a valid hearing request.'), 400
    try:
        from advocate_engine import rehearse
        return jsonify(ok=True, **rehearse(engine, data))
    except ValueError as error:
        return jsonify(ok=False, error=str(error)), 400
    except Exception as error:
        print('Advocate rehearsal error:', type(error).__name__)
        return jsonify(ok=False, error='The hearing turn is unavailable. Your submission is retained; retry.'), 503


@app.route('/api/ai/advocate/documents', methods=['POST'])
def advocate_documents():
    file = request.files.get('file')
    if not file:
        return jsonify(ok=False, error='Choose a document to extract.'), 400
    try:
        from advocate_documents import extract, MAX_BYTES
        raw = file.read(MAX_BYTES + 1)
        file.close()
        return jsonify(ok=True, document=extract(file.filename or '', raw))
    except ValueError as error:
        return jsonify(ok=False, error=str(error)), 400
    except Exception:
        return jsonify(ok=False, error='This document could not be read. Provide an unlocked PDF, DOCX or UTF-8 text copy.'), 400


@app.route('/api/ai/tts', methods=['GET', 'POST'])
def tts():
    """
    High-fidelity Neural Text-to-Speech proxy endpoint.
    Streams natural audio for all Indian regional languages,
    bypassing CORS or missing local browser voices.
    """
    if request.method == 'POST':
        data = request.get_json() or {}
        text = data.get('text', '')
        lang = data.get('language', 'hi')
    else:
        text = request.args.get('text', '')
        lang = request.args.get('lang', 'hi')

    if not text:
        return jsonify({'ok': False, 'error': 'No text provided'}), 400

    try:
        import urllib.request
        import urllib.parse
        from flask import Response

        clean_text = text[:300].strip()
        encoded = urllib.parse.quote(clean_text)
        url = f"https://translate.google.com/translate_tts?ie=UTF-8&q={encoded}&tl={lang}&client=tw-ob"
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        with urllib.request.urlopen(req, timeout=8) as res:
            audio_data = res.read()

        resp = Response(audio_data, mimetype="audio/mpeg")
        resp.headers['Access-Control-Allow-Origin'] = '*'
        resp.headers['Cache-Control'] = 'public, max-age=86400'
        return resp
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    print(f"Nyay Setu AI Service running on http://127.0.0.1:{port}")
    app.run(host='0.0.0.0', port=port, debug=False)

