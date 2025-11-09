document.addEventListener("DOMContentLoaded", () => {
  const chatBubble = document.getElementById("chat-bubble");
  const chatWindow = document.getElementById("chat-window");
  const chatClose = document.getElementById("chat-close"); // We'll add this
  const chatForm = document.getElementById("chat-form");
  const chatInput = document.getElementById("chat-input");
  const messagesContainer = document.getElementById("chat-messages");

  // Toggle chat window
  chatBubble.addEventListener("click", () => {
    chatWindow.classList.toggle("show");
  });

  // Handle form submission
  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const message = chatInput.value.trim();
    if (!message) return;

    // 1. Display user's message
    addMessage(message, "user");
    chatInput.value = "";
    showTyping();

    try {
      // 2. Send to backend
      const res = await fetch("/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      if (!res.ok) {
        throw new Error("Login to chat");
      }

      const data = await res.json();

      // 3. Display bot's reply
      removeTyping();
      addMessage(data.reply, "bot");
    } catch (err) {
      removeTyping();
      addMessage("You must be logged in to chat.", "bot");
    }
  });

  function addMessage(text, sender) {
    const messageEl = document.createElement("div");
    messageEl.classList.add("chat-message", sender);
    messageEl.textContent = text;
    messagesContainer.appendChild(messageEl);
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function showTyping() {
    const typingEl = document.createElement("div");
    typingEl.classList.add("chat-message", "bot", "typing");
    typingEl.textContent = "CareFlow Assist is typing...";
    typingEl.id = "typing-indicator";
    messagesContainer.appendChild(typingEl);
  }

  function removeTyping() {
    const typingEl = document.getElementById("typing-indicator");
    if (typingEl) {
      typingEl.remove();
    }
  }
});
