/**
 * js/studyhub.js — Per-topic notes modal
 *
 * Features:
 * - Markdown notes editing with live preview via marked.js
 * - Allow-list HTML sanitizer for marked output (ARCHITECTURE.md §5)
 * - YouTube embed detection with sandboxed iframes
 * - External links get rel="noopener noreferrer" target="_blank"
 * - File/image attachments: deferred to later phase per user decision
 *
 * Security:
 * - Raw markdown stored in userState.topics[id].notes
 * - Rendered output goes through sanitizeHTML() before DOM insertion
 * - Never eval/Function the notes content
 */

// ── State ───────────────────────────────────────────────────────────────────

var _hubState = {
  isOpen: false,
  topicId: null,
  topicTitle: '',
  mode: 'edit'  // 'edit' | 'preview'
};

// ── Open / Close ────────────────────────────────────────────────────────────

/**
 * Open the Study Hub for a specific topic.
 * Called from study.js when the notes button is clicked.
 */
function openStudyHub(topicId, topicTitle) {
  _hubState.isOpen = true;
  _hubState.topicId = topicId;
  _hubState.topicTitle = topicTitle;
  _hubState.mode = 'edit';

  _renderHub();

  var overlay = $('studyhub-overlay');
  if (overlay) overlay.hidden = false;
}

function closeStudyHub() {
  _hubState.isOpen = false;
  var overlay = $('studyhub-overlay');
  if (overlay) overlay.hidden = true;
}

// ── Render ───────────────────────────────────────────────────────────────────

function _renderHub() {
  // Create overlay if it doesn't exist
  var overlay = $('studyhub-overlay');
  if (!overlay) {
    overlay = createElement('div', {
      className: 'modal-overlay studyhub-overlay',
      id: 'studyhub-overlay'
    });
    document.body.appendChild(overlay);

    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) closeStudyHub();
    });
  }

  clearElement(overlay);

  var modal = createElement('div', {
    className: 'modal studyhub-modal',
    id: 'studyhub-modal',
    attrs: { role: 'dialog', 'aria-label': 'Study Hub — Notes' }
  });

  // Header
  var header = createElement('div', { className: 'modal__header studyhub-header' });
  var titleEl = createElement('h2', {
    className: 'title-card studyhub-title',
    textContent: _hubState.topicTitle
  });
  header.appendChild(titleEl);

  var headerActions = createElement('div', { className: 'studyhub-header__actions' });

  // Edit/Preview toggle
  var editBtn = createElement('button', {
    className: 'btn btn--small' + (_hubState.mode === 'edit' ? ' btn--primary' : ' btn--ghost'),
    textContent: 'Edit',
    attrs: { type: 'button' }
  });
  editBtn.addEventListener('click', function() {
    _hubState.mode = 'edit';
    _renderHub();
  });
  headerActions.appendChild(editBtn);

  var previewBtn = createElement('button', {
    className: 'btn btn--small' + (_hubState.mode === 'preview' ? ' btn--primary' : ' btn--ghost'),
    textContent: 'Preview',
    attrs: { type: 'button' }
  });
  previewBtn.addEventListener('click', function() {
    _hubState.mode = 'preview';
    _renderHub();
  });
  headerActions.appendChild(previewBtn);

  header.appendChild(headerActions);

  var closeBtn = createElement('button', {
    className: 'modal__close',
    textContent: '×',
    attrs: { type: 'button', 'aria-label': 'Close' }
  });
  closeBtn.addEventListener('click', closeStudyHub);
  header.appendChild(closeBtn);

  modal.appendChild(header);

  // Body
  var body = createElement('div', { className: 'modal__body studyhub-body' });

  var state = getTopicState(_hubState.topicId);

  if (_hubState.mode === 'edit') {
    // Textarea for editing
    var textarea = createElement('textarea', {
      className: 'studyhub-editor',
      id: 'studyhub-editor',
      attrs: {
        placeholder: 'Write notes in Markdown…\n\nTips:\n• **bold**, *italic*, `code`\n• ## Headings\n• - Lists\n• [Link text](https://example.com)\n• YouTube links are auto-embedded',
        rows: '12',
        spellcheck: 'true'
      }
    });
    textarea.value = state.notes || '';

    // Auto-save on input (debounced)
    var debouncedSave = debounce(function() {
      var val = textarea.value;
      setTopicNotes(_hubState.topicId, val);
      saveUserState();
    }, 800);

    textarea.addEventListener('input', debouncedSave);
    body.appendChild(textarea);

    // Helper text
    var helper = createElement('div', {
      className: 'studyhub-helper',
      textContent: 'Markdown supported. Auto-saves as you type.'
    });
    body.appendChild(helper);
  } else {
    // Preview rendered markdown
    var previewDiv = createElement('div', {
      className: 'studyhub-preview',
      id: 'studyhub-preview'
    });

    var notesText = state.notes || '';
    if (notesText.trim().length === 0) {
      previewDiv.textContent = 'No notes yet. Switch to Edit to start writing.';
      previewDiv.classList.add('text-secondary');
    } else {
      var rendered = _renderMarkdown(notesText);
      previewDiv.innerHTML = rendered;
    }

    body.appendChild(previewDiv);
  }

  modal.appendChild(body);

  // Footer with topic status
  var footer = createElement('div', { className: 'modal__footer studyhub-footer' });

  var statusInfo = createElement('div', { className: 'studyhub-status' });
  statusInfo.textContent = state.completed ? '✓ Completed' : '○ Not started';
  if (state.revision) statusInfo.textContent += ' · Flagged for revision';
  if (state.bookmarked) statusInfo.textContent += ' · Bookmarked';
  footer.appendChild(statusInfo);

  // Delete notes button
  if (state.notes) {
    var deleteBtn = createElement('button', {
      className: 'btn btn--small btn--danger',
      textContent: 'Clear notes',
      attrs: { type: 'button' }
    });
    deleteBtn.addEventListener('click', function() {
      var prev = setTopicNotes(_hubState.topicId, '');
      saveUserState();
      showToast('Notes cleared', {
        type: 'info',
        undoFn: function() {
          restoreTopicState(_hubState.topicId, prev);
          saveUserState();
          _renderHub();
        }
      });
      _renderHub();
    });
    footer.appendChild(deleteBtn);
  }

  modal.appendChild(footer);
  overlay.appendChild(modal);
}

