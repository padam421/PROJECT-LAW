"""Read-only public URL checks. Does not register users or spend AI quota."""
import argparse
import json
import urllib.error
import urllib.request


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('url', help='The actual HTTPS service URL returned by Render')
    args = parser.parse_args()
    base = args.url.rstrip('/')
    if not base.startswith('https://'):
        parser.error('Use the public HTTPS URL.')
    failed = False
    for path, expected, method in [('/api/health', 200, 'GET'), ('/api/ready', 200, 'GET'),
            ('/api/ai/health', 200, 'GET'), ('/frontend/index.html', 200, 'GET'),
            ('/frontend/user/index.html', 200, 'GET'), ('/frontend/lawyer/index.html', 200, 'GET'),
            ('/admin', 200, 'GET'), ('/api/auth/session', 401, 'GET'), ('/api/ai/chat', 401, 'POST')]:
        try:
            request = urllib.request.Request(base + path, method=method,
                data=b'{}' if method == 'POST' else None,
                headers={'Content-Type': 'application/json'})
            with urllib.request.urlopen(request, timeout=90) as response:
                code = response.status
        except urllib.error.HTTPError as error:
            code = error.code
        except Exception as error:
            code = type(error).__name__
        ok = code == expected
        failed |= not ok
        print(json.dumps({'path': path, 'status': code, 'expected': expected, 'pass': ok}))
    raise SystemExit(1 if failed else 0)


if __name__ == '__main__':
    main()
