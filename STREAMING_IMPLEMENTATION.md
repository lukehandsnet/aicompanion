# Implementing Streaming Responses in AI Companion

This document explains how to implement streaming responses from Ollama in the AI Companion extension.

## Overview

Streaming responses provide a more interactive experience by showing the AI's response as it's being generated, rather than waiting for the complete response. This implementation uses Ollama's streaming API capability.

## Files Modified/Added

1. **test_ollama_streaming.html** - A test page to demonstrate streaming responses
2. **background_with_streaming.js** - Modified background script with streaming support
3. **content-script_with_streaming.js** - Modified content script with streaming support
4. **popup_with_streaming.js** - Modified popup script with streaming support
5. **popup_with_streaming.html** - Modified popup HTML with streaming toggle
6. **server_with_streaming.py** - Modified server script for testing

## How Streaming Works

1. **Ollama API**: When making a request to Ollama's `/api/generate` endpoint, setting `stream: true` in the request body enables streaming. The response is sent as a series of JSON objects, each containing a piece of the full response.

2. **Handling Streaming Responses**:
   - Use `fetch` with a reader to process the stream
   - Parse each chunk as it arrives
   - Update the UI incrementally with each piece of the response

## Implementation Details

### 1. In the Background Script

```javascript
// Example of streaming implementation in background.js
async function handleStreamingRequest(settings, request, sendResponse) {
    try {
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
        
        // Send initial response
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
                // Final update when stream is complete
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
```

### 2. In the Content Script

```javascript
// Example of handling streaming updates in content-script.js
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    if (message.action === 'streamUpdate') {
        if (message.success) {
            // Update the UI with the latest streaming content
            updateResultUI(message.result, null, message.done);
        } else {
            // Show error
            showErrorInPopup(message.error || 'Unknown error occurred');
        }
    }
    return true;
});

// Update the result UI with streaming content
function updateResultUI(result, mode, isDone = false) {
    if (!currentStreamingPopup || !document.getElementById('ai-companion-streaming-popup')) {
        return; // Popup was closed
    }
    
    const contentElement = document.getElementById('ai-companion-result-content');
    
    // Update content
    contentElement.textContent = result;
    
    // If it's done, show the action buttons
    if (isDone) {
        document.getElementById('ai-companion-loading').style.display = 'none';
        contentElement.style.display = 'block';
        document.getElementById('ai-companion-result-actions').style.display = 'flex';
    }
}
```

### 3. In the Popup Script

```javascript
// Example of streaming implementation in popup.js
function handleStreamingResponse(message, typingIndicator) {
    // Create a message element for the streaming response
    const aiTimestamp = new Date().toLocaleTimeString();
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message ai-message';
    
    const messageText = document.createElement('div');
    messageText.className = 'message-text streaming-response';
    
    messageDiv.appendChild(messageText);
    
    // Remove typing indicator and add the streaming message
    if (typingIndicator) {
        chatContainer.removeChild(typingIndicator);
    }
    chatContainer.appendChild(messageDiv);
    
    // Start the streaming request
    let fullResponse = '';
    
    fetch(`${settings.serverUrl}/api/generate`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: settings.model,
            prompt: message,
            stream: true
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        }
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        
        function readStream() {
            return reader.read().then(({ done, value }) => {
                if (done) {
                    // Save to chat history when stream is complete
                    saveChatMessage('ai', fullResponse, aiTimestamp);
                    return;
                }
                
                // Decode the chunk
                const chunk = decoder.decode(value, { stream: true });
                
                // Process the chunk
                const lines = chunk.split('\n').filter(line => line.trim());
                
                for (const line of lines) {
                    try {
                        const data = JSON.parse(line);
                        if (data.response) {
                            fullResponse += data.response;
                            // Update the message text with the current full response
                            messageText.textContent = fullResponse;
                            scrollToBottom();
                        }
                    } catch (e) {
                        console.error('Error parsing JSON:', e, line);
                    }
                }
                
                // Continue reading the stream
                return readStream();
            });
        }
        
        return readStream();
    })
    .catch(error => {
        console.error('Streaming error:', error);
        messageText.innerHTML = `<span style="color: #721c24;">Error: ${error.message}</span>`;
    });
}
```

## How to Test

1. Run the server: `python server_with_streaming.py`
2. Open the test page: http://localhost:51730/test_ollama_streaming.html
3. Enter your Ollama server URL (default: http://localhost:11434)
4. Click "Test Connection" to verify the connection and load available models
5. Enter a prompt and click "Send" to see the streaming response

## How to Integrate into the Extension

1. Replace the existing files with the modified versions:
   - Replace `background.js` with `background_with_streaming.js`
   - Replace `content-script.js` with `content-script_with_streaming.js`
   - Replace `popup.js` with `popup_with_streaming.js`
   - Replace `popup.html` with `popup_with_streaming.html`

2. Update the manifest.json to reference the new files if needed

3. Test the extension to ensure streaming works correctly

## Benefits of Streaming

1. **Improved User Experience**: Users see responses as they're generated, providing immediate feedback
2. **Faster Perceived Response Time**: Even though the total time is the same, users perceive the response as faster
3. **Interactive Feel**: Creates a more conversational, interactive experience

## Considerations

1. **Error Handling**: Streaming requires more robust error handling for connection issues
2. **UI Updates**: The UI must be designed to handle incremental updates smoothly
3. **Cancellation**: Users should be able to cancel a streaming response in progress