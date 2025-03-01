// Initialize default settings if not already set
chrome.runtime.onInstalled.addListener(function() {
    chrome.storage.local.get(['settings'], function(result) {
        if (!result.settings) {
            chrome.storage.local.set({
                settings: {
                    serverUrl: 'http://localhost:11434',
                    model: 'llama2',
                    enableStreaming: true // Add streaming option
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
                model: 'llama2',
                enableStreaming: true
            };
            
            if (settings.enableStreaming) {
                // Handle streaming response
                handleStreamingRequest(settings, request, sendResponse);
            } else {
                // Send to Ollama for processing (non-streaming)
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
                            result: response.data.response,
                            done: true
                        });
                    } else {
                        sendResponse({ 
                            success: false, 
                            error: `Server returned ${response.status}: ${response.statusText}`,
                            done: true
                        });
                    }
                })
                .catch(error => {
                    console.error('Grammar check error:', error);
                    sendResponse({ 
                        success: false, 
                        error: error.message || 'Unknown error occurred',
                        done: true
                    });
                });
            }
        });
        
        return true; // Required for async sendResponse
    } else if (request.action === 'cancelStream') {
        // Handle cancellation of streaming requests
        console.log('Stream cancellation requested');
        // Implement cancellation logic here
        return true;
    }
});

// Function to handle streaming requests
async function handleStreamingRequest(settings, request, sendResponse) {
    try {
        console.log('Starting streaming request');
        
        const response = await fetch(`${settings.serverUrl}/api/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: settings.model,
                prompt: request.prompt,
                stream: true
            })
        });
        
        if (!response.ok) {
            throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        }
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';
        
        // Send initial response to indicate streaming has started
        sendResponse({
            success: true,
            streaming: true,
            result: '',
            done: false
        });
        
        // Process the stream
        while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
                // Final response when stream is complete
                chrome.tabs.sendMessage(request.tabId, {
                    action: 'streamUpdate',
                    success: true,
                    result: fullText,
                    done: true
                });
                break;
            }
            
            // Decode the chunk
            const chunk = decoder.decode(value, { stream: true });
            
            // Process the chunk (each chunk may contain multiple JSON objects)
            const lines = chunk.split('\n').filter(line => line.trim());
            
            for (const line of lines) {
                try {
                    const data = JSON.parse(line);
                    if (data.response) {
                        fullText += data.response;
                        
                        // Send incremental update
                        chrome.tabs.sendMessage(request.tabId, {
                            action: 'streamUpdate',
                            success: true,
                            result: fullText,
                            done: false
                        });
                    }
                } catch (e) {
                    console.error('Error parsing JSON:', e, line);
                }
            }
        }
    } catch (error) {
        console.error('Streaming error:', error);
        chrome.tabs.sendMessage(request.tabId, {
            action: 'streamUpdate',
            success: false,
            error: error.message || 'Unknown error occurred',
            done: true
        });
    }
}

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