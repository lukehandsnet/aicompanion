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
    
    // Add the sender tab ID to the request object for later use
    if (sender && sender.tab && sender.tab.id) {
        request.senderTabId = sender.tab.id;
    }
    
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
                if (request.senderTabId) {
                    chrome.tabs.sendMessage(request.senderTabId, {
                        action: 'streamUpdate',
                        success: true,
                        result: fullText,
                        mode: request.mode_original,
                        done: true
                    });
                } else {
                    console.error('No valid tab ID to send message to');
                }
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
                        if (request.senderTabId) {
                            chrome.tabs.sendMessage(request.senderTabId, {
                                action: 'streamUpdate',
                                success: true,
                                result: fullText,
                                mode: request.mode_original,
                                done: false
                            });
                        }
                    }
                } catch (e) {
                    console.error('Error parsing JSON:', e, line);
                }
            }
        }
    } catch (error) {
        console.error('Streaming error:', error);
        if (request.senderTabId) {
            chrome.tabs.sendMessage(request.senderTabId, {
                action: 'streamUpdate',
                success: false,
                error: error.message || 'Unknown error occurred',
                done: true
            });
        }
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
        
        // Check if URL is valid
        if (!url || !url.startsWith('http')) {
            throw new Error(`Invalid URL: ${url}`);
        }
        
        const options = {
            method: method || 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        };
        
        if (body && (method === 'POST' || method === 'PUT')) {
            options.body = JSON.stringify(body);
            console.log('Request body type:', typeof body);
            console.log('Request body:', options.body);
            
            // Validate model parameter for generate requests
            if (url.includes('/api/generate') && (!body.model || typeof body.model !== 'string')) {
                console.error('Invalid or missing model parameter:', body.model);
            }
        }
        
        console.log('Fetch options:', options);
        
        try {
            const response = await fetch(url, options);
            console.log('Response received:', response.status, response.statusText);
            
            // Handle different response types
            const contentType = response.headers.get('content-type');
            console.log('Response content type:', contentType);
            
            // Special handling for Ollama's streaming response format (NDJSON)
            if (contentType && (contentType.includes('application/json') || contentType.includes('application/x-ndjson'))) {
                console.log('Processing as JSON response');
                try {
                    // For generate API with non-streaming mode
                    if (url.includes('/api/generate') && !body.stream) {
                        const jsonResponse = await response.json();
                        console.log('JSON response data:', jsonResponse);
                        return {
                            status: response.status,
                            statusText: response.statusText,
                            data: jsonResponse
                        };
                    } 
                    // For streaming responses or NDJSON format, we need to handle differently
                    else if (contentType.includes('application/x-ndjson') || body.stream) {
                        const textResponse = await response.text();
                        console.log('NDJSON response data:', textResponse.substring(0, 100) + (textResponse.length > 100 ? '...' : ''));
                        
                        // For summarization, we need to extract the full response from the NDJSON
                        // NDJSON format is multiple JSON objects separated by newlines
                        const lines = textResponse.split('\n').filter(line => line.trim());
                        let fullResponse = '';
                        
                        for (const line of lines) {
                            try {
                                const data = JSON.parse(line);
                                if (data.response) {
                                    fullResponse += data.response;
                                }
                            } catch (e) {
                                console.error('Error parsing NDJSON line:', e, line);
                            }
                        }
                        
                        console.log('Extracted full response from NDJSON:', fullResponse.substring(0, 100) + (fullResponse.length > 100 ? '...' : ''));
                        
                        // Return in a format that popup.js expects
                        return {
                            status: response.status,
                            statusText: response.statusText,
                            data: {
                                response: fullResponse
                            }
                        };
                    } else {
                        const jsonResponse = await response.json();
                        console.log('JSON response data:', jsonResponse);
                        return {
                            status: response.status,
                            statusText: response.statusText,
                            data: jsonResponse
                        };
                    }
                } catch (jsonError) {
                    console.error('Error parsing JSON response:', jsonError);
                    const textFallback = await response.text();
                    console.log('Response as text (fallback):', textFallback.substring(0, 100) + (textFallback.length > 100 ? '...' : ''));
                    throw new Error(`Failed to parse JSON response: ${jsonError.message}`);
                }
            } else {
                console.log('Processing as text response');
                const textResponse = await response.text();
                console.log('Text response data:', textResponse.substring(0, 100) + (textResponse.length > 100 ? '...' : ''));
                
                // Try to parse as JSON anyway in case content-type is wrong
                try {
                    if (textResponse.trim().startsWith('{') && textResponse.trim().endsWith('}')) {
                        const jsonData = JSON.parse(textResponse);
                        console.log('Successfully parsed text as JSON:', jsonData);
                        return {
                            status: response.status,
                            statusText: response.statusText,
                            data: jsonData
                        };
                    } else if (textResponse.includes('\n')) {
                        // This might be NDJSON format
                        const lines = textResponse.split('\n').filter(line => line.trim());
                        let fullResponse = '';
                        
                        for (const line of lines) {
                            try {
                                if (line.trim()) {
                                    const data = JSON.parse(line);
                                    if (data.response) {
                                        fullResponse += data.response;
                                    }
                                }
                            } catch (e) {
                                console.error('Error parsing potential NDJSON line:', e, line);
                            }
                        }
                        
                        if (fullResponse) {
                            console.log('Extracted response from text as NDJSON:', fullResponse.substring(0, 100) + (fullResponse.length > 100 ? '...' : ''));
                            return {
                                status: response.status,
                                statusText: response.statusText,
                                data: {
                                    response: fullResponse
                                }
                            };
                        }
                    }
                    
                    // Not JSON or NDJSON, return as text
                    return {
                        status: response.status,
                        statusText: response.statusText,
                        data: textResponse
                    };
                } catch (e) {
                    // Not JSON, return as text
                    return {
                        status: response.status,
                        statusText: response.statusText,
                        data: textResponse
                    };
                }
            }
        } catch (fetchError) {
            console.error('Fetch error:', fetchError);
            throw new Error(`Network error: ${fetchError.message}`);
        }
    } catch (error) {
        console.error('Error proxying request to Ollama server:', error);
        throw error;
    }
}