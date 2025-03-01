document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const chatContainer = document.getElementById('chatContainer');
    const userInput = document.getElementById('userInput');
    const sendButton = document.getElementById('sendButton');
    const summarizeButton = document.getElementById('summarizeButton');
    const contextualQAButton = document.getElementById('contextualQAButton');
    const settingsButton = document.getElementById('settingsButton');
    const settingsPanel = document.getElementById('settingsPanel');
    const saveSettingsButton = document.getElementById('saveSettings');
    const serverUrlInput = document.getElementById('serverUrl');
    const modelSelect = document.getElementById('modelSelect');
    const refreshModelsButton = document.getElementById('refreshModels');
    const statusIndicator = document.getElementById('statusIndicator');
    const statusText = document.getElementById('statusText');
    const streamingToggle = document.getElementById('streamingToggle');
    
    // Debug mode - can be enabled by typing "debug:on" in the chat
    let debugMode = false;
    
    // Default settings
    let settings = {
        serverUrl: 'http://localhost:11434',
        model: 'llama2',
        enableStreaming: true
    };

    // Load settings from storage
    chrome.storage.local.get(['settings'], function(result) {
        if (result.settings) {
            settings = result.settings;
            serverUrlInput.value = settings.serverUrl;
            modelSelect.value = settings.model;
            if (streamingToggle) {
                streamingToggle.checked = settings.enableStreaming !== false;
            }
        } else {
            serverUrlInput.value = settings.serverUrl;
            if (streamingToggle) {
                streamingToggle.checked = true;
            }
        }
        
        // Check connection to Ollama server
        checkServerConnection();
    });

    // Load chat history
    chrome.storage.local.get(['chatHistory'], function(result) {
        if (result.chatHistory) {
            result.chatHistory.forEach(message => {
                appendMessage(message.sender, message.text, message.timestamp);
            });
            scrollToBottom();
        }
    });

    // Event Listeners
    settingsButton.addEventListener('click', toggleSettings);
    saveSettingsButton.addEventListener('click', saveSettings);
    sendButton.addEventListener('click', sendMessage);
    summarizeButton.addEventListener('click', summarizeCurrentPage);
    contextualQAButton.addEventListener('click', startContextualQA);
    refreshModelsButton.addEventListener('click', fetchAvailableModels);
    
    userInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Auto-resize textarea
    userInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });

    // Functions
    function toggleSettings() {
        if (settingsPanel.style.display === 'flex') {
            settingsPanel.style.display = 'none';
        } else {
            settingsPanel.style.display = 'flex';
        }
    }

    function saveSettings() {
        settings.serverUrl = serverUrlInput.value.trim();
        settings.model = modelSelect.value;
        if (streamingToggle) {
            settings.enableStreaming = streamingToggle.checked;
        }
        
        chrome.storage.local.set({ settings: settings }, function() {
            checkServerConnection();
            settingsPanel.style.display = 'none';
        });
    }

    function checkServerConnection() {
        updateStatus('connecting', 'Connecting...');
        
        // Use the background script to proxy the request to avoid CORS issues
        chrome.runtime.sendMessage({
            action: 'proxyOllamaRequest',
            url: `${settings.serverUrl}/api/tags`,
            method: 'GET'
        }, function(response) {
            if (response.success) {
                // Check if the response was successful
                if (response.data.status === 200) {
                    updateStatus('online', 'Connected');
                    
                    // Parse the response data
                    let data;
                    try {
                        data = typeof response.data.data === 'string' 
                            ? JSON.parse(response.data.data) 
                            : response.data.data;
                        
                        populateModelSelect(data.models);
                    } catch (e) {
                        console.error('Error parsing model data:', e);
                        updateStatus('online', 'Connected (Error parsing models)');
                    }
                } else {
                    // Handle error response from the server
                    console.error('Error connecting to Ollama server:', response.data);
                    
                    let statusMessage = `Error: ${response.data.status}`;
                    if (response.data.status === 403) {
                        statusMessage = 'Access forbidden';
                    } else if (response.data.status === 404) {
                        statusMessage = 'API not found';
                    } else if (response.data.status >= 500) {
                        statusMessage = 'Server error';
                    }
                    
                    updateStatus('offline', statusMessage);
                }
            } else {
                // Handle error in the proxy request
                console.error('Error connecting to Ollama server:', response.error);
                updateStatus('offline', 'Cannot reach server');
            }
        });
    }

    function updateStatus(status, message) {
        statusIndicator.className = 'status-indicator ' + status;
        statusText.textContent = message;
    }

    function fetchAvailableModels() {
        updateStatus('connecting', 'Fetching models...');
        
        // Use the background script to proxy the request to avoid CORS issues
        chrome.runtime.sendMessage({
            action: 'proxyOllamaRequest',
            url: `${settings.serverUrl}/api/tags`,
            method: 'GET'
        }, function(response) {
            if (response.success) {
                // Check if the response was successful
                if (response.data.status === 200) {
                    // Parse the response data
                    let data;
                    try {
                        data = typeof response.data.data === 'string' 
                            ? JSON.parse(response.data.data) 
                            : response.data.data;
                        
                        if (data.models && data.models.length > 0) {
                            populateModelSelect(data.models);
                            updateStatus('online', `Found ${data.models.length} models`);
                        } else {
                            populateModelSelect([]);
                            updateStatus('online', 'No models found. Pull models using Ollama CLI');
                        }
                    } catch (e) {
                        console.error('Error parsing model data:', e);
                        updateStatus('online', 'Error parsing models');
                    }
                } else {
                    // Handle error response from the server
                    console.error('Error fetching models:', response.data);
                    
                    let statusMessage = `Error: ${response.data.status}`;
                    if (response.data.status === 403) {
                        statusMessage = 'Access forbidden';
                    } else if (response.data.status === 404) {
                        statusMessage = 'API not found';
                    } else if (response.data.status >= 500) {
                        statusMessage = 'Server error';
                    }
                    
                    updateStatus('offline', statusMessage);
                }
            } else {
                // Handle error in the proxy request
                console.error('Error fetching models:', response.error);
                updateStatus('offline', 'Cannot reach server');
            }
        });
    }

    function populateModelSelect(models) {
        // Clear existing options
        modelSelect.innerHTML = '';
        
        // Add available models
        if (models && models.length > 0) {
            models.forEach(model => {
                const option = document.createElement('option');
                option.value = model.name;
                option.textContent = model.name;
                modelSelect.appendChild(option);
            });
            
            // Set the current model if it exists in the list, otherwise use the first model
            const modelExists = Array.from(modelSelect.options).some(option => option.value === settings.model);
            modelSelect.value = modelExists ? settings.model : modelSelect.options[0].value;
        } else {
            // Add default options if no models are available
            const defaultModels = ['llama2', 'mistral', 'gemma'];
            defaultModels.forEach(model => {
                const option = document.createElement('option');
                option.value = model;
                option.textContent = model;
                modelSelect.appendChild(option);
            });
            modelSelect.value = settings.model;
        }
    }

    function sendMessage() {
        const message = userInput.value.trim();
        if (!message) return;
        
        // Check for debug commands
        if (message.startsWith('debug:')) {
            handleDebugCommand(message);
            return;
        }
        
        // Add user message to chat
        const timestamp = new Date().toLocaleTimeString();
        appendMessage('user', message, timestamp);
        
        // Save to chat history
        saveChatMessage('user', message, timestamp);
        
        // Clear input
        userInput.value = '';
        userInput.style.height = 'auto';
        
        // Check if we're in contextual Q&A mode
        if (window.isContextualQAMode) {
            // Handle as a contextual question
            handleContextualQuestion(message);
            return;
        }
        
        // Show typing indicator
        const typingIndicator = showTypingIndicator();
        
        if (settings.enableStreaming) {
            // Handle streaming response
            handleStreamingResponse(message, typingIndicator);
        } else {
            // Use the background script to proxy the request to avoid CORS issues (non-streaming)
            chrome.runtime.sendMessage({
                action: 'proxyOllamaRequest',
                url: `${settings.serverUrl}/api/generate`,
                method: 'POST',
                body: {
                    model: settings.model,
                    prompt: message,
                    stream: false
                }
            }, function(response) {
                // Remove typing indicator
                removeTypingIndicator();
                
                if (response.success) {
                    // Check if the response was successful
                    if (response.data.status === 200) {
                        // Add AI response to chat
                        const aiTimestamp = new Date().toLocaleTimeString();
                        const aiResponse = response.data.data.response;
                        appendMessage('ai', aiResponse, aiTimestamp);
                        
                        // Save to chat history
                        saveChatMessage('ai', aiResponse, aiTimestamp);
                        
                        // Update status
                        updateStatus('online', 'Connected');
                    } else {
                        // Handle error response from the server
                        handleOllamaError({
                            message: `Server returned ${response.data.status}: ${response.data.statusText}`,
                            status: response.data.status,
                            data: response.data.data
                        });
                    }
                } else {
                    // Handle error in the proxy request
                    handleOllamaError({
                        message: response.error || 'Unknown error occurred',
                        isConnectionError: true
                    });
                }
            });
        }
    }
    
    // Handle streaming response
    function handleStreamingResponse(message, typingIndicator) {
        // Create a message element for the streaming response
        const aiTimestamp = new Date().toLocaleTimeString();
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message ai-message';
        
        const messageHeader = document.createElement('div');
        messageHeader.className = 'message-header';
        
        const senderIcon = document.createElement('div');
        senderIcon.className = 'sender-icon';
        senderIcon.textContent = 'AI';
        
        const timestampSpan = document.createElement('div');
        timestampSpan.className = 'timestamp';
        timestampSpan.textContent = aiTimestamp;
        
        messageHeader.appendChild(senderIcon);
        messageHeader.appendChild(timestampSpan);
        
        const messageText = document.createElement('div');
        messageText.className = 'message-text streaming-response';
        
        messageDiv.appendChild(messageHeader);
        messageDiv.appendChild(messageText);
        
        // Remove typing indicator and add the streaming message
        if (typingIndicator) {
            chatContainer.removeChild(typingIndicator);
        }
        chatContainer.appendChild(messageDiv);
        scrollToBottom();
        
        // Start the streaming request
        let fullResponse = '';
        
        // Use fetch directly for streaming
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
                    
                    // Process the chunk (each chunk may contain multiple JSON objects)
                    const lines = chunk.split('\n').filter(line => line.trim());
                    
                    for (const line of lines) {
                        try {
                            const data = JSON.parse(line);
                            if (data.response) {
                                fullResponse += data.response;
                                // Update the message text with the current full response
                                messageText.textContent = removeThinkBlocks(fullResponse);
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
            updateStatus('offline', 'Error: ' + error.message);
        });
    }
    
    function handleOllamaError(error) {
        console.error('Error:', error);
        
        const errorTimestamp = new Date().toLocaleTimeString();
        
        // Create a more detailed error message
        let errorMessage = 'Sorry, I encountered an error while communicating with the Ollama server.';
        
        // Add specific error details
        if (error.isConnectionError || error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            errorMessage += '\n\nConnection Error: Unable to reach the Ollama server. Please check that:' +
                '\n1. Ollama is running on your machine' +
                '\n2. The server URL is correct (' + settings.serverUrl + ')' +
                '\n3. The model "' + settings.model + '" is available on your Ollama server';
        } else if (error.message.includes('Server returned')) {
            errorMessage += '\n\nServer Error: ' + error.message;
            
            // Add specific advice for common error codes
            if (error.status === 404 || error.message.includes('404')) {
                errorMessage += '\n\nThe model "' + settings.model + '" may not be installed. Try running:' +
                    '\n"ollama pull ' + settings.model + '" in your terminal.';
            } else if (error.status === 500 || error.message.includes('500')) {
                errorMessage += '\n\nThe server encountered an internal error. This might be due to:' +
                    '\n1. Insufficient resources to run the model' +
                    '\n2. A problem with the model itself' +
                    '\n3. An issue with your Ollama installation';
            } else if (error.status === 403 || error.message.includes('403')) {
                errorMessage += '\n\nAccess Forbidden: The server refused to authorize the request. This might be due to:' +
                    '\n1. CORS restrictions on the Ollama server' +
                    '\n2. A firewall blocking the connection' +
                    '\n3. Ollama server configuration issues';
                
                // Add advice for CORS issues
                errorMessage += '\n\nTry running Ollama with CORS headers enabled:' +
                    '\n- On Linux/Mac: `OLLAMA_ORIGINS=* ollama serve`' +
                    '\n- On Windows: Set environment variable OLLAMA_ORIGINS=* before starting Ollama';
            }
        } else {
            errorMessage += '\n\nError details: ' + error.message;
        }
        
        // If we have error data, include it
        if (error.data && typeof error.data === 'object') {
            try {
                errorMessage += '\n\nServer response: ' + JSON.stringify(error.data);
            } catch (e) {
                // Ignore stringify errors
            }
        }
        
        appendMessage('ai', errorMessage, errorTimestamp);
        updateStatus('offline', 'Error: ' + error.message);
    }

    // Function to remove <think>blah</think> blocks from text
    function removeThinkBlocks(text) {
        if (!text) return text;
        // Use regex to remove all <think>...</think> blocks
        return text.replace(/<think>[\s\S]*?<\/think>/g, '');
    }

    function appendMessage(sender, text, timestamp) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message`;
        
        const messageHeader = document.createElement('div');
        messageHeader.className = 'message-header';
        
        const senderIcon = document.createElement('div');
        senderIcon.className = 'sender-icon';
        senderIcon.textContent = sender === 'user' ? 'You' : 'AI';
        
        const timestampSpan = document.createElement('div');
        timestampSpan.className = 'timestamp';
        timestampSpan.textContent = timestamp;
        
        messageHeader.appendChild(senderIcon);
        messageHeader.appendChild(timestampSpan);
        
        const messageText = document.createElement('div');
        messageText.className = 'message-text';
        
        // Process text to remove <think> blocks if it's an AI message
        if (sender === 'ai') {
            text = removeThinkBlocks(text);
        }
        
        // Handle multi-line text (especially for error messages)
        if (text.includes('\n')) {
            // Split by newline and create paragraph elements
            const paragraphs = text.split('\n');
            paragraphs.forEach((paragraph, index) => {
                if (paragraph.trim()) {
                    const p = document.createElement('p');
                    p.textContent = paragraph;
                    messageText.appendChild(p);
                } else if (index > 0 && index < paragraphs.length - 1) {
                    // Add empty paragraph for spacing between paragraphs
                    messageText.appendChild(document.createElement('p'));
                }
            });
        } else {
            messageText.textContent = text;
        }
        
        messageDiv.appendChild(messageHeader);
        messageDiv.appendChild(messageText);
        
        chatContainer.appendChild(messageDiv);
        scrollToBottom();
    }

    function showTypingIndicator() {
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message ai-message typing-indicator';
        
        const messageHeader = document.createElement('div');
        messageHeader.className = 'message-header';
        
        const senderIcon = document.createElement('div');
        senderIcon.className = 'sender-icon';
        senderIcon.textContent = 'AI';
        
        messageHeader.appendChild(senderIcon);
        
        const typingAnimation = document.createElement('div');
        typingAnimation.className = 'typing-animation';
        
        for (let i = 0; i < 3; i++) {
            const dot = document.createElement('span');
            dot.className = 'dot';
            typingAnimation.appendChild(dot);
        }
        
        typingDiv.appendChild(messageHeader);
        typingDiv.appendChild(typingAnimation);
        
        chatContainer.appendChild(typingDiv);
        scrollToBottom();
        
        return typingDiv;
    }

    function removeTypingIndicator() {
        const typingIndicator = document.querySelector('.typing-indicator');
        if (typingIndicator) {
            chatContainer.removeChild(typingIndicator);
        }
    }

    function scrollToBottom() {
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    function saveChatMessage(sender, text, timestamp) {
        chrome.storage.local.get(['chatHistory'], function(result) {
            const chatHistory = result.chatHistory || [];
            chatHistory.push({
                sender: sender,
                text: text,
                timestamp: timestamp
            });
            
            // Limit history to last 100 messages
            if (chatHistory.length > 100) {
                chatHistory.shift();
            }
            
            chrome.storage.local.set({ chatHistory: chatHistory });
        });
    }

    function handleDebugCommand(command) {
        const timestamp = new Date().toLocaleTimeString();
        
        if (command === 'debug:on') {
            debugMode = true;
            appendMessage('system', 'Debug mode enabled', timestamp);
        } else if (command === 'debug:off') {
            debugMode = false;
            appendMessage('system', 'Debug mode disabled', timestamp);
        } else if (command === 'debug:clear') {
            chrome.storage.local.remove(['chatHistory'], function() {
                chatContainer.innerHTML = '';
                appendMessage('system', 'Chat history cleared', timestamp);
            });
        } else if (command === 'debug:status') {
            appendMessage('system', `Debug mode: ${debugMode ? 'ON' : 'OFF'}\nServer URL: ${settings.serverUrl}\nModel: ${settings.model}\nStreaming: ${settings.enableStreaming ? 'ON' : 'OFF'}`, timestamp);
        } else {
            appendMessage('system', 'Unknown debug command. Available commands: debug:on, debug:off, debug:clear, debug:status', timestamp);
        }
        
        // Clear input
        userInput.value = '';
        userInput.style.height = 'auto';
    }

    function summarizeCurrentPage() {
        // Get the active tab
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            if (tabs.length === 0) return;
            
            const activeTab = tabs[0];
            
            // Show a message that we're fetching the page content
            const timestamp = new Date().toLocaleTimeString();
            appendMessage('system', 'Fetching page content...', timestamp);
            
            // Request the page content from the content script
            chrome.tabs.sendMessage(activeTab.id, { action: 'getPageContent' }, function(response) {
                if (chrome.runtime.lastError) {
                    // Content script might not be injected yet
                    appendMessage('system', 'Error: Could not access page content. Please refresh the page and try again.', timestamp);
                    return;
                }
                
                if (!response || !response.content) {
                    appendMessage('system', 'Error: Could not retrieve page content.', timestamp);
                    return;
                }
                
                // Get the page title and URL
                const pageTitle = activeTab.title || 'Unknown page';
                const pageUrl = activeTab.url || 'Unknown URL';
                
                // Create a prompt for summarization
                const prompt = `Please summarize the following webpage content. Focus on the main points and key information.

Page Title: ${pageTitle}
URL: ${pageUrl}

Content:
${response.content.substring(0, 15000)}`;  // Limit content to avoid token limits
                
                // Show typing indicator
                showTypingIndicator();
                
                // Use the background script to proxy the request to avoid CORS issues
                console.log('Sending summarization request to Ollama server:', settings.serverUrl);
                console.log('Using model:', settings.model);
                console.log('Streaming enabled:', settings.enableStreaming);
                
                chrome.runtime.sendMessage({
                    action: 'proxyOllamaRequest',
                    url: `${settings.serverUrl}/api/generate`,
                    method: 'POST',
                    body: {
                        model: settings.model,
                        prompt: prompt,
                        stream: settings.enableStreaming
                    }
                }, function(response) {
                    // Remove typing indicator
                    removeTypingIndicator();
                    
                    console.log('Received response from background script:', response);
                    
                    if (!response) {
                        console.error('No response received from background script');
                        appendMessage('system', 'Error: No response received from the server.', timestamp);
                        return;
                    }
                    
                    if (response.success) {
                        // Check if the response was successful
                        console.log('Response successful, status:', response.data?.status);
                        
                        if (response.data && response.data.status === 200) {
                            // Add AI response to chat
                            const aiTimestamp = new Date().toLocaleTimeString();
                            
                            // Check if response data is properly formatted
                            let aiResponse = '';
                            
                            // Handle different response formats
                            if (response.data.data && response.data.data.response) {
                                // Standard JSON response format
                                aiResponse = response.data.data.response;
                                console.log('Using standard JSON response format');
                            } else if (response.data.response) {
                                // Direct response format (from our NDJSON handler)
                                aiResponse = response.data.response;
                                console.log('Using direct response format');
                            } else if (typeof response.data === 'string') {
                                // Raw string response
                                try {
                                    // Try to parse as JSON
                                    const jsonData = JSON.parse(response.data);
                                    if (jsonData.response) {
                                        aiResponse = jsonData.response;
                                        console.log('Parsed string response as JSON');
                                    } else {
                                        // Use the string as is
                                        aiResponse = response.data;
                                        console.log('Using raw string response');
                                    }
                                } catch (e) {
                                    // Use the string as is
                                    aiResponse = response.data;
                                    console.log('Using raw string response (JSON parse failed)');
                                }
                            } else {
                                console.error('Response data is missing expected format:', response.data);
                                appendMessage('system', 'Error: Received malformed response from the server.', timestamp);
                                return;
                            }
                            
                            if (!aiResponse) {
                                console.error('Empty AI response after processing');
                                appendMessage('system', 'Error: Received empty response from the server.', timestamp);
                                return;
                            }
                            console.log('AI response received, length:', aiResponse.length);
                            
                            appendMessage('ai', aiResponse, aiTimestamp);
                            
                            // Save to chat history
                            saveChatMessage('ai', aiResponse, aiTimestamp);
                            
                            // Update status
                            updateStatus('online', 'Connected');
                        } else {
                            // Handle error response from the server
                            console.error('Server returned error status:', response.data?.status);
                            handleOllamaError({
                                message: `Server returned ${response.data?.status}: ${response.data?.statusText}`,
                                status: response.data?.status,
                                data: response.data?.data
                            });
                        }
                    } else {
                        // Handle error in the proxy request
                        console.error('Proxy request failed:', response.error);
                        handleOllamaError({
                            message: response.error || 'Unknown error occurred',
                            isConnectionError: true
                        });
                    }
                });
            });
        });
    }

    function startContextualQA() {
        // Get the active tab
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            if (tabs.length === 0) return;
            
            const activeTab = tabs[0];
            
            // Show a message that we're fetching the page content
            const timestamp = new Date().toLocaleTimeString();
            appendMessage('system', 'Fetching page content for contextual Q&A...', timestamp);
            
            // Request the page content from the content script
            chrome.tabs.sendMessage(activeTab.id, { action: 'getPageContent' }, function(response) {
                if (chrome.runtime.lastError) {
                    // Content script might not be injected yet
                    appendMessage('system', 'Error: Could not access page content. Please refresh the page and try again.', timestamp);
                    return;
                }
                
                if (!response || !response.content) {
                    appendMessage('system', 'Error: Could not retrieve page content.', timestamp);
                    return;
                }
                
                // Get the page title and URL
                const pageTitle = activeTab.title || 'Unknown page';
                const pageUrl = activeTab.url || 'Unknown URL';
                
                // Store the page content in a global variable for later use
                window.pageContext = {
                    title: pageTitle,
                    url: pageUrl,
                    content: response.content.substring(0, 15000)  // Limit content to avoid token limits
                };
                
                // Set the contextual Q&A mode flag
                window.isContextualQAMode = true;
                
                // Update UI to indicate we're in contextual Q&A mode
                appendMessage('system', `Contextual Q&A mode activated for: "${pageTitle}"\n\nYou can now ask questions about this page. Type your question below.`, timestamp);
                
                // Update the placeholder text
                userInput.placeholder = 'Ask a question about this page...';
                
                // Add a button to exit contextual Q&A mode
                const exitButton = document.createElement('button');
                exitButton.textContent = 'Exit Contextual Q&A';
                exitButton.className = 'exit-contextual-qa';
                exitButton.addEventListener('click', function() {
                    window.isContextualQAMode = false;
                    window.pageContext = null;
                    userInput.placeholder = 'Type a message...';
                    this.remove();
                    appendMessage('system', 'Exited Contextual Q&A mode.', new Date().toLocaleTimeString());
                });
                
                // Add the exit button to the chat container
                chatContainer.appendChild(exitButton);
                scrollToBottom();
            });
        });
    }

    function handleContextualQuestion(question) {
        if (!window.pageContext) {
            appendMessage('system', 'Error: Page context not available. Please restart Contextual Q&A mode.', new Date().toLocaleTimeString());
            return;
        }
        
        // Create a prompt that includes the page context and the user's question
        const prompt = `You are answering questions about the following webpage:

Page Title: ${window.pageContext.title}
URL: ${window.pageContext.url}

Content:
${window.pageContext.content}

User Question: ${question}

Please answer the question based on the webpage content. If the answer is not in the content, say so clearly.`;
        
        // Show typing indicator
        const typingIndicator = showTypingIndicator();
        
        if (settings.enableStreaming) {
            // Handle streaming response for contextual QA
            handleStreamingResponse(prompt, typingIndicator);
        } else {
            // Use the background script to proxy the request to avoid CORS issues
            chrome.runtime.sendMessage({
                action: 'proxyOllamaRequest',
                url: `${settings.serverUrl}/api/generate`,
                method: 'POST',
                body: {
                    model: settings.model,
                    prompt: prompt,
                    stream: false
                }
            }, function(response) {
                // Remove typing indicator
                removeTypingIndicator();
                
                if (response.success) {
                    // Check if the response was successful
                    if (response.data.status === 200) {
                        // Add AI response to chat
                        const aiTimestamp = new Date().toLocaleTimeString();
                        const aiResponse = response.data.data.response;
                        appendMessage('ai', aiResponse, aiTimestamp);
                        
                        // Save to chat history
                        saveChatMessage('ai', aiResponse, aiTimestamp);
                        
                        // Update status
                        updateStatus('online', 'Connected');
                    } else {
                        // Handle error response from the server
                        handleOllamaError({
                            message: `Server returned ${response.data.status}: ${response.data.statusText}`,
                            status: response.data.status,
                            data: response.data.data
                        });
                    }
                } else {
                    // Handle error in the proxy request
                    handleOllamaError({
                        message: response.error || 'Unknown error occurred',
                        isConnectionError: true
                    });
                }
            });
        }
    }
});