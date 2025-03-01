import http.server
import socketserver
import os
import argparse
import json
import threading
import time
from urllib.parse import urlparse, parse_qs

# Parse command line arguments
parser = argparse.ArgumentParser(description='Start a mock Ollama server with CORS support')
parser.add_argument('--port', type=int, default=11434, help='Port to run the server on')
parser.add_argument('--host', type=str, default='0.0.0.0', help='Host to run the server on')
parser.add_argument('--allow-cors', action='store_true', help='Allow CORS')
parser.add_argument('--allow-iframe', action='store_true', help='Allow iframes')

args = parser.parse_args()
PORT = args.port

class MockOllamaHandler(http.server.BaseHTTPRequestHandler):
    def _set_headers(self, content_type='application/json'):
        self.send_response(200)
        self.send_header('Content-Type', content_type)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        if args.allow_iframe:
            self.send_header('X-Frame-Options', 'ALLOWALL')
        self.end_headers()

    def do_OPTIONS(self):
        self._set_headers()

    def do_GET(self):
        parsed_path = urlparse(self.path)
        
        if parsed_path.path == '/api/tags':
            # Mock response for /api/tags endpoint
            self._set_headers()
            response = {
                "models": [
                    {"name": "llama2", "modified_at": "2023-11-04T12:37:36.269425Z", "size": 3791730298},
                    {"name": "mistral", "modified_at": "2023-11-04T12:38:36.269425Z", "size": 4791730298},
                    {"name": "gemma", "modified_at": "2023-11-04T12:39:36.269425Z", "size": 2791730298}
                ]
            }
            self.wfile.write(json.dumps(response).encode())
        else:
            # Default response for unknown endpoints
            self._set_headers()
            self.wfile.write(json.dumps({"error": "Endpoint not found"}).encode())

    def do_POST(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        
        try:
            request_json = json.loads(post_data.decode('utf-8'))
        except json.JSONDecodeError:
            request_json = {}
        
        parsed_path = urlparse(self.path)
        
        if parsed_path.path == '/api/generate':
            # Mock response for /api/generate endpoint
            prompt = request_json.get('prompt', '')
            model = request_json.get('model', 'llama2')
            stream = request_json.get('stream', False)
            
            if stream:
                self._set_headers('application/x-ndjson')
                
                # Generate a streaming response
                response_text = f"This is a mock response to: {prompt}"
                words = response_text.split()
                
                for word in words:
                    chunk = {"response": word + " ", "model": model}
                    self.wfile.write(json.dumps(chunk).encode() + b'\n')
                    self.wfile.flush()
                    time.sleep(0.1)  # Simulate delay between chunks
                
                # Final chunk
                self.wfile.write(json.dumps({"done": True}).encode() + b'\n')
            else:
                self._set_headers()
                response = {
                    "model": model,
                    "response": f"This is a mock response to: {prompt}",
                    "done": True
                }
                self.wfile.write(json.dumps(response).encode())
        else:
            # Default response for unknown endpoints
            self._set_headers()
            self.wfile.write(json.dumps({"error": "Endpoint not found"}).encode())

# Create and start the server
handler = MockOllamaHandler
httpd = socketserver.ThreadingTCPServer((args.host, PORT), handler)
print(f"Mock Ollama server running at http://{args.host}:{PORT}")
httpd.serve_forever()