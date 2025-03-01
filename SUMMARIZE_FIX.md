# Summarize Page Fix

## Problem
After implementing streaming responses in PR #8 (fix-grammar-streaming), the summarize page functionality stopped working. The issue was related to how the response data was being handled in the popup_with_streaming.js file.

## Root Cause
1. The manifest.json was updated to use popup_with_streaming.html and background_with_streaming.js
2. However, the popup_with_streaming.js file was not updated with the NDJSON response handling code that was added to popup.js in PR #7 (fix-page-summarization)
3. The popup_with_streaming.js file was still using the old response handling code that expected a specific format (response.data.data.response) which doesn't work with the streaming responses

## Solution
The following changes were made to fix the issues:

### 1. Updated popup_with_streaming.js
- Added the improved response handling code from popup.js to popup_with_streaming.js for both the summarizeCurrentPage and handleContextualQuestion functions
- Added support for different response formats:
  - Standard JSON response format (response.data.data.response)
  - Direct response format from NDJSON handler (response.data.response)
  - Raw string response (with JSON parsing attempt)
- Added better error handling and logging

## Benefits
- Summarize page functionality now works correctly with streaming responses
- Contextual Q&A functionality also works correctly with streaming responses
- Better error handling and logging for debugging

## Files Modified
1. `/workspace/aicompanion/extension/js/popup_with_streaming.js`