// ── Markdown Rendering + Sanitization ───────────────────────────────────────

/**
 * Render markdown to sanitized HTML.
 * 1. Parse with marked.js
 * 2. Sanitize with allow-list sanitizer
 * 3. Process YouTube links into sandboxed embeds
 * 4. Add security attributes to external links
 */
function _renderMarkdown(text) {
  if (typeof marked === 'undefined') {
    // Fallback if marked.js isn't loaded — just escape and show as-is
    return '<pre>' + escapeHTML(text) + '</pre>';
  }

  // Configure marked
  marked.setOptions({
    breaks: true,        // GitHub-style line breaks
    gfm: true,           // GitHub Flavored Markdown
    headerIds: false,     // Don't generate IDs on headings (security)
    mangle: false         // Don't mangle email addresses
  });

  var rawHtml = marked.parse(text);

  // Sanitize
  var sanitized = sanitizeHTML(rawHtml);

  // Process YouTube links into embeds
  sanitized = _embedYouTube(sanitized);

  // Add security attributes to links
  sanitized = _secureLinks(sanitized);

  return sanitized;
}

/**
 * Allow-list HTML sanitizer (ARCHITECTURE.md §5).
 * Strips everything not in the allow list.
 * Hand-rolled per architecture requirement (no sanitizer library).
 */
function sanitizeHTML(html) {
  // Create a temporary container
  var temp = document.createElement('div');
  temp.innerHTML = html;

  // Walk the DOM and strip disallowed elements/attributes
  _sanitizeNode(temp);

  return temp.innerHTML;
}

