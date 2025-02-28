# AI Companion Chrome Extension

A Chrome browser extension that provides a web-based chat interface to interact with a local Ollama server.

## Features

- Chat with AI models running on your local Ollama server
- Configure server URL and select different models
- Persistent chat history
- Real-time connection status indicator

## Prerequisites

- Chrome browser
- [Ollama](https://ollama.ai/) installed and running on your local machine
- At least one model pulled in Ollama (e.g., `ollama pull llama2`)

## Installation

### Load the extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" by toggling the switch in the top right corner
3. Click "Load unpacked" and select the `extension` folder from this repository
4. The AI Companion extension should now appear in your extensions list

### Configure the extension

1. Click on the AI Companion icon in your Chrome toolbar
2. Click the settings icon (⚙️) in the top right corner of the popup
3. Enter your Ollama server URL (default is `http://localhost:11434`)
4. Select the model you want to use
5. Click "Save Settings"
6. Click "Refresh Available Models" to see all models available on your Ollama server

## Usage

1. Click on the AI Companion icon in your Chrome toolbar to open the chat interface
2. Type your message in the input field at the bottom
3. Press Enter or click the Send button to send your message
4. The AI will respond in the chat window

## Troubleshooting

- If the status indicator is red, check that your Ollama server is running
- Make sure the server URL is correct in the settings
- Ensure you have pulled at least one model in Ollama
- Check the browser console for any error messages

## Development

### Project Structure

```
extension/
├── css/
│   └── popup.css
├── images/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── js/
│   ├── background.js
│   └── popup.js
├── manifest.json
└── popup.html
```

### Building from source

1. Clone this repository
2. Make any desired changes to the code
3. Load the extension in Chrome as described in the Installation section

## License

MIT