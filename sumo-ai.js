document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("ai-chat-form");
    const input = document.getElementById("ai-question");
    const messages = document.getElementById("ai-chat-messages");
    const button = document.getElementById("ai-send-btn");
    const status = document.getElementById("ai-status");

    if (!form || !input || !messages || !button) {
        console.error("AI-chatten saknar HTML-element.");
        return;
    }

    function addMessage(sender, text) {
        const message = document.createElement("p");
        message.textContent = sender + ": " + text;
        messages.appendChild(message);
        messages.scrollTop = messages.scrollHeight;
    }

    // Aktiveras när en säker Gemini-anslutning finns.
    const AI_ENDPOINT = "https://wti1326nce.execute-api.eu-north-1.amazonaws.com/chat";

    button.disabled = !AI_ENDPOINT;

    if (status) {
        status.textContent = AI_ENDPOINT
            ? "AI Assistant är redo."
            : "AI Assistant väntar på Gemini-anslutning.";
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const question = input.value.trim();
        if (!question || !AI_ENDPOINT) return;

        addMessage("Du", question);
        input.value = "";
        button.disabled = true;

        try {
            const response = await fetch(AI_ENDPOINT, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ question })
            });

            if (!response.ok) {
                throw new Error("AI-tjänsten svarade med ett fel.");
            }

            const data = await response.json();
            addMessage("Sumo AI", data.answer || "Inget svar.");
        } catch (error) {
            addMessage("Sumo AI", "Kunde inte hämta ett svar.");
            console.error(error);
        } finally {
            button.disabled = false;
        }
    });
});
