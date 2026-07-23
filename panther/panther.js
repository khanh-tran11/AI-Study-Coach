/**
 * Panther AI Assistant — Chat logic (vanilla JS, no dependencies)
 *
 * Include this script before </body>, after the panther.html snippet.
 * It hooks into the DOM elements by class/id and handles:
 *   - Sending messages (form submit + chip clicks)
 *   - Mock assistant responses (replace with real API call)
 *   - Auto-scrolling the message log
 */

document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  // -------------------------------------------------------
  // DOM references
  // -------------------------------------------------------
  var messageLog = document.querySelector('.panther-message-log');
  var form = document.getElementById('panther-form');
  var input = document.getElementById('panther-input');
  var chips = document.querySelectorAll('.panther-chip');

  // -------------------------------------------------------
  // Canned responses (replace with real API integration)
  // -------------------------------------------------------
  var RESPONSES = [
    "Great question! Let me pull up that information for you.",
    "Based on your progress, I'd recommend focusing on Module 3 next.",
    "You're doing well! Here's a quick quiz question to test your knowledge.",
    "Your last session covered Introduction to React. Want to continue from where you left off?"
  ];
  var responseIndex = 0;

  function getNextResponse() {
    var response = RESPONSES[responseIndex % RESPONSES.length];
    responseIndex += 1;
    return response;
  }

  // -------------------------------------------------------
  // Create a message bubble element
  // -------------------------------------------------------
  function createBubble(text, sender) {
    var bubble = document.createElement('div');
    bubble.className = 'panther-bubble panther-bubble--' + sender;
    bubble.textContent = text;
    return bubble;
  }

  // -------------------------------------------------------
  // Scroll the message log to the bottom
  // -------------------------------------------------------
  function scrollToBottom() {
    messageLog.scrollTop = messageLog.scrollHeight;
  }

  // -------------------------------------------------------
  // Send a message and get a mock reply
  // -------------------------------------------------------
  function sendMessage(text) {
    var trimmed = text.trim();
    if (!trimmed) return;

    // Append user bubble
    var userBubble = createBubble(trimmed, 'user');
    messageLog.appendChild(userBubble);
    scrollToBottom();

    // Clear input
    input.value = '';

    // Mock assistant reply after 500ms
    setTimeout(function () {
      var reply = getNextResponse();
      var assistantBubble = createBubble(reply, 'assistant');
      messageLog.appendChild(assistantBubble);
      scrollToBottom();
    }, 500);
  }

  // -------------------------------------------------------
  // Form submit handler
  // -------------------------------------------------------
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    sendMessage(input.value);
  });

  // -------------------------------------------------------
  // Chip click handlers
  // -------------------------------------------------------
  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      var prompt = chip.getAttribute('data-prompt') || chip.textContent;
      sendMessage(prompt);
    });
  });
});
