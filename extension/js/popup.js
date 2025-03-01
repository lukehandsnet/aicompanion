document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const chatContainer = document.getElementById('chatContainer');
    const userInput = document.getElementById('userInput');
    const sendButton = document.getElementById('sendButton');
    const summarizeButton = document.getElementById('summarizeButton');
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
    summarizeButton.addEventListener('click', summarizeCurrentPage);
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
        
        // Show typing indicator
        showTypingIndicator();
        
        // Use the background script to proxy the request to avoid CORS issues
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
        // Process text to remove <think> blocks if it's an AI message
        if (sender === 'ai') {
            text = removeThinkBlocks(text);
        }
        
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
                'debug:chat [message] - Test chat with detailed logging\n' +
                'debug:ping - Simple ping test to Ollama server';
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
            
            // Use the background script to proxy the request to avoid CORS issues
            chrome.runtime.sendMessage({
                action: 'proxyOllamaRequest',
                url: `${settings.serverUrl}/api/tags`,
                method: 'GET'
            }, function(response) {
                let testResult = '';
                
                if (response.success) {
                    // Check if the response was successful
                    if (response.data.status === 200) {
                        // Parse the response data
                        let data;
                        try {
                            data = typeof response.data.data === 'string' 
                                ? JSON.parse(response.data.data) 
                                : response.data.data;
                            
                            testResult = 'Connection successful!\n\n' +
                                `Server URL: ${settings.serverUrl}\n` +
                                `API Version: ${data.ollama?.version || 'Unknown'}\n` +
                                `Available Models: ${data.models?.length || 0}\n\n` +
                                'Raw Response:\n' + JSON.stringify(data, null, 2);
                        } catch (e) {
                            testResult = `Connection successful but error parsing response: ${e.message}\n\n` +
                                `Raw Response: ${JSON.stringify(response.data.data)}`;
                        }
                    } else {
                        // Handle error response from the server
                        testResult = `Connection failed: Server returned ${response.data.status}: ${response.data.statusText}\n\n`;
                        
                        // Add response data if available
                        if (response.data.data) {
                            testResult += `Response data: ${typeof response.data.data === 'string' ? response.data.data : JSON.stringify(response.data.data)}`;
                        }
                    }
                } else {
                    // Handle error in the proxy request
                    testResult = `Connection error: ${response.error || 'Unknown error'}\n\n` +
                        'This could be due to:\n' +
                        '1. Ollama not running\n' +
                        '2. Incorrect server URL\n' +
                        '3. Network issues\n' +
                        '4. CORS restrictions';
                }
                
                appendMessage('system', testResult, new Date().toLocaleTimeString());
            });
            
            return; // Don't append another message
        } else if (command === 'debug:models') {
            // Show available models
            responseMessage = 'Fetching available models...';
            appendMessage('system', responseMessage, timestamp);
            
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
                                const modelList = data.models.map(model => 
                                    `${model.name} (${(model.size / (1024*1024*1024)).toFixed(2)} GB)`
                                ).join('\n');
                                const modelMessage = `Available Models:\n${modelList}`;
                                appendMessage('system', modelMessage, new Date().toLocaleTimeString());
                            } else {
                                appendMessage('system', 'No models found on the Ollama server.', new Date().toLocaleTimeString());
                            }
                        } catch (e) {
                            const errorMessage = `Error parsing model data: ${e.message}`;
                            appendMessage('system', errorMessage, new Date().toLocaleTimeString());
                        }
                    } else {
                        // Handle error response from the server
                        const errorMessage = `Failed to fetch models: Server returned ${response.data.status}: ${response.data.statusText}`;
                        appendMessage('system', errorMessage, new Date().toLocaleTimeString());
                        
                        // Add response data if available
                        if (response.data.data) {
                            const dataMessage = `Response data: ${typeof response.data.data === 'string' ? response.data.data : JSON.stringify(response.data.data)}`;
                            appendMessage('system', dataMessage, new Date().toLocaleTimeString());
                        }
                    }
                } else {
                    // Handle error in the proxy request
                    const errorMessage = `Error fetching models: ${response.error || 'Unknown error'}`;
                    appendMessage('system', errorMessage, new Date().toLocaleTimeString());
                }
            });
            
            return; // Don't append another message
        } else if (command === 'debug:ping') {
            // Simple ping test to Ollama server
            responseMessage = 'Pinging Ollama server...';
            appendMessage('system', responseMessage, timestamp);
            
            // Use a simple fetch directly (not through the proxy) to test basic connectivity
            fetch(`${settings.serverUrl}/api/tags`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            })
            .then(response => {
                const pingResult = `Direct ping result: ${response.status} ${response.statusText}`;
                appendMessage('system', pingResult, new Date().toLocaleTimeString());
                
                // Now try with the proxy
                appendMessage('system', 'Pinging through proxy...', new Date().toLocaleTimeString());
                
                chrome.runtime.sendMessage({
                    action: 'proxyOllamaRequest',
                    url: `${settings.serverUrl}/api/tags`,
                    method: 'GET'
                }, function(proxyResponse) {
                    const proxyResult = `Proxy ping result: ${proxyResponse.success ? 'Success' : 'Failed'}`;
                    appendMessage('system', proxyResult, new Date().toLocaleTimeString());
                    
                    if (proxyResponse.success) {
                        appendMessage('system', `Status: ${proxyResponse.data.status} ${proxyResponse.data.statusText}`, new Date().toLocaleTimeString());
                    } else {
                        appendMessage('system', `Error: ${proxyResponse.error}`, new Date().toLocaleTimeString());
                    }
                });
            })
            .catch(error => {
                const errorMessage = `Direct ping error: ${error.message}`;
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
                
                // Use the background script to proxy the request to avoid CORS issues
                chrome.runtime.sendMessage({
                    action: 'proxyOllamaRequest',
                    url: `${settings.serverUrl}/api/generate`,
                    method: 'POST',
                    body: {
                        model: settings.model,
                        prompt: testMessage,
                        stream: false
                    }
                }, function(response) {
                    // Remove typing indicator
                    removeTypingIndicator();
                    
                    // Log raw response
                    appendMessage('system', `Raw Response:\n${JSON.stringify(response, null, 2).substring(0, 500)}${JSON.stringify(response, null, 2).length > 500 ? '...(truncated)' : ''}`, new Date().toLocaleTimeString());
                    
                    if (response.success) {
                        // Check if the response was successful
                        if (response.data.status === 200) {
                            // Log parsed response
                            appendMessage('system', `Parsed Response:\n${JSON.stringify(response.data.data, null, 2)}`, new Date().toLocaleTimeString());
                            
                            // Add AI response to chat
                            const aiTimestamp = new Date().toLocaleTimeString();
                            appendMessage('ai', response.data.data.response, aiTimestamp);
                        } else {
                            // Handle error response from the server
                            const errorTimestamp = new Date().toLocaleTimeString();
                            appendMessage('system', `Error: Server returned ${response.data.status}: ${response.data.statusText}`, errorTimestamp);
                            
                            // Show error details if available
                            if (response.data.data) {
                                try {
                                    const errorDetails = typeof response.data.data === 'string' 
                                        ? response.data.data 
                                        : JSON.stringify(response.data.data, null, 2);
                                    appendMessage('system', `Error Details:\n${errorDetails}`, errorTimestamp);
                                } catch (e) {
                                    appendMessage('system', `Error parsing error details: ${e.message}`, errorTimestamp);
                                }
                            }
                        }
                    } else {
                        // Handle error in the proxy request
                        const errorTimestamp = new Date().toLocaleTimeString();
                        appendMessage('system', `Proxy Error: ${response.error || 'Unknown error occurred'}`, errorTimestamp);
                    }
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
                'debug:chat [message] - Test chat with detailed logging\n' +
                'debug:ping - Simple ping test to Ollama server';
        }
        
        appendMessage('system', responseMessage, timestamp);
    }

    // Function to summarize the current page
    function summarizeCurrentPage() {
        // Update status
        updateStatus('connecting', 'Getting page content...');
        
        // Get the active tab
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            const activeTab = tabs[0];
            const timestamp = new Date().toLocaleTimeString();
            
            // Check if the URL is a restricted URL (chrome://, edge://, about:, etc.)
            if (activeTab.url.startsWith('chrome://') || 
                activeTab.url.startsWith('edge://') || 
                activeTab.url.startsWith('about:') ||
                activeTab.url.startsWith('chrome-extension://') ||
                activeTab.url.startsWith('devtools://')) {
                
                // Show error message for restricted URLs
                appendMessage('system', 'Getting content from: ' + activeTab.title, timestamp);
                appendMessage('system', 'Error: Cannot access content from ' + activeTab.url.split('/')[0] + '// URLs due to browser security restrictions.', timestamp);
                appendMessage('system', 'Please navigate to a regular webpage to use the summarize feature.', timestamp);
                updateStatus('offline', 'Cannot access this page type');
                return;
            }
            
            // Show a message that we're getting the page content
            appendMessage('system', 'Getting content from: ' + activeTab.title, timestamp);
            
            // Execute script to get page content
            chrome.scripting.executeScript({
                target: {tabId: activeTab.id},
                function: getPageContent
            }, function(results) {
                if (chrome.runtime.lastError) {
                    // Handle error
                    const errorMessage = 'Error: ' + chrome.runtime.lastError.message;
                    appendMessage('system', errorMessage, new Date().toLocaleTimeString());
                    updateStatus('offline', 'Error getting page content');
                    return;
                }
                
                if (!results || !results[0] || !results[0].result) {
                    appendMessage('system', 'Error: Could not extract page content', new Date().toLocaleTimeString());
                    updateStatus('offline', 'Error getting page content');
                    return;
                }
                
                const pageContent = results[0].result;
                
                // Show a message that we're summarizing
                const userTimestamp = new Date().toLocaleTimeString();
                const userMessage = 'Please summarize this page for me.';
                appendMessage('user', userMessage, userTimestamp);
                
                // Save to chat history
                saveChatMessage('user', userMessage, userTimestamp);
                
                // Show typing indicator
                showTypingIndicator();
                
                // Create a prompt for summarization
                const summarizePrompt = `Please provide a concise summary of the following webpage content. Focus on the main points and key information:

${pageContent.substring(0, 15000)}${pageContent.length > 15000 ? '... (content truncated due to length)' : ''}`;
                
                // Send to Ollama for summarization
                chrome.runtime.sendMessage({
                    action: 'proxyOllamaRequest',
                    url: `${settings.serverUrl}/api/generate`,
                    method: 'POST',
                    body: {
                        model: settings.model,
                        prompt: summarizePrompt,
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
            });
        });
    }
    
    // Function to get page content (executed in the context of the page)
    function getPageContent() {
        // Get the main content of the page
        // This is a simple implementation that gets text from the body
        // You might want to improve this to focus on the main content area
        
        // Get the page title
        const title = document.title;
        
        // Get the page URL
        const url = window.location.href;
        
        // Get the page content
        // First try to get the main content if it exists
        let content = '';
        
        // Try to get content from article or main elements first
        const mainContent = document.querySelector('article, main, #content, .content, [role="main"]');
        if (mainContent) {
            content = mainContent.innerText;
        } else {
            // Fallback to body content
            content = document.body.innerText;
        }
        
        // Clean up the content (remove extra whitespace)
        content = content.replace(/\s+/g, ' ').trim();
        
        // Return a structured object with the page information
        return `Title: ${title}\nURL: ${url}\n\nContent:\n${content}`;
    }
});