// Allowed elements and their allowed attributes
var _ALLOWED_ELEMENTS = {
  'p': [],
  'br': [],
  'strong': [],
  'b': [],
  'em': [],
  'i': [],
  'u': [],
  's': [],
  'del': [],
  'code': ['class'],
  'pre': [],
  'blockquote': [],
  'h1': [],
  'h2': [],
  'h3': [],
  'h4': [],
  'h5': [],
  'h6': [],
  'ul': [],
  'ol': ['start'],
  'li': [],
  'a': ['href'],       // We'll add rel/target in _secureLinks
  'img': ['src', 'alt', 'title'],
  'table': [],
  'thead': [],
  'tbody': [],
  'tr': [],
  'th': ['align'],
  'td': ['align'],
  'hr': [],
  'span': ['class'],   // For code highlighting
  'div': ['class'],
  'input': ['type', 'checked', 'disabled'] // GFM checkboxes
};

function _sanitizeNode(node) {
  // Walk children in reverse (since we may remove nodes)
  var children = Array.from(node.childNodes);
  for (var i = children.length - 1; i >= 0; i--) {
    var child = children[i];

    if (child.nodeType === Node.TEXT_NODE) {
      continue; // Text nodes are safe
    }

    if (child.nodeType === Node.COMMENT_NODE) {
      child.remove();
      continue;
    }

    if (child.nodeType !== Node.ELEMENT_NODE) {
      child.remove();
      continue;
    }

    var tagName = child.tagName.toLowerCase();

    // Check if element is allowed
    if (!_ALLOWED_ELEMENTS.hasOwnProperty(tagName)) {
      // Not allowed — remove element but keep its text content
      if (tagName === 'script' || tagName === 'style' || tagName === 'iframe' ||
          tagName === 'object' || tagName === 'embed' || tagName === 'form') {
        // Dangerous elements — remove entirely including children
        child.remove();
      } else {
        // Other elements — unwrap (keep children)
        while (child.firstChild) {
          node.insertBefore(child.firstChild, child);
        }
        child.remove();
      }
      continue;
    }

    // Element is allowed — strip disallowed attributes
    var allowedAttrs = _ALLOWED_ELEMENTS[tagName];
    var attrs = Array.from(child.attributes);
    for (var j = 0; j < attrs.length; j++) {
      var attrName = attrs[j].name.toLowerCase();

      // Always strip event handlers
      if (attrName.startsWith('on')) {
        child.removeAttribute(attrs[j].name);
        continue;
      }

      // Check if attribute is allowed
      if (allowedAttrs.indexOf(attrName) === -1) {
        child.removeAttribute(attrs[j].name);
        continue;
      }

      // Validate href/src values — block javascript: URLs
      if (attrName === 'href' || attrName === 'src') {
        var val = attrs[j].value.trim().toLowerCase();
        if (val.startsWith('javascript:') || val.startsWith('data:text/html') || val.startsWith('vbscript:')) {
          child.removeAttribute(attrs[j].name);
        }
      }
    }

    // Recurse into children
    _sanitizeNode(child);
  }
}

/**
 * Detect YouTube URLs in anchor tags and replace with sandboxed embeds.
 * Only processes links that are the sole content of a paragraph.
 */
function _embedYouTube(html) {
  // Match YouTube URLs in anchor tags
  var ytRegex = /<a href="(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})[^"]*)">[^<]*<\/a>/g;

  return html.replace(ytRegex, function(match, url, videoId) {
    return '<div class="studyhub-embed">' +
      '<iframe src="https://www.youtube-nocookie.com/embed/' + escapeHTML(videoId) + '" ' +
      'width="100%" height="315" frameborder="0" ' +
      'sandbox="allow-scripts allow-same-origin allow-presentation" ' +
      'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" ' +
      'allowfullscreen></iframe>' +
      '</div>';
  });
}

/**
 * Add rel="noopener noreferrer" target="_blank" to all links.
 */
function _secureLinks(html) {
  return html.replace(/<a href="/g, '<a rel="noopener noreferrer" target="_blank" href="');
}

// ── Keyboard: Escape to close ───────────────────────────────────────────────

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape' && _hubState.isOpen) {
    closeStudyHub();
  }
});
