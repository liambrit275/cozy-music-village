#!/usr/bin/env python3
"""
Game server with file-based save persistence.
Serves static files AND a /api/save endpoint that stores user data as JSON files.

Usage:
    python3 server.py [port]
    # Default port: 8080
    # Then open http://localhost:8080
"""

import http.server
import json
import os
import sys
import urllib.parse

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
SAVE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'saves')

# Ensure saves directory exists
os.makedirs(SAVE_DIR, exist_ok=True)


class GameHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)

        # GET /api/save?key=<key> — load a save
        if parsed.path == '/api/save':
            params = urllib.parse.parse_qs(parsed.query)
            key = params.get('key', [None])[0]
            if not key or not self._safe_key(key):
                self._json_response(400, {'error': 'Invalid key'})
                return

            filepath = os.path.join(SAVE_DIR, f'{key}.json')
            if os.path.exists(filepath):
                with open(filepath, 'r') as f:
                    data = f.read()
                self._raw_json_response(200, data)
            else:
                self._json_response(404, {'error': 'Not found'})
            return

        # GET /api/saves — list all save keys
        if parsed.path == '/api/saves':
            keys = []
            for fname in os.listdir(SAVE_DIR):
                if fname.endswith('.json'):
                    keys.append(fname[:-5])  # strip .json
            self._json_response(200, {'keys': keys})
            return

        # Static file serving
        super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)

        # POST /api/save — save data
        if parsed.path == '/api/save':
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode('utf-8')
            try:
                payload = json.loads(body)
            except json.JSONDecodeError:
                self._json_response(400, {'error': 'Invalid JSON'})
                return

            key = payload.get('key')
            data = payload.get('data')
            if not key or not self._safe_key(key) or data is None:
                self._json_response(400, {'error': 'Missing key or data'})
                return

            filepath = os.path.join(SAVE_DIR, f'{key}.json')
            with open(filepath, 'w') as f:
                json.dump(data, f, indent=2)

            self._json_response(200, {'ok': True, 'key': key})
            return

        # POST /api/delete — delete a save
        if parsed.path == '/api/delete':
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode('utf-8')
            try:
                payload = json.loads(body)
            except json.JSONDecodeError:
                self._json_response(400, {'error': 'Invalid JSON'})
                return

            key = payload.get('key')
            if not key or not self._safe_key(key):
                self._json_response(400, {'error': 'Invalid key'})
                return

            filepath = os.path.join(SAVE_DIR, f'{key}.json')
            if os.path.exists(filepath):
                os.remove(filepath)
            self._json_response(200, {'ok': True})
            return

        self._json_response(404, {'error': 'Not found'})

    def _safe_key(self, key):
        """Only allow alphanumeric, hyphens, underscores."""
        return all(c.isalnum() or c in '-_' for c in key) and len(key) < 100

    def _json_response(self, status, data):
        body = json.dumps(data).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', len(body))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(body)

    def _raw_json_response(self, status, raw_json_str):
        body = raw_json_str.encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', len(body))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        """Handle CORS preflight."""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def log_message(self, format, *args):
        # Only log API calls, not static file requests
        if '/api/' in (args[0] if args else ''):
            super().log_message(format, *args)


if __name__ == '__main__':
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    server = http.server.HTTPServer(('', PORT), GameHandler)
    print(f'Game server running at http://localhost:{PORT}')
    print(f'Saves directory: {SAVE_DIR}')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nServer stopped.')
