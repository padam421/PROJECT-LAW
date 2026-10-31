"""Manage Node and Gunicorn together in a single free web service.

The public port belongs only to Node. A failed child exits the whole service so
Render can restart it. SIGTERM drains Node first, then stops the internal AI.
"""
import os
import signal
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
children = []
stopping = False


def stop(signum=None, frame=None):
    global stopping
    if stopping:
        return
    stopping = True
    # Node gets time to finish requests and durably save before AI is stopped.
    for child in reversed(children):
        if child.poll() is None:
            child.terminate()
            try:
                child.wait(timeout=26 if child == children[-1] else 2)
            except subprocess.TimeoutExpired:
                child.kill()
                child.wait()


def main():
    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    ai = subprocess.Popen([sys.executable, '-m', 'gunicorn', '--bind', '127.0.0.1:5000',
        '--workers', '1', '--worker-class', 'gthread', '--threads', '3', '--timeout', '240',
        '--graceful-timeout', '2', '--chdir', str(ROOT / 'ai-service' / 'src'), 'app:app'])
    children.append(ai)
    for _ in range(90):
        if stopping or ai.poll() is not None:
            return 1
        try:
            with urllib.request.urlopen('http://127.0.0.1:5000/api/ai/health', timeout=2) as response:
                if response.status == 200:
                    break
        except Exception:
            time.sleep(1)
    else:
        print('AI did not become ready. Check provider configuration and the search index.', flush=True)
        return 1
    children.append(subprocess.Popen(['node', str(ROOT / 'backend' / 'src' / 'server.js')], cwd=ROOT))
    while not stopping:
        if any(child.poll() is not None for child in children):
            print('A required process exited; restarting the service is necessary.', flush=True)
            return 1
        time.sleep(0.5)
    return 0


if __name__ == '__main__':
    try:
        code = main()
    finally:
        stop()
    sys.exit(code)
