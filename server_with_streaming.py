import http.server
import socketserver
import os

PORT = 51730  # Use the port provided in the runtime information

class CORSHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

Handler = CORSHTTPRequestHandler

print(f"Starting server at http://localhost:{PORT}")
print(f"You can test streaming at http://localhost:{PORT}/test_ollama_streaming.html")

with socketserver.TCPServer(("0.0.0.0", PORT), Handler) as httpd:
    print(f"Serving at http://localhost:{PORT}")
    httpd.serve_forever()