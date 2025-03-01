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

// Listen for messages from the popup and content scripts
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    console.log('Background script received message:', request);
    
    if (request.action === 'checkServerStatus') {
        checkOllamaServer(request.serverUrl)
            .then(status => {
                console.log('Server status check result:', status);
                sendResponse({ status: status });
            })
            .catch(error => {
                console.error('Server status check error:', error);
                sendResponse({ status: 'offline', error: error.message });
            });
        return true; // Required for async sendResponse
    } else if (request.action === 'proxyOllamaRequest') {
        // Proxy requests to Ollama server to avoid CORS issues
        console.log('Proxying request to:', request.url, 'Method:', request.method);
        
        proxyOllamaRequest(request.url, request.method, request.body)
            .then(response => {
                console.log('Proxy response:', response);
                sendResponse({ success: true, data: response });
            })
            .catch(error => {
                console.error('Proxy error:', error);
                sendResponse({ success: false, error: error.message });
            });
        return true; // Required for async sendResponse
    } else if (request.action === 'grammarCheck') {
        // Handle grammar check requests from content script
        console.log('Grammar check request received:', request.mode);
        
        // Get settings
        chrome.storage.local.get(['settings'], function(result) {
            const settings = result.settings || {
                serverUrl: 'http://localhost:11434',
                model: 'llama2'
            };
            
            // Send to Ollama for processing
            proxyOllamaRequest(
                `${settings.serverUrl}/api/generate`,
                'POST',
                {
                    model: settings.model,
                    prompt: request.prompt,
                    stream: false
                }
            )
            .then(response => {
                console.log('Grammar check response:', response);
                if (response.status === 200) {
                    sendResponse({ 
                        success: true, 
                        result: response.data.response 
                    });
                } else {
                    sendResponse({ 
                        success: false, 
                        error: `Server returned ${response.status}: ${response.statusText}` 
                    });
                }
            })
            .catch(error => {
                console.error('Grammar check error:', error);
                sendResponse({ 
                    success: false, 
                    error: error.message || 'Unknown error occurred' 
                });
            });
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
        console.log('Starting proxy request to:', url);
        
        const options = {
            method: method || 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        };
        
        if (body && (method === 'POST' || method === 'PUT')) {
            options.body = JSON.stringify(body);
            console.log('Request body:', options.body);
        }
        
        console.log('Fetch options:', options);
        
        const response = await fetch(url, options);
        console.log('Response received:', response.status, response.statusText);
        
        // Handle different response types
        const contentType = response.headers.get('content-type');
        console.log('Response content type:', contentType);
        
        if (contentType && contentType.includes('application/json')) {
            console.log('Processing as JSON response');
            const jsonResponse = await response.json();
            console.log('JSON response data:', jsonResponse);
            return {
                status: response.status,
                statusText: response.statusText,
                data: jsonResponse
            };
        } else {
            console.log('Processing as text response');
            const textResponse = await response.text();
            console.log('Text response data:', textResponse.substring(0, 100) + (textResponse.length > 100 ? '...' : ''));
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