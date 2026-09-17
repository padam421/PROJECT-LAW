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

from flask import Flask, request, jsonify
from flask_cors import CORS
from rag_engine import get_rag_engine

app = Flask(__name__)
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
        "gemini_model": "gemini-3.5-flash-lite"
    })

@app.route('/api/ai/chat', methods=['POST'])
def chat():
    """
    RAG Chat endpoint for both User and Advocate portals.
    Zero-hallucination, strictly grounded in Supreme Court precedents.
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
            chat_history=chat_history
        )
        if isinstance(result, tuple):
            response_text, lang_info = result
        else:
            response_text, lang_info = result, {"language_name": "Hindi/English"}

        return jsonify({
            'ok': True,
            'message': response_text,
            'detected_language': lang_info
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
    Generates 3-4 scenarios and multi-agent arguments (Judge, Advocate, Opponent).
    """
    data = request.get_json() or {}
    case_summary = data.get('summary') or data.get('message', '').strip()
    category = data.get('category', None)
    language = data.get('language', 'auto')

    if not case_summary:
        return jsonify({
            'ok': False,
            'error': 'Case summary is required to simulate courtroom proceedings.'
        }), 400

    try:
        result = engine.simulate_courtroom(
            case_summary=case_summary,
            category=category,
            language=language
        )
        if isinstance(result, tuple):
            simulation_text, lang_info = result
        else:
            simulation_text, lang_info = result, {"language_name": "Hindi/English"}

        return jsonify({
            'ok': True,
            'simulation': simulation_text,
            'detected_language': lang_info
        })
    except Exception as e:
        print(f"Court simulation error: {e}")
        return jsonify({
            'ok': False,
            'error': str(e)
        }), 500

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

