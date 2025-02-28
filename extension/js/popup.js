document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const chatContainer = document.getElementById('chatContainer');
    const userInput = document.getElementById('userInput');
    const sendButton = document.getElementById('sendButton');
    const settingsButton = document.getElementById('settingsButton');
    const settingsPanel = document.getElementById('settingsPanel');
    const saveSettingsButton = document.getElementById('saveSettings');
    const serverUrlInput = document.getElementById('serverUrl');
    const modelSelect = document.getElementById('modelSelect');
    const refreshModelsButton = document.getElementById('refreshModels');
    const statusIndicator = document.getElementById('statusIndicator');
    const statusText = document.getElementById('statusText');
    
    // Debug mode - can be enabled by typing "debug:on" in the chat
    let debugMode = false;
    
    // Default settings
    let settings = {
        serverUrl: 'http://localhost:11434',
        model: 'llama2'
    };

    // Load settings from storage
    chrome.storage.local.get(['settings'], function(result) {
        if (result.settings) {
            settings = result.settings;
            serverUrlInput.value = settings.serverUrl;
            modelSelect.value = settings.model;
        } else {
            serverUrlInput.value = settings.serverUrl;
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
        
        chrome.storage.local.set({ settings: settings }, function() {
            checkServerConnection();
            settingsPanel.style.display = 'none';
        });
    }

    function checkServerConnection() {
        updateStatus('connecting', 'Connecting...');
        
        fetch(`${settings.serverUrl}/api/tags`)
            .then(async response => {
                if (response.ok) {
                    updateStatus('online', 'Connected');
                    return response.json();
                } else {
                    // Try to get more detailed error information
                    let errorDetails = '';
                    try {
                        const errorJson = await response.json();
                        errorDetails = errorJson.error || '';
                    } catch (e) {
                        // If we can't parse JSON, use the status text
                        errorDetails = response.statusText;
                    }
                    
                    throw new Error(`Server returned ${response.status}: ${errorDetails}`);
                }
            })
            .then(data => {
                populateModelSelect(data.models);
            })
            .catch(error => {
                console.error('Error connecting to Ollama server:', error);
                
                // Create a more specific error message based on the error
                let statusMessage = 'Disconnected';
                
                if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                    statusMessage = 'Cannot reach server';
                } else if (error.message.includes('Server returned')) {
                    statusMessage = error.message;
                }
                
                updateStatus('offline', statusMessage);
            });
    }

    function updateStatus(status, message) {
        statusIndicator.className = 'status-indicator ' + status;
        statusText.textContent = message;
    }

    function fetchAvailableModels() {
        updateStatus('connecting', 'Fetching models...');
        
        fetch(`${settings.serverUrl}/api/tags`)
            .then(async response => {
                if (response.ok) {
                    updateStatus('online', 'Connected');
                    return response.json();
                } else {
                    // Try to get more detailed error information
                    let errorDetails = '';
                    try {
                        const errorJson = await response.json();
                        errorDetails = errorJson.error || '';
                    } catch (e) {
                        // If we can't parse JSON, use the status text
                        errorDetails = response.statusText;
                    }
                    
                    throw new Error(`Server returned ${response.status}: ${errorDetails}`);
                }
            })
            .then(data => {
                if (data.models && data.models.length > 0) {
                    populateModelSelect(data.models);
                    updateStatus('online', `Found ${data.models.length} models`);
                } else {
                    populateModelSelect([]);
                    updateStatus('online', 'No models found. Pull models using Ollama CLI');
                }
            })
            .catch(error => {
                console.error('Error fetching models:', error);
                
                // Create a more specific error message based on the error
                let statusMessage = 'Failed to fetch models';
                
                if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                    statusMessage = 'Cannot reach server';
                } else if (error.message.includes('Server returned')) {
                    statusMessage = error.message;
                }
                
                updateStatus('offline', statusMessage);
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
        
        // Show typing indicator
        showTypingIndicator();
        
        // Send to Ollama API
        fetch(`${settings.serverUrl}/api/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: settings.model,
                prompt: message,
                stream: false
            })
        })
        .then(async response => {
            if (!response.ok) {
                // Try to get more detailed error information
                let errorDetails = '';
                try {
                    const errorJson = await response.json();
                    errorDetails = errorJson.error || '';
                } catch (e) {
                    // If we can't parse JSON, use the status text
                    errorDetails = response.statusText;
                }
                
                throw new Error(`Server returned ${response.status}: ${errorDetails}`);
            }
            return response.json();
        })
        .then(data => {
            // Remove typing indicator
            removeTypingIndicator();
            
            // Add AI response to chat
            const aiTimestamp = new Date().toLocaleTimeString();
            appendMessage('ai', data.response, aiTimestamp);
            
            // Save to chat history
            saveChatMessage('ai', data.response, aiTimestamp);
        })
        .catch(error => {
            console.error('Error:', error);
            removeTypingIndicator();
            
            const errorTimestamp = new Date().toLocaleTimeString();
            
            // Create a more detailed error message
            let errorMessage = 'Sorry, I encountered an error while communicating with the Ollama server.';
            
            // Add specific error details
            if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                errorMessage += '\n\nConnection Error: Unable to reach the Ollama server. Please check that:' +
                    '\n1. Ollama is running on your machine' +
                    '\n2. The server URL is correct (' + settings.serverUrl + ')' +
                    '\n3. The model "' + settings.model + '" is available on your Ollama server';
            } else if (error.message.includes('Server returned')) {
                errorMessage += '\n\nServer Error: ' + error.message;
                
                // Add specific advice for common error codes
                if (error.message.includes('404')) {
                    errorMessage += '\n\nThe model "' + settings.model + '" may not be installed. Try running:' +
                        '\n"ollama pull ' + settings.model + '" in your terminal.';
                } else if (error.message.includes('500')) {
                    errorMessage += '\n\nThe server encountered an internal error. This might be due to:' +
                        '\n1. Insufficient resources to run the model' +
                        '\n2. A problem with the model itself' +
                        '\n3. An issue with your Ollama installation';
                }
            } else {
                errorMessage += '\n\nError details: ' + error.message;
            }
            
            appendMessage('ai', errorMessage, errorTimestamp);
            updateStatus('offline', 'Error: ' + error.message);
        });
    }

    function appendMessage(sender, text, timestamp) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message`;
        
        const messageText = document.createElement('div');
        messageText.className = 'message-text';
        
        // Handle multi-line text (especially for error messages)
        if (text.includes('\n')) {
            // Split by newline and create paragraph elements
            const paragraphs = text.split('\n');
            paragraphs.forEach((paragraph, index) => {
                if (paragraph.trim() !== '') {
                    const p = document.createElement('p');
                    p.textContent = paragraph;
                    messageText.appendChild(p);
                } else if (index < paragraphs.length - 1) {
                    // Add empty line for readability, but not at the end
                    messageText.appendChild(document.createElement('br'));
                }
            });
        } else {
            messageText.textContent = text;
        }
        
        const messageTime = document.createElement('div');
        messageTime.className = 'message-time';
        messageTime.textContent = timestamp;
        
        messageDiv.appendChild(messageText);
        messageDiv.appendChild(messageTime);
        
        chatContainer.appendChild(messageDiv);
        scrollToBottom();
    }

    function showTypingIndicator() {
        const typingDiv = document.createElement('div');
        typingDiv.className = 'typing-indicator';
        typingDiv.id = 'typingIndicator';
        
        for (let i = 0; i < 3; i++) {
            const dot = document.createElement('span');
            typingDiv.appendChild(dot);
        }
        
        chatContainer.appendChild(typingDiv);
        scrollToBottom();
    }

    function removeTypingIndicator() {
        const typingIndicator = document.getElementById('typingIndicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    function scrollToBottom() {
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    function saveChatMessage(sender, text, timestamp) {
        chrome.storage.local.get(['chatHistory'], function(result) {
            let chatHistory = result.chatHistory || [];
            chatHistory.push({
                sender: sender,
                text: text,
                timestamp: timestamp
            });
            
            // Limit history to last 50 messages
            if (chatHistory.length > 50) {
                chatHistory = chatHistory.slice(chatHistory.length - 50);
            }
            
            chrome.storage.local.set({ chatHistory: chatHistory });
        });
    }
    
    function handleDebugCommand(command) {
        const timestamp = new Date().toLocaleTimeString();
        let responseMessage = '';
        
        // Clear input
        userInput.value = '';
        userInput.style.height = 'auto';
        
        // Process command
        if (command === 'debug:on') {
            debugMode = true;
            responseMessage = 'Debug mode enabled. Available commands:\n' +
                'debug:off - Turn off debug mode\n' +
                'debug:status - Show current status and settings\n' +
                'debug:clear - Clear chat history\n' +
                'debug:test - Test connection to Ollama server\n' +
                'debug:models - Show available models\n' +
                'debug:chat [message] - Test chat with detailed logging';
        } else if (command === 'debug:off') {
            debugMode = false;
            responseMessage = 'Debug mode disabled.';
        } else if (command === 'debug:status') {
            responseMessage = 'Current Status:\n' +
                `Debug Mode: ${debugMode ? 'Enabled' : 'Disabled'}\n` +
                `Server URL: ${settings.serverUrl}\n` +
                `Current Model: ${settings.model}\n` +
                `Connection Status: ${statusText.textContent}`;
        } else if (command === 'debug:clear') {
            // Clear chat container
            chatContainer.innerHTML = '';
            // Clear chat history
            chrome.storage.local.set({ chatHistory: [] });
            responseMessage = 'Chat history cleared.';
        } else if (command === 'debug:test') {
            // Test connection to Ollama server
            responseMessage = 'Testing connection to Ollama server...';
            appendMessage('system', responseMessage, timestamp);
            
            fetch(`${settings.serverUrl}/api/tags`)
                .then(async response => {
                    let testResult = '';
                    if (response.ok) {
                        const data = await response.json();
                        testResult = 'Connection successful!\n\n' +
                            `Server URL: ${settings.serverUrl}\n` +
                            `API Version: ${data.ollama?.version || 'Unknown'}\n` +
                            `Available Models: ${data.models?.length || 0}\n\n` +
                            'Raw Response:\n' + JSON.stringify(data, null, 2);
                    } else {
                        let errorDetails = '';
                        try {
                            const errorJson = await response.json();
                            errorDetails = errorJson.error || '';
                        } catch (e) {
                            errorDetails = response.statusText;
                        }
                        testResult = `Connection failed: Server returned ${response.status}: ${errorDetails}`;
                    }
                    appendMessage('system', testResult, new Date().toLocaleTimeString());
                })
                .catch(error => {
                    const errorMessage = `Connection error: ${error.message}`;
                    appendMessage('system', errorMessage, new Date().toLocaleTimeString());
                });
            
            return; // Don't append another message
        } else if (command === 'debug:models') {
            // Show available models
            responseMessage = 'Fetching available models...';
            appendMessage('system', responseMessage, timestamp);
            
            fetch(`${settings.serverUrl}/api/tags`)
                .then(async response => {
                    if (response.ok) {
                        const data = await response.json();
                        if (data.models && data.models.length > 0) {
                            const modelList = data.models.map(model => 
                                `${model.name} (${(model.size / (1024*1024*1024)).toFixed(2)} GB)`
                            ).join('\n');
                            const modelMessage = `Available Models:\n${modelList}`;
                            appendMessage('system', modelMessage, new Date().toLocaleTimeString());
                        } else {
                            appendMessage('system', 'No models found on the Ollama server.', new Date().toLocaleTimeString());
                        }
                    } else {
                        let errorDetails = '';
                        try {
                            const errorJson = await response.json();
                            errorDetails = errorJson.error || '';
                        } catch (e) {
                            errorDetails = response.statusText;
                        }
                        const errorMessage = `Failed to fetch models: Server returned ${response.status}: ${errorDetails}`;
                        appendMessage('system', errorMessage, new Date().toLocaleTimeString());
                    }
                })
                .catch(error => {
                    const errorMessage = `Error fetching models: ${error.message}`;
                    appendMessage('system', errorMessage, new Date().toLocaleTimeString());
                });
            
            return; // Don't append another message
        } else if (command.startsWith('debug:chat ')) {
            // Test chat with a simple message
            const testMessage = command.substring('debug:chat '.length);
            if (!testMessage) {
                responseMessage = 'Please provide a test message. Example: debug:chat Hello, how are you?';
            } else {
                responseMessage = `Sending test message: "${testMessage}"`;
                appendMessage('system', responseMessage, timestamp);
                
                // Show request details
                const requestDetails = `Request Details:\nURL: ${settings.serverUrl}/api/generate\nModel: ${settings.model}\nPrompt: ${testMessage}`;
                appendMessage('system', requestDetails, new Date().toLocaleTimeString());
                
                // Show typing indicator
                showTypingIndicator();
                
                // Send to Ollama API with verbose logging
                fetch(`${settings.serverUrl}/api/generate`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: settings.model,
                        prompt: testMessage,
                        stream: false
                    })
                })
                .then(async response => {
                    // Log raw response
                    const responseClone = response.clone();
                    let rawResponse;
                    try {
                        rawResponse = await responseClone.text();
                    } catch (e) {
                        rawResponse = 'Could not read raw response: ' + e.message;
                    }
                    
                    appendMessage('system', `Raw Response (Status ${response.status}):\n${rawResponse.substring(0, 500)}${rawResponse.length > 500 ? '...(truncated)' : ''}`, new Date().toLocaleTimeString());
                    
                    if (!response.ok) {
                        let errorDetails = '';
                        try {
                            const errorJson = JSON.parse(rawResponse);
                            errorDetails = errorJson.error || '';
                        } catch (e) {
                            errorDetails = response.statusText;
                        }
                        
                        throw new Error(`Server returned ${response.status}: ${errorDetails}`);
                    }
                    
                    return response.json();
                })
                .then(data => {
                    // Remove typing indicator
                    removeTypingIndicator();
                    
                    // Log parsed response
                    appendMessage('system', `Parsed Response:\n${JSON.stringify(data, null, 2)}`, new Date().toLocaleTimeString());
                    
                    // Add AI response to chat
                    const aiTimestamp = new Date().toLocaleTimeString();
                    appendMessage('ai', data.response, aiTimestamp);
                })
                .catch(error => {
                    console.error('Error:', error);
                    removeTypingIndicator();
                    
                    const errorTimestamp = new Date().toLocaleTimeString();
                    appendMessage('system', `Error: ${error.message}`, errorTimestamp);
                });
                
                return; // Don't append another message
            }
        
        } else {
            responseMessage = `Unknown debug command: ${command}\n` +
                'Available commands:\n' +
                'debug:on - Turn on debug mode\n' +
                'debug:off - Turn off debug mode\n' +
                'debug:status - Show current status and settings\n' +
                'debug:clear - Clear chat history\n' +
                'debug:test - Test connection to Ollama server\n' +
                'debug:models - Show available models\n' +
                'debug:chat [message] - Test chat with detailed logging';
        }
        
        appendMessage('system', responseMessage, timestamp);
    }
});