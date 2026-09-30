#!/usr/bin/env python3
"""Local server for the app: like `python3 -m http.server`, but tells browsers
not to cache, so a reload always picks up edited files (Safari on iPad included).

Usage: python3 serve.py [port]   (default 8000)
"""
import http.server
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
print(f"Serving on http://localhost:{port}")
http.server.ThreadingHTTPServer(("", port), NoCacheHandler).serve_forever()
