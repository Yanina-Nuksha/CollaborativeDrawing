const userId = sessionStorage.getItem("userId");
const userName = sessionStorage.getItem("username");

const chatConnection = new signalR.HubConnectionBuilder()
    .withUrl(`http://${window.location.hostname}:5116/chatHub?sessionId=${sessionId}`, { withCredentials: false })
    .build();

chatConnection.start().then(() => {
    console.log("Connected to chat hub");
    chatConnection.invoke("JoinSession", sessionId, userId);
}).catch(err => console.error("Connection to chat hub failed:", err));

chatConnection.on("ReceiveMessage", (message) => {
    console.log("New message:", message);
    addMessageToChat(message);
});

chatConnection.on("LoadExistingMessages", (messages) => {
    messages.forEach(message => addMessageToChat(message));
});

function sendMessage(message) {
    if (!message.trim()) return;
    chatConnection.invoke("SendMessage", sessionId, userId, userName, message)
        .catch(err => console.error("Ошибка при отправке сообщения:", err));
}

function addMessageToChat(message) {
    const chatContainer = document.getElementById("chat-messages");
    const messageElement = document.createElement("div");
    messageElement.classList.add("chat-message");

    if (message.temporary) {
        messageElement.classList.add("guest-message");
    }

    messageElement.innerHTML = `<strong>${message.senderName}:</strong> ${message.message}`;
    chatContainer.appendChild(messageElement);

    chatContainer.scrollTo({
        top: chatContainer.scrollHeight,
        behavior: "smooth"
    });
}


document.getElementById("chat-input").addEventListener("keypress", function (event) {
    if (event.key === "Enter") {
        event.preventDefault();
        document.getElementById("send-message").click();
    }
});

document.getElementById("send-message").addEventListener("click", () => {
    const input = document.getElementById("chat-input");
    sendMessage(input.value);
    input.value = "";
});

