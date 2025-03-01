// Content script for AI Companion Grammar Checker
// This script runs on web pages and adds grammar checking functionality

// Store the current text field element
let currentTextField = null;
let grammarCheckerMenu = null;

// Create and inject the grammar checker menu
function createGrammarCheckerMenu() {
    // Check if menu already exists
    if (document.getElementById('ai-companion-grammar-menu')) {
        return document.getElementById('ai-companion-grammar-menu');
    }
    
    // Create the menu element
    const menu = document.createElement('div');
    menu.id = 'ai-companion-grammar-menu';
    menu.className = 'ai-companion-grammar-menu';
    menu.style.display = 'none';
    
    // Create menu items
    const checkGrammarBtn = document.createElement('button');
    checkGrammarBtn.textContent = '✓ Check Grammar';
    checkGrammarBtn.className = 'ai-companion-menu-item';
    checkGrammarBtn.addEventListener('click', handleGrammarCheck);
    
    const improveWritingBtn = document.createElement('button');
    improveWritingBtn.textContent = '✨ Improve Writing';
    improveWritingBtn.className = 'ai-companion-menu-item';
    improveWritingBtn.addEventListener('click', handleImproveWriting);
    
    const makeFormalBtn = document.createElement('button');
    makeFormalBtn.textContent = '👔 Make Formal';
    makeFormalBtn.className = 'ai-companion-menu-item';
    makeFormalBtn.addEventListener('click', handleMakeFormal);
    
    const makeCasualBtn = document.createElement('button');
    makeCasualBtn.textContent = '👕 Make Casual';
    makeCasualBtn.className = 'ai-companion-menu-item';
    makeCasualBtn.addEventListener('click', handleMakeCasual);
    
    const shortenBtn = document.createElement('button');
    shortenBtn.textContent = '📝 Shorten';
    shortenBtn.className = 'ai-companion-menu-item';
    shortenBtn.addEventListener('click', handleShorten);
    
    // Add menu items to menu
    menu.appendChild(checkGrammarBtn);
    menu.appendChild(improveWritingBtn);
    menu.appendChild(makeFormalBtn);
    menu.appendChild(makeCasualBtn);
    menu.appendChild(shortenBtn);
    
    // Add menu to page
    document.body.appendChild(menu);
    
    // Add styles for the menu
    const style = document.createElement('style');
    style.textContent = `
        .ai-companion-grammar-menu {
            position: absolute;
            background-color: white;
            border: 1px solid #ccc;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
            padding: 8px 0;
            z-index: 10000;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        
        .ai-companion-menu-item {
            display: block;
            width: 100%;
            padding: 8px 16px;
            text-align: left;
            background: none;
            border: none;
            font-size: 14px;
            cursor: pointer;
        }
        
        .ai-companion-menu-item:hover {
            background-color: #f0f0f0;
        }
        
        .ai-companion-result-popup {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            padding: 20px;
            z-index: 10001;
            max-width: 80%;
            max-height: 80%;
            overflow-y: auto;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        
        .ai-companion-result-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 1px solid #eee;
        }
        
        .ai-companion-result-title {
            font-size: 18px;
            font-weight: 600;
            color: #4a6fa5;
        }
        
        .ai-companion-result-close {
            background: none;
            border: none;
            font-size: 20px;
            cursor: pointer;
            color: #999;
        }
        
        .ai-companion-result-content {
            margin-bottom: 15px;
        }
        
        .ai-companion-result-actions {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
        }
        
        .ai-companion-result-button {
            background-color: #4a6fa5;
            color: white;
            border: none;
            padding: 8px 15px;
            border-radius: 4px;
            cursor: pointer;
        }
        
        .ai-companion-result-button:hover {
            background-color: #3a5a8c;
        }
        
        .ai-companion-loading {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        
        .ai-companion-spinner {
            border: 4px solid #f3f3f3;
            border-top: 4px solid #4a6fa5;
            border-radius: 50%;
            width: 30px;
            height: 30px;
            animation: ai-companion-spin 1s linear infinite;
            margin-bottom: 15px;
        }
        
        @keyframes ai-companion-spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);
    
    return menu;
}

// Show the grammar checker menu at the specified position
function showGrammarCheckerMenu(x, y) {
    if (!grammarCheckerMenu) {
        grammarCheckerMenu = createGrammarCheckerMenu();
    }
    
    // Position the menu
    grammarCheckerMenu.style.left = `${x}px`;
    grammarCheckerMenu.style.top = `${y}px`;
    grammarCheckerMenu.style.display = 'block';
    
    // Add event listener to hide menu when clicking outside
    document.addEventListener('click', hideGrammarCheckerMenu);
}

// Hide the grammar checker menu
function hideGrammarCheckerMenu(event) {
    if (grammarCheckerMenu && (!event || !grammarCheckerMenu.contains(event.target))) {
        grammarCheckerMenu.style.display = 'none';
        document.removeEventListener('click', hideGrammarCheckerMenu);
    }
}

// Handle grammar check request
function handleGrammarCheck() {
    hideGrammarCheckerMenu();
    if (currentTextField) {
        const text = getTextFromField(currentTextField);
        if (text.trim()) {
            processTextWithAI(text, 'grammar', 'Grammar Check');
        }
    }
}

// Handle improve writing request
function handleImproveWriting() {
    hideGrammarCheckerMenu();
    if (currentTextField) {
        const text = getTextFromField(currentTextField);
        if (text.trim()) {
            processTextWithAI(text, 'improve', 'Improved Writing');
        }
    }
}

// Handle make formal request
function handleMakeFormal() {
    hideGrammarCheckerMenu();
    if (currentTextField) {
        const text = getTextFromField(currentTextField);
        if (text.trim()) {
            processTextWithAI(text, 'formal', 'Formal Version');
        }
    }
}

// Handle make casual request
function handleMakeCasual() {
    hideGrammarCheckerMenu();
    if (currentTextField) {
        const text = getTextFromField(currentTextField);
        if (text.trim()) {
            processTextWithAI(text, 'casual', 'Casual Version');
        }
    }
}

// Handle shorten request
function handleShorten() {
    hideGrammarCheckerMenu();
    if (currentTextField) {
        const text = getTextFromField(currentTextField);
        if (text.trim()) {
            processTextWithAI(text, 'shorten', 'Shortened Version');
        }
    }
}

// Get text from the current text field
function getTextFromField(element) {
    if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
        return element.value;
    } else if (element.isContentEditable) {
        return element.innerText;
    }
    return '';
}

// Set text in the current text field
function setTextInField(element, text) {
    if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
        element.value = text;
        // Trigger input event to notify the page of the change
        element.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (element.isContentEditable) {
        element.innerText = text;
        // Trigger input event to notify the page of the change
        element.dispatchEvent(new Event('input', { bubbles: true }));
    }
}

// Process text with AI
function processTextWithAI(text, mode, title) {
    // Create loading popup
    const popup = document.createElement('div');
    popup.className = 'ai-companion-result-popup';
    
    const loadingContent = document.createElement('div');
    loadingContent.className = 'ai-companion-loading';
    
    const spinner = document.createElement('div');
    spinner.className = 'ai-companion-spinner';
    
    const loadingText = document.createElement('div');
    loadingText.textContent = 'Processing your text...';
    
    loadingContent.appendChild(spinner);
    loadingContent.appendChild(loadingText);
    popup.appendChild(loadingContent);
    
    document.body.appendChild(popup);
    
    // Create prompt based on mode
    let prompt = '';
    switch (mode) {
        case 'grammar':
            prompt = `Please check the following text for grammar, spelling, and punctuation errors. Provide a corrected version and briefly explain the changes made:

${text}`;
            break;
        case 'improve':
            prompt = `Please improve the following text to make it clearer, more engaging, and more effective. Provide the improved version:

${text}`;
            break;
        case 'formal':
            prompt = `Please rewrite the following text in a more formal, professional tone. Provide the formal version:

${text}`;
            break;
        case 'casual':
            prompt = `Please rewrite the following text in a more casual, conversational tone. Provide the casual version:

${text}`;
            break;
        case 'shorten':
            prompt = `Please shorten the following text while preserving its key points and meaning. Provide the shortened version:

${text}`;
            break;
    }
    
    // Send message to background script to process with AI
    chrome.runtime.sendMessage({
        action: 'grammarCheck',
        text: text,
        prompt: prompt,
        mode: mode
    }, function(response) {
        // Remove loading popup
        document.body.removeChild(popup);
        
        if (response && response.success) {
            showResultPopup(text, response.result, title, mode);
        } else {
            showErrorPopup(response ? response.error : 'Unknown error occurred');
        }
    });
}

// Show result popup
function showResultPopup(originalText, aiResult, title, mode) {
    const popup = document.createElement('div');
    popup.className = 'ai-companion-result-popup';
    
    // Create header
    const header = document.createElement('div');
    header.className = 'ai-companion-result-header';
    
    const titleElement = document.createElement('div');
    titleElement.className = 'ai-companion-result-title';
    titleElement.textContent = title;
    
    const closeButton = document.createElement('button');
    closeButton.className = 'ai-companion-result-close';
    closeButton.textContent = '×';
    closeButton.addEventListener('click', () => {
        document.body.removeChild(popup);
    });
    
    header.appendChild(titleElement);
    header.appendChild(closeButton);
    
    // Create content
    const content = document.createElement('div');
    content.className = 'ai-companion-result-content';
    
    // Format the result based on mode
    if (mode === 'grammar' && aiResult.includes('Corrections:')) {
        // For grammar mode, try to extract the corrected text and explanations
        const parts = aiResult.split('Corrections:');
        const correctedText = parts[0].trim();
        const explanations = parts[1] ? parts[1].trim() : '';
        
        const correctedTextElement = document.createElement('div');
        correctedTextElement.style.marginBottom = '15px';
        correctedTextElement.style.padding = '10px';
        correctedTextElement.style.backgroundColor = '#f9f9f9';
        correctedTextElement.style.borderRadius = '4px';
        correctedTextElement.style.whiteSpace = 'pre-wrap';
        correctedTextElement.textContent = correctedText;
        
        const explanationsTitle = document.createElement('div');
        explanationsTitle.style.fontWeight = 'bold';
        explanationsTitle.style.marginTop = '10px';
        explanationsTitle.textContent = 'Explanations:';
        
        const explanationsElement = document.createElement('div');
        explanationsElement.style.whiteSpace = 'pre-wrap';
        explanationsElement.textContent = explanations;
        
        content.appendChild(correctedTextElement);
        if (explanations) {
            content.appendChild(explanationsTitle);
            content.appendChild(explanationsElement);
        }
    } else {
        // For other modes, just show the result
        content.style.whiteSpace = 'pre-wrap';
        content.textContent = aiResult;
    }
    
    // Create actions
    const actions = document.createElement('div');
    actions.className = 'ai-companion-result-actions';
    
    const applyButton = document.createElement('button');
    applyButton.className = 'ai-companion-result-button';
    applyButton.textContent = 'Apply Changes';
    applyButton.addEventListener('click', () => {
        // Extract just the corrected text for grammar mode
        let textToApply = aiResult;
        if (mode === 'grammar' && aiResult.includes('Corrections:')) {
            textToApply = aiResult.split('Corrections:')[0].trim();
        }
        
        setTextInField(currentTextField, textToApply);
        document.body.removeChild(popup);
    });
    
    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.style.backgroundColor = '#f0f0f0';
    cancelButton.style.color = '#333';
    cancelButton.style.border = 'none';
    cancelButton.style.padding = '8px 15px';
    cancelButton.style.borderRadius = '4px';
    cancelButton.style.cursor = 'pointer';
    cancelButton.addEventListener('click', () => {
        document.body.removeChild(popup);
    });
    
    actions.appendChild(cancelButton);
    actions.appendChild(applyButton);
    
    // Assemble popup
    popup.appendChild(header);
    popup.appendChild(content);
    popup.appendChild(actions);
    
    // Add to page
    document.body.appendChild(popup);
    
    // Add event listener to close on escape key
    const escapeHandler = (e) => {
        if (e.key === 'Escape') {
            document.body.removeChild(popup);
            document.removeEventListener('keydown', escapeHandler);
        }
    };
    document.addEventListener('keydown', escapeHandler);
}

// Show error popup
function showErrorPopup(errorMessage) {
    const popup = document.createElement('div');
    popup.className = 'ai-companion-result-popup';
    
    // Create header
    const header = document.createElement('div');
    header.className = 'ai-companion-result-header';
    
    const titleElement = document.createElement('div');
    titleElement.className = 'ai-companion-result-title';
    titleElement.textContent = 'Error';
    
    const closeButton = document.createElement('button');
    closeButton.className = 'ai-companion-result-close';
    closeButton.textContent = '×';
    closeButton.addEventListener('click', () => {
        document.body.removeChild(popup);
    });
    
    header.appendChild(titleElement);
    header.appendChild(closeButton);
    
    // Create content
    const content = document.createElement('div');
    content.className = 'ai-companion-result-content';
    content.textContent = errorMessage || 'An error occurred while processing your text. Please try again.';
    content.style.color = '#F44336';
    
    // Create actions
    const actions = document.createElement('div');
    actions.className = 'ai-companion-result-actions';
    
    const okButton = document.createElement('button');
    okButton.className = 'ai-companion-result-button';
    okButton.textContent = 'OK';
    okButton.addEventListener('click', () => {
        document.body.removeChild(popup);
    });
    
    actions.appendChild(okButton);
    
    // Assemble popup
    popup.appendChild(header);
    popup.appendChild(content);
    popup.appendChild(actions);
    
    // Add to page
    document.body.appendChild(popup);
}

// Listen for context menu events on text fields
document.addEventListener('contextmenu', function(event) {
    // Check if the target is a text field
    const target = event.target;
    if (
        target.tagName === 'TEXTAREA' || 
        target.tagName === 'INPUT' && (target.type === 'text' || target.type === 'email' || target.type === 'search') ||
        target.isContentEditable
    ) {
        // Store the current text field
        currentTextField = target;
        
        // Show the grammar checker menu
        showGrammarCheckerMenu(event.clientX, event.clientY);
    } else {
        // Hide the menu if clicking outside a text field
        hideGrammarCheckerMenu();
    }
});

// Listen for messages from the background script
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'grammarCheckResult') {
        // Handle the result
        sendResponse({ received: true });
    }
});

console.log('AI Companion Grammar Checker content script loaded');