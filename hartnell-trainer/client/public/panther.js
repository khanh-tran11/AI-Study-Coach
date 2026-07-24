/**
 * Panther AI Assistant — REST API chat logic (vanilla JS, no dependencies)
 *
 * Sends POST to API Gateway → Lambda → Bedrock Knowledge Base
 * Request:  { "message": "user question", "sessionId": "optional" }
 * Response: { "answer": "...", "sessionId": "..." }
 */

document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  // -------------------------------------------------------
  // Configuration
  // -------------------------------------------------------
  var API_URL = 'https://9alic6z3ej.execute-api.us-west-2.amazonaws.com/panther-chat';

  // -------------------------------------------------------
  // DOM references
  // -------------------------------------------------------
  var messageLog = document.querySelector('.panther-message-log');
  var form = document.getElementById('panther-form');
  var input = document.getElementById('panther-input');
  var sendBtn = form.querySelector('.panther-send-btn');
  var chips = document.querySelectorAll('.panther-chip');

  // -------------------------------------------------------
  // State
  // -------------------------------------------------------
  var sessionId = null;
  var isWaiting = false;

  // -------------------------------------------------------
  // UI helpers
  // -------------------------------------------------------
  function appendBubble(text, sender) {
    var bubble = document.createElement('div');
    bubble.className = 'panther-bubble panther-bubble--' + sender;
    bubble.textContent = text;
    messageLog.appendChild(bubble);
    scrollToBottom();
  }

  function appendThinkingBubble() {
    var bubble = document.createElement('div');
    bubble.className = 'panther-bubble panther-bubble--assistant panther-thinking';
    bubble.textContent = 'Thinking...';
    bubble.style.fontStyle = 'italic';
    bubble.style.opacity = '0.7';
    messageLog.appendChild(bubble);
    scrollToBottom();
  }

  function removeThinkingBubble() {
    var thinking = messageLog.querySelector('.panther-thinking');
    if (thinking) {
      thinking.remove();
    }
  }

  function scrollToBottom() {
    messageLog.scrollTop = messageLog.scrollHeight;
  }

  function setWaiting(waiting) {
    isWaiting = waiting;
    input.disabled = waiting;
    sendBtn.disabled = waiting;
    input.placeholder = waiting ? 'Panther is thinking...' : 'Ask Panther anything...';
    chips.forEach(function (chip) {
      chip.disabled = waiting;
    });
  }

  // -------------------------------------------------------
  // Send message via REST API
  // -------------------------------------------------------
  function sendMessage(text) {
    var trimmed = text.trim();
    if (!trimmed || isWaiting) return;

    // Show user message
    appendBubble(trimmed, 'user');
    input.value = '';

    // Show thinking state
    setWaiting(true);
    appendThinkingBubble();

    // POST to API Gateway
    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: trimmed, sessionId: sessionId })
    })
      .then(function (res) {
        if (!res.ok) {
          throw new Error('Server responded with ' + res.status);
        }
        return res.json();
      })
      .then(function (data) {
        removeThinkingBubble();

        // Store session ID for conversation continuity
        if (data.sessionId) {
          sessionId = data.sessionId;
        }

        var answer = data.answer || data.message || data.text || "I couldn't find an answer. Try rephrasing your question.";
        appendBubble(answer, 'assistant');
      })
      .catch(function (err) {
        console.error('[Panther] Error:', err);
        console.error('[Panther] Error name:', err.name);
        console.error('[Panther] Error message:', err.message);
        removeThinkingBubble();
        appendBubble("Sorry, I couldn't connect right now. Error: " + err.message, 'assistant');
      })
      .finally(function () {
        setWaiting(false);
      });
  }

  // -------------------------------------------------------
  // Event handlers
  // -------------------------------------------------------
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    sendMessage(input.value);
  });

  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      var prompt = chip.getAttribute('data-prompt') || chip.textContent;
      sendMessage(prompt);
    });
  });
});
