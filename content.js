// Prevent multiple injections
if (window.copyCheckerInitialized) {
  console.log('CopyChecker already initialized');
} else {
  window.copyCheckerInitialized = true;

  // Notify that content script is loaded
  console.log('CopyChecker content script loaded');

  // LanguageTool API endpoint
  const LANGUAGETOOL_API = 'https://api.languagetool.org/v2/check';

  // Function to check spelling using LanguageTool API
  async function checkSpellingWithAPI(text, language, blockContext) {
    try {
      // If we have block context, use it to provide better context to the API
      const textToCheck = blockContext ? blockContext.fullText : text;
      
      const response = await fetch(LANGUAGETOOL_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          text: textToCheck,
          language: language === 'UK' ? 'en-GB' : 'en-US',
          enabledOnly: 'false'
        })
      });

      const data = await response.json();
      return data.matches
        .filter(match => {
          // Filter out whitespace-related issues as we handle them separately
          const isWhitespaceIssue = 
            match.rule.id.toLowerCase().includes('whitespace') ||
            match.message.toLowerCase().includes('whitespace') ||
            match.rule.description.toLowerCase().includes('whitespace') ||
            match.rule.category.id.toLowerCase().includes('typography');

          // Filter out capitalization issues for non-sentence starts
          const isCapitalizationIssue = match.rule.id.toLowerCase().includes('uppercase_sentence_start');
          if (isCapitalizationIssue) {
            // Check if this is actually the start of a sentence
            const matchStart = match.context.offset;
            const precedingText = blockContext?.precedingText || '';
            const lastChar = precedingText.trim().slice(-1);
            // If the preceding text doesn't end with sentence-ending punctuation,
            // this isn't really the start of a sentence
            if (lastChar && !'.!?'.includes(lastChar)) {
              return false;
            }
          }

          return !isWhitespaceIssue;
        })
        .map(match => ({
          type: 'spelling',
          text: match.context.text.substring(match.context.offset, match.context.offset + match.context.length),
          suggestion: match.replacements?.[0]?.value || '',
          index: match.context.offset,
          length: match.context.length,
          message: match.message,
          rule: match.rule.description
        }));
    } catch (error) {
      console.error('Error checking spelling with LanguageTool:', error);
      return [];
    }
  }

  // Function to extract text content from the page
  function extractPageContent() {
    const textNodes = [];

    // Helper function to check if an element is effectively hidden
    function isElementHidden(element) {
      if (!element) return true;
      const style = window.getComputedStyle(element);
      return style.display === 'none' || 
             style.visibility === 'hidden' || 
             style.opacity === '0' ||
             style.clip === 'rect(0px, 0px, 0px, 0px)' || 
             element.getAttribute('aria-hidden') === 'true';
    }

    // Helper function to get context type
    function getContextType(element, isInIframe = false, isInShadow = false) {
      if (isInIframe) return 'iframe';
      if (isInShadow) return 'shadow-dom';
      if (isElementHidden(element)) return 'hidden';
      return 'standard';
    }

    // Helper function to get the parent block element
    function getParentBlock(element) {
      const blockElements = [
        'P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
        'ARTICLE', 'SECTION', 'MAIN', 'HEADER', 'FOOTER',
        'LI', 'TD', 'TH', 'DD', 'DT', 'FIGCAPTION'
      ];
      
      let current = element;
      while (current && current !== document.body) {
        if (blockElements.includes(current.tagName)) {
          return current;
        }
        current = current.parentElement;
      }
      return element;
    }

    // Process a DOM tree starting from a root element
    function processNode(root, isInIframe = false, isInShadow = false) {
      // First, gather all text nodes within each block element
      const blockElements = new Map(); // Map of block elements to their text nodes

      const walk = document.createTreeWalker(
        root,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: function(node) {
            // Skip script and style elements
            if (node.parentElement.tagName === 'SCRIPT' || 
                node.parentElement.tagName === 'STYLE') {
              return NodeFilter.FILTER_REJECT;
            }
            return NodeFilter.FILTER_ACCEPT;
          }
        }
      );

      let node;
      while (node = walk.nextNode()) {
        const text = node.textContent.trim();
        if (text) {
          const blockParent = getParentBlock(node.parentElement);
          if (!blockElements.has(blockParent)) {
            blockElements.set(blockParent, []);
          }
          blockElements.get(blockParent).push({
            text: text,
            element: node.parentElement,
            path: getElementPath(node.parentElement)
          });
        }
      }

      // Process each block's text nodes as a unit
      for (const [blockParent, nodes] of blockElements) {
        // Combine text nodes within the same block for context
        const combinedText = nodes.map(n => n.text).join(' ');
        const contextType = getContextType(blockParent, isInIframe, isInShadow);

        // Add each text node with its surrounding context
        nodes.forEach((nodeInfo, index) => {
          const prevText = index > 0 ? nodes[index - 1].text : '';
          const nextText = index < nodes.length - 1 ? nodes[index + 1].text : '';

          textNodes.push({
            text: nodeInfo.text,
            element: nodeInfo.element,
            path: nodeInfo.path,
            contextType: contextType,
            blockContext: {
              fullText: combinedText,
              precedingText: prevText,
              followingText: nextText
            }
          });
        });
      }
    }

    // Process main document
    processNode(document.body);

    // Process iframes
    const iframes = document.getElementsByTagName('iframe');
    for (const iframe of iframes) {
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        if (iframeDoc) {
          processNode(iframeDoc.body, true, false);
        }
      } catch (e) {
        console.log('Could not access iframe content (likely due to same-origin policy):', e);
      }
    }

    // Process shadow DOM
    const allElements = document.getElementsByTagName('*');
    for (const element of allElements) {
      if (element.shadowRoot) {
        processNode(element.shadowRoot, false, true);
      }
    }

    return textNodes;
  }

  // Function to get element path for location reference
  function getElementPath(element) {
    const path = [];
    while (element && element.nodeType === Node.ELEMENT_NODE) {
      let selector = element.tagName.toLowerCase();
      if (element.id) {
        selector += '#' + element.id;
      } else if (element.className) {
        selector += '.' + Array.from(element.classList).join('.');
      }
      path.unshift(selector);
      element = element.parentElement;
    }
    return path.join(' > ');
  }

  // Function to check for double spaces
  function checkDoubleSpaces(text) {
    const issues = [];
    let match;
    const regex = /\s{2,}/g;
    
    while ((match = regex.exec(text)) !== null) {
      issues.push({
        type: 'double_space',
        text: match[0],
        suggestion: ' ',
        index: match.index,
        length: match[0].length,
        message: 'Double space detected',
        rule: 'Double Space'
      });
    }
    
    return issues;
  }

  // Function to analyze page content
  async function analyzePageContent(language) {
    const textNodes = extractPageContent();
    let allIssues = [];

    for (const node of textNodes) {
      // Check for double spaces
      const doubleSpaceIssues = checkDoubleSpaces(node.text);
      
      // Check spelling with block context
      const spellingIssues = await checkSpellingWithAPI(node.text, language, node.blockContext);

      // If there are any issues, add them to the results with context information
      if (doubleSpaceIssues.length > 0 || spellingIssues.length > 0) {
        // Add context information to each issue
        const issues = [...doubleSpaceIssues, ...spellingIssues].map(issue => ({
          ...issue,
          context: {
            type: node.contextType,
            description: node.contextType === 'standard' ? '' :
                        node.contextType === 'iframe' ? ' (found in iframe)' :
                        node.contextType === 'shadow-dom' ? ' (found in shadow DOM)' :
                        ' (found in hidden element)'
          }
        }));

        allIssues.push({
          path: node.path,
          issues: issues
        });
      }
    }

    return allIssues;
  }

  // Listen for messages from the popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Message received in content script:', request);
    
    if (request.action === 'ping') {
      // Respond to ping to confirm content script is loaded
      sendResponse({ status: 'ok' });
      return false;
    }
    
    if (request.action === 'analyzePage') {
      // Handle async response
      analyzePageContent(request.language)
        .then(issues => {
          console.log('Analysis complete, sending response');
          sendResponse({ issues });
        })
        .catch(error => {
          console.error('Error in content script:', error);
          sendResponse({ error: error.message });
        });
      return true; // Will respond asynchronously
    }
  });
} 