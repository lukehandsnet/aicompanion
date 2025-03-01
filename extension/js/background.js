// Initialize default settings if not already set
chrome.runtime.onInstalled.addListener(function() {
    chrome.storage.local.get(['settings'], function(result) {
        if (!result.settings) {
            chrome.storage.local.set({
                settings: {
                    serverUrl: 'http://localhost:11434',
                    model: 'llama2'
                }
            });
        }
    });
});

// Listen for messages from the popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'checkServerStatus') {
        checkOllamaServer(request.serverUrl)
            .then(status => {
                sendResponse({ status: status });
            })
            .catch(error => {
                sendResponse({ status: 'offline', error: error.message });
            });
        return true; // Required for async sendResponse
    } else if (request.action === 'proxyOllamaRequest') {
        // Proxy requests to Ollama server to avoid CORS issues
        proxyOllamaRequest(request.url, request.method, request.body)
            .then(response => {
                sendResponse({ success: true, data: response });
            })
            .catch(error => {
                sendResponse({ success: false, error: error.message });
            });
        return true; // Required for async sendResponse
    }
});

// Function to check Ollama server status
async function checkOllamaServer(serverUrl) {
    try {
        const response = await fetch(`${serverUrl}/api/tags`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        if (response.ok) {
            return 'online';
        } else {
            return 'offline';
        }
    } catch (error) {
        console.error('Error checking Ollama server:', error);
        return 'offline';
    }
}

// Function to proxy requests to Ollama server
async function proxyOllamaRequest(url, method, body) {
    try {
        const options = {
            method: method || 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        };
        
        if (body && (method === 'POST' || method === 'PUT')) {
            options.body = JSON.stringify(body);
        }
        
        const response = await fetch(url, options);
        
        // Handle different response types
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            const jsonResponse = await response.json();
            return {
                status: response.status,
                statusText: response.statusText,
                data: jsonResponse
            };
        } else {
            const textResponse = await response.text();
            return {
                status: response.status,
                statusText: response.statusText,
                data: textResponse
            };
        }
    } catch (error) {
        console.error('Error proxying request to Ollama server:', error);
        throw error;
    }
}