import http.server
import socketserver
import os
import argparse

# Parse command line arguments
parser = argparse.ArgumentParser(description='Start a simple HTTP server with CORS support')
parser.add_argument('--port', type=int, default=54468, help='Port to run the server on')
parser.add_argument('--host', type=str, default='localhost', help='Host to run the server on')
parser.add_argument('--allow-cors', action='store_true', help='Allow CORS')
parser.add_argument('--allow-iframe', action='store_true', help='Allow iframes')

args = parser.parse_args()
PORT = args.port

class CORSHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        if args.allow_iframe:
            self.send_header('X-Frame-Options', 'ALLOWALL')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

Handler = CORSHTTPRequestHandler

host = args.host if args.host else 'localhost'
with socketserver.TCPServer((host, PORT), Handler) as httpd:
    print(f"Serving at http://{host}:{PORT}")
    httpd.serve_forever()