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
            .then(response => {
                if (response.ok) {
                    updateStatus('online', 'Connected');
                    return response.json();
                } else {
                    throw new Error('Server connection failed');
                }
            })
            .then(data => {
                populateModelSelect(data.models);
            })
            .catch(error => {
                console.error('Error connecting to Ollama server:', error);
                updateStatus('offline', 'Disconnected');
            });
    }

    function updateStatus(status, message) {
        statusIndicator.className = 'status-indicator ' + status;
        statusText.textContent = message;
    }

    function fetchAvailableModels() {
        updateStatus('connecting', 'Fetching models...');
        
        fetch(`${settings.serverUrl}/api/tags`)
            .then(response => {
                if (response.ok) {
                    updateStatus('online', 'Connected');
                    return response.json();
                } else {
                    throw new Error('Failed to fetch models');
                }
            })
            .then(data => {
                populateModelSelect(data.models);
            })
            .catch(error => {
                console.error('Error fetching models:', error);
                updateStatus('offline', 'Failed to fetch models');
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
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to get response from Ollama');
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
            appendMessage('ai', 'Sorry, I encountered an error. Please check your connection to the Ollama server.', errorTimestamp);
            updateStatus('offline', 'Error: ' + error.message);
        });
    }

    function appendMessage(sender, text, timestamp) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message`;
        
        const messageText = document.createElement('div');
        messageText.className = 'message-text';
        messageText.textContent = text;
        
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
});