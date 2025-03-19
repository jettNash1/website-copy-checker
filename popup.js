document.addEventListener('DOMContentLoaded', () => {
  const checkPageButton = document.getElementById('checkPage');
  const toggleLanguageInput = document.getElementById('toggleLanguage');
  const loadingElement = document.getElementById('loading');
  const resultsElement = document.getElementById('results');
  const noIssuesElement = document.getElementById('noIssues');
  const summaryContent = document.getElementById('summaryContent');
  const issuesContent = document.getElementById('issuesContent');
  const copySection = document.getElementById('copySection');
  const copyReportButton = document.getElementById('copyReport');
  const copySuccessMessage = copyReportButton.querySelector('.copy-success');

  let currentLanguage = 'UK';
  let currentIssues = null;

  // Load saved language preference and last results
  chrome.storage.local.get(['language', 'lastResults', 'lastUrl'], (result) => {
    if (result.language === 'US') {
      toggleLanguageInput.checked = true;
      currentLanguage = 'US';
    }

    // Only show last results if we're on the same page
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (result.lastResults && result.lastUrl === tab.url) {
        currentIssues = result.lastResults;
        displayResults(result.lastResults);
      }
    });
  });

  // Toggle language between UK and US
  toggleLanguageInput.addEventListener('change', () => {
    currentLanguage = toggleLanguageInput.checked ? 'US' : 'UK';
    // Save language preference
    chrome.storage.local.set({ language: currentLanguage });
  });

  // Function to inject and execute content script
  async function injectContentScript(tabId) {
    try {
      // Check if content script is already injected
      try {
        await chrome.tabs.sendMessage(tabId, { action: 'ping' });
        console.log('Content script already injected');
        return true;
      } catch (error) {
        console.log('Content script not yet injected');
      }

      // Inject content script
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content.js']
      });

      // Wait for content script to initialize
      return new Promise((resolve) => {
        let attempts = 0;
        const maxAttempts = 10;
        const checkInjection = async () => {
          try {
            await chrome.tabs.sendMessage(tabId, { action: 'ping' });
            resolve(true);
          } catch (error) {
            attempts++;
            if (attempts < maxAttempts) {
              setTimeout(checkInjection, 100);
            } else {
              resolve(false);
            }
          }
        };
        checkInjection();
      });
    } catch (error) {
      console.error('Error injecting content script:', error);
      return false;
    }
  }

  // Handle page check
  checkPageButton.addEventListener('click', async () => {
    // Show loading state
    loadingElement.classList.remove('hidden');
    resultsElement.classList.add('hidden');
    noIssuesElement.classList.add('hidden');
    copySection.classList.add('hidden');

    try {
      // Get the active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Ensure content script is injected
      const isInjected = await injectContentScript(tab.id);
      if (!isInjected) {
        throw new Error('Failed to inject content script');
      }

      // Send message to content script
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'analyzePage',
        language: currentLanguage
      });

      if (response.error) {
        throw new Error(response.error);
      }

      // Store results and current URL
      chrome.storage.local.set({
        lastResults: response.issues,
        lastUrl: tab.url
      });

      displayResults(response.issues);
    } catch (error) {
      console.error('Error analyzing page:', error);
      showError('Failed to analyze page. Please try again.');
    } finally {
      loadingElement.classList.add('hidden');
    }
  });

  // Handle copying report
  copyReportButton.addEventListener('click', async () => {
    if (!currentIssues) return;

    const report = formatReportForCopy(currentIssues);
    
    try {
      await navigator.clipboard.writeText(report);
      
      // Show success message
      copySuccessMessage.classList.remove('hidden');
      copyReportButton.querySelector('.button-text').classList.add('hidden');
      
      // Hide success message after 2 seconds
      setTimeout(() => {
        copySuccessMessage.classList.add('hidden');
        copyReportButton.querySelector('.button-text').classList.remove('hidden');
      }, 2000);
    } catch (err) {
      console.error('Failed to copy report:', err);
      showError('Failed to copy report to clipboard');
    }
  });

  function formatReportForCopy(issues) {
    const lines = [];
    
    // Add header
    lines.push('CopyChecker Report');
    lines.push(`Language: ${currentLanguage}`);
    lines.push(`Date: ${new Date().toLocaleString()}`);
    lines.push('');

    // Add summary
    lines.push('Summary:');
    Object.entries(groupIssues(issues)).forEach(([type, typeIssues]) => {
      if (typeIssues.length > 0) {
        const typeLabel = {
          double_space: 'Double Spaces',
          spelling: 'Spelling and Grammar Issues',
          homophone: 'Grammar/Homophone Issues'
        }[type];
        lines.push(`${typeLabel}: ${typeIssues.length} instances`);
      }
    });
    lines.push('');

    // Add detailed issues
    lines.push('Detailed Issues:');
    lines.push('Type\tIssue\tSuggestion\tLocation');

    Object.entries(groupIssues(issues)).forEach(([type, typeIssues]) => {
      typeIssues.forEach(issue => {
        const typeLabel = {
          double_space: 'Double Space',
          spelling: 'Spelling/Grammar',
          homophone: 'Grammar/Homophone'
        }[type];

        let suggestion = '';
        if (issue.suggestion) suggestion = issue.suggestion;
        if (issue.message) {
          suggestion += suggestion ? ' - ' : '';
          suggestion += issue.message;
        }

        lines.push([
          typeLabel,
          issue.text.trim(),
          suggestion,
          issue.path
        ].join('\t'));
      });
    });

    return lines.join('\n');
  }

  function displayResults(issues) {
    if (!issues || issues.length === 0) {
      noIssuesElement.classList.remove('hidden');
      currentIssues = null;
      copySection.classList.add('hidden');
      return;
    }

    // Store current issues for copy functionality
    currentIssues = issues;

    // Group issues by type
    const groupedIssues = groupIssues(issues);
    
    // Display summary
    displaySummary(groupedIssues);
    
    // Display detailed issues
    displayDetailedIssues(groupedIssues);
    
    resultsElement.classList.remove('hidden');
    copySection.classList.remove('hidden');
  }

  function groupIssues(issues) {
    const grouped = {
      double_space: [],
      spelling: [],
      homophone: []
    };

    issues.forEach(node => {
      node.issues.forEach(issue => {
        grouped[issue.type].push({
          ...issue,
          path: node.path
        });
      });
    });

    return grouped;
  }

  function displaySummary(groupedIssues) {
    const summaryHTML = Object.entries(groupedIssues)
      .map(([type, issues]) => {
        if (issues.length === 0) return '';
        
        const typeLabel = {
          double_space: 'Double Spaces',
          spelling: 'Spelling and Grammar Issues',
          homophone: 'Grammar/Homophone Issues'
        }[type];

        return `<div class="summary-item">
          <strong>${issues.length}</strong> ${typeLabel}
        </div>`;
      })
      .filter(Boolean)
      .join('');

    summaryContent.innerHTML = summaryHTML || '<p>No issues found!</p>';
  }

  function displayDetailedIssues(groupedIssues) {
    const issuesHTML = Object.entries(groupedIssues)
      .map(([type, issues]) => {
        if (issues.length === 0) return '';

        const typeLabel = {
          double_space: 'Double Spaces',
          spelling: 'Spelling and Grammar Issues',
          homophone: 'Grammar/Homophone Issues'
        }[type];

        const issuesList = issues.map(issue => {
          let issueText = issue.text;
          if (issue.suggestion) {
            issueText += ` (suggestion: ${issue.suggestion})`;
          }
          if (issue.message) {
            issueText += ` - ${issue.message}`;
          }
          if (issue.rule) {
            issueText += ` [${issue.rule}]`;
          }
          
          return `
            <div class="issue-item">
              <div class="issue-text">${issueText}</div>
              <div class="issue-location">${issue.path}</div>
            </div>
          `;
        }).join('');

        return `
          <div class="issue-group">
            <h3>${typeLabel} (${issues.length} instances)</h3>
            ${issuesList}
          </div>
        `;
      })
      .filter(Boolean)
      .join('');

    issuesContent.innerHTML = issuesHTML || '<p>No detailed issues to display.</p>';
  }

  function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    resultsElement.innerHTML = '';
    resultsElement.appendChild(errorDiv);
    resultsElement.classList.remove('hidden');
    copySection.classList.add('hidden'); // Hide copy button on error
  }
}); 