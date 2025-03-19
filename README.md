# Website Copy Checker

A powerful browser extension for Chrome and Edge that helps you identify and fix copy-related issues on web pages. The extension checks for spelling mistakes, double spaces, and provides suggestions for improvements, supporting both UK and US English.

## Features

- **Real-time Copy Analysis**: Instantly analyze any webpage for common copy issues
- **Dual Language Support**: Switch between UK (British) and US (American) English
- **Comprehensive Coverage**:
  - Main page content
  - Content in iframes (same-origin)
  - Shadow DOM elements
  - Hidden elements (visibility: hidden, opacity: 0, etc.)
- **Issue Detection**:
  - Spelling mistakes and typos
  - Double spaces
  - Detailed error messages and suggestions
- **Smart State Management**: 
  - Tab-specific results that persist while browsing
  - Results automatically saved per tab
  - Results restored when returning to analyzed tabs
  - Results cleared only when navigating to a new page
- **Structured Reports**: 
  - Clear issue categorization
  - Precise location tracking for each issue
  - Context information (iframe, shadow DOM, hidden elements)
  - Suggested corrections
  - Easy-to-understand error messages

## Result Persistence

The extension implements a smart result management system:
- Results are saved specifically for each tab
- When you check a page, the results are stored for that specific tab
- If you switch to a different tab, the popup will appear empty
- When you return to a previously checked tab, your results will automatically reappear
- Results are only cleared in two cases:
  1. When you navigate to a new page within the tab
  2. When you perform a new check on the current page

This behavior ensures that:
- You can browse other tabs without losing your results
- You can return to previously checked tabs to review findings
- Results always stay relevant to the current page you're viewing

## What Gets Checked

The extension analyzes:
- All visible text content on the page
- Text in paragraphs, headings, buttons, and other elements
- Text in iframes (when accessible due to same-origin policy)
- Text in shadow DOM elements
- Text in hidden elements (display: none, visibility: hidden, opacity: 0)
- Text in dynamic content (if loaded when analysis starts)

Important Limitations:
- Cannot check text embedded in images, SVGs, or canvas elements
- Cannot access cross-origin iframe content (browser security restriction)
- Cannot check text rendered using custom fonts or special characters that bypass normal text rendering
- Cannot check text that loads after the analysis has started
- Cannot check text in PDF viewers or other embedded document formats
- Cannot check text that is part of a video or audio player interface
- Cannot check text that is generated or modified by JavaScript after the analysis

## Installation

### Chrome
1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" by clicking the toggle switch in the top right corner
4. Click "Load unpacked" button in the top left
5. Navigate to the directory containing the extension files and select it
6. The extension should now appear in your toolbar

### Edge
1. Download or clone this repository
2. Open Edge and navigate to `edge://extensions/`
3. Enable "Developer mode" using the toggle switch on the left sidebar
4. Click "Load unpacked" button
5. Navigate to the directory containing the extension files and select it
6. The extension should now appear in your toolbar

## Usage

1. Click the CopyChecker icon in your browser toolbar
2. Select your preferred language variant:
   - Toggle switch to the left for UK English
   - Toggle switch to the right for US English
3. Click "Check Page" to analyze the current webpage
4. Review the results in two sections:
   - Summary: Quick overview of issues found
   - Detailed Issues: Complete list of issues with:
     - Issue description
     - Suggested correction
     - Location in the page
5. Use the "Copy Report" button to copy a full report to your clipboard

## Technical Details

The extension uses:
- LanguageTool API for advanced spell checking
- Chrome Extension Manifest V3
- Modern JavaScript features
- DOM TreeWalker for comprehensive text extraction
- Smart caching to improve performance

## Permissions

The extension requires the following permissions:
- `activeTab`: To access and analyze the current webpage
- `storage`: To save language preferences and results
- `scripting`: To inject content scripts
- `webNavigation`: To handle page navigation events

## Development

### Project Structure
```
website-copy-checker/
├── manifest.json        # Extension configuration
├── popup/
│   ├── popup.html      # Extension popup interface
│   ├── popup.js        # Popup functionality
│   └── styles.css      # Popup styles
├── background.js       # Background service worker
└── content.js         # Content script for page analysis
```

### Building and Testing

1. Make changes to the source code
2. Reload the extension in Chrome/Edge:
   - Go to the extensions page
   - Find CopyChecker
   - Click the refresh icon
3. Test on various websites
4. Check the browser console for debugging information

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- LanguageTool API for providing spell checking capabilities
- Chrome Extensions API for making this possible 