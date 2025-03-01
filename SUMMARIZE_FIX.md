# Summarize Page Fix

## Problem
After implementing streaming responses in PR #8 (fix-grammar-streaming), the summarize page functionality stopped working. The issue was related to how the response data was being handled in the popup_with_streaming.js file and background_with_streaming.js file.

## Root Cause
1. The manifest.json was updated to use popup_with_streaming.html and background_with_streaming.js
2. However, the popup_with_streaming.js file was not updated with the NDJSON response handling code that was added to popup.js in PR #7 (fix-page-summarization)
3. The background_with_streaming.js file was also missing the NDJSON handling code that was added to background.js in PR #7
4. Both files were still using the old response handling code that expected a specific format (response.data.data.response) which doesn't work with the streaming responses

## Solution
The following changes were made to fix the issues:

### 1. Updated popup_with_streaming.js
- Added the improved response handling code from popup.js to popup_with_streaming.js for both the summarizeCurrentPage and handleContextualQuestion functions
- Added support for different response formats:
  - Standard JSON response format (response.data.data.response)
  - Direct response format from NDJSON handler (response.data.response)
  - Raw string response (with JSON parsing attempt)
- Added better error handling and logging

### 2. Updated background_with_streaming.js
- Added the NDJSON response handling code from background.js to background_with_streaming.js
- Added support for different response formats:
  - Standard JSON response format
  - NDJSON streaming format
  - Raw text responses with JSON parsing attempt
- Added better error handling and logging

### 3. Updated server.py
- Added command-line argument parsing to allow specifying the port, host, and other options
- Fixed the server to use the specified port instead of the hardcoded one
- Added support for CORS and iframe options

## Benefits
- Summarize page functionality now works correctly with streaming responses
- Contextual Q&A functionality also works correctly with streaming responses
- Better error handling and logging for debugging
- Server can be configured with command-line arguments

## Files Modified
1. `/workspace/aicompanion/extension/js/popup_with_streaming.js`
2. `/workspace/aicompanion/extension/js/background_with_streaming.js`
3. `/workspace/aicompanion/server.py`