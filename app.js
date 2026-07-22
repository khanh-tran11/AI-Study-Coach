// ===== State =====
let currentModule = 1;
const totalModules = 10;

// ===== DOM Elements =====
const chatMessages = document.getElementById("chatMessages");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const stuckBtn = document.getElementById("stuckBtn");
const moduleList = document.getElementById("moduleList");
const progressFill = document.getElementById("progressFill");
const progressText = document.getElementById("progressText");

// ===== Chat Functions =====
function addMessage(text, sender = "bot") {
  const messageDiv = document.createElement("div");
  messageDiv.classList.add("message", sender === "bot" ? "bot-message" : "user-message");

  const avatar = document.createElement("div");
  avatar.classList.add("message-avatar");
  avatar.textContent = sender === "bot" ? "🤖" : "You";

  const content = document.createElement("div");
  content.classList.add("message-content");
  content.innerHTML = `<p>${text}</p>`;

  messageDiv.appendChild(avatar);
  messageDiv.appendChild(content);
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showTypingIndicator() {
  const typing = document.createElement("div");
  typing.classList.add("message", "bot-message");
  typing.id = "typingIndicator";
  typing.innerHTML = `
    <div class="message-avatar">🤖</div>
    <div class="message-content"><p>Typing...</p></div>
  `;
  chatMessages.appendChild(typing);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function removeTypingIndicator() {
  const typing = document.getElementById("typingIndicator");
  if (typing) typing.remove();
}

// ===== RAG API Integration =====
// Replace this URL with your actual RAG API endpoint
const RAG_API_URL = "/api/chat";

async function sendToRAG(message) {
  try {
    const response = await fetch(RAG_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: message,
        module: currentModule,
      }),
    });

    if (!response.ok) throw new Error("API request failed");

    const data = await response.json();
    return data.reply || data.response || data.answer;
  } catch (error) {
    console.error("RAG API error:", error);
    // Fallback: return a placeholder response
    return getFallbackResponse(message);
  }
}

function getFallbackResponse(message) {
  // Placeholder responses until the RAG API is connected
  const lower = message.toLowerCase();

  if (lower.includes("ready") || lower.includes("yes") || lower.includes("start")) {
    return `Great! Let's dive into <strong>Module ${currentModule}</strong>. 
    I'll walk you through each step. First, log in to Canvas and navigate to your course dashboard. 
    Let me know once you're there, or ask if you need help finding it.`;
  }

  if (lower.includes("done") || lower.includes("complete") || lower.includes("finished")) {
    return handleModuleComplete();
  }

  if (lower.includes("help") || lower.includes("how")) {
    return `Here's what I suggest: Check the Canvas left sidebar for the relevant section. 
    If you're still stuck, I can provide step-by-step screenshots or connect you with the LMS admin. 
    What specifically are you having trouble with?`;
  }

  return `I understand you said: "${message}". I'm here to help you through your Canvas training. 
  Try completing the current task, or say "I'm stuck" if you need guidance. 
  When you're done with this module, say "done" to move to the next one.`;
}

function handleModuleComplete() {
  if (currentModule < totalModules) {
    currentModule++;
    updateProgress();
    return `Excellent work! You've completed Module ${currentModule - 1}. 🎉<br><br>
    Moving on to <strong>Module ${currentModule}</strong>. Ready when you are!`;
  } else {
    return `🎓 Congratulations! You've completed all training modules! 
    You now have access to your Canvas shell. Feel free to ask me any policy or procedure questions anytime.`;
  }
}

// ===== Progress Functions =====
function updateProgress() {
  const percentage = (currentModule / totalModules) * 100;
  progressFill.style.width = `${percentage}%`;
  progressText.textContent = `Module ${currentModule} of ${totalModules}`;

  // Update sidebar module list
  const items = moduleList.querySelectorAll(".module-item");
  items.forEach((item, index) => {
    const moduleNum = index + 1;
    item.classList.remove("active", "completed", "locked");

    if (moduleNum < currentModule) {
      item.classList.add("completed");
      item.querySelector(".status").textContent = "✓";
    } else if (moduleNum === currentModule) {
      item.classList.add("active");
      item.querySelector(".status").textContent = "●";
    } else {
      item.classList.add("locked");
      item.querySelector(".status").textContent = "○";
    }
  });
}

// ===== Event Listeners =====
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const message = chatInput.value.trim();
  if (!message) return;

  addMessage(message, "user");
  chatInput.value = "";

  showTypingIndicator();

  // Simulate slight delay for natural feel
  const reply = await sendToRAG(message);

  setTimeout(() => {
    removeTypingIndicator();
    addMessage(reply, "bot");
  }, 600);
});

stuckBtn.addEventListener("click", () => {
  addMessage("I'm stuck and need help", "user");

  showTypingIndicator();
  setTimeout(() => {
    removeTypingIndicator();
    addMessage(
      `No worries! Here are your options:<br><br>
      1. Tell me what step you're on and I'll provide detailed guidance<br>
      2. <a href="#" style="color:#3b82f6">Schedule a training session</a> with the team<br>
      3. <a href="#" style="color:#3b82f6">Contact LMS Admin</a> for technical issues<br>
      4. <a href="#" style="color:#3b82f6">Instructure 24/7 Support</a> for Canvas-specific problems<br><br>
      What would be most helpful?`,
      "bot"
    );
  }, 600);
});

// Initialize
updateProgress();
