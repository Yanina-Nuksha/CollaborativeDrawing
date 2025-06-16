const API_URL = `http://${window.location.hostname}:5116/session`;

document.addEventListener("DOMContentLoaded", fetchUserSessions);

function togglePasswordField() {
    let passwordField = document.getElementById("password");
    passwordField.style.display = document.getElementById("isPrivate").checked ? "block" : "none";
}

function fetchUserSessions() {
    const token = localStorage.getItem("token");
    if (!token) {
        alert("Вы не авторизованы!");
        window.location.href = "auth.html";
        return;
    }

    fetch(`${API_URL}/user-list`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
    })
        .then(res => {
            if (!res.ok) {
                return res.json().then(data => { throw new Error(data.message || "Ошибка сервера"); });
            }
            return res.json();
        })
        .then(sessions => {
            const list = document.getElementById('mySessions');
            list.innerHTML = sessions.map(s => `
                   <div class="session-card">
                        <h3>${s.name} (${s.isPrivate ? "Приватный" : "Открытый"})</h3>
                        <p>Статус: ${s.isActive ? "Активен" : "Неактивен"}</p>
                        <div class="session-buttons">
                            <button class="btn-custom" onclick="joinSession('${s.id}', ${s.isPrivate})">Присоединиться</button>
                            ${s.isActive ? '' : `<button class="btn-custom" onclick="startSession('${s.id}')">Начать</button>`}
                            <button class="btn-custom" onclick="openEditSessionModal('${s.name}', ${s.isPrivate}, '${s.id}')">Настройки</button>
                            <button class="btn-custom" onclick="showQrForSession('${s.id}')">Поделиться</button>
                            <button class="btn-custom" onclick="deleteSession('${s.id}')">Удалить</button>
                        </div>
                    </div>
            `).join('');
        })
        .catch(err => alert("Ошибка загрузки сеансов: " + err.message));
}

function openCreateSessionModal() {
    document.getElementById("createSessionModal").style.display = "block";
}

function closeCreateSessionModal() {
    document.getElementById("createSessionModal").style.display = "none";
}

function toggleNewSessionPasswordField() {
    let passwordField = document.getElementById("newPassword");
    passwordField.style.display = document.getElementById("newIsPrivate").checked ? "block" : "none";
}

function createSession() {
    const token = localStorage.getItem("token");
    if (!token) {
        alert("Вы не авторизованы!");
        window.location.href = "auth.html";
        return;
    }

    const sessionName = document.getElementById('sessionName').value.trim();
    const isPrivate = document.getElementById('isPrivate').checked;
    const password = isPrivate ? document.getElementById('password').value.trim() : null;

    if (!sessionName.trim()) {
        alert("Введите название сеанса");
        return;
    }

    if (isPrivate && !password) {
        alert("Введите пароль для приватного сеанса");
        return;
    }

    fetch(`${API_URL}/create`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ sessionName, isPrivate, password })
    })
        .then(res => res.json().then(data => {
            if (!res.ok) {
                alert("Ошибка: " + (data.error || "Неизвестная ошибка"));
                return;
            }

            alert("Сеанс создан");
            fetchUserSessions();
            closeCreateSessionModal();
        }))
    .catch(err => alert("Ошибка создания сеанса: " + err.message));

    closeCreateSessionModal();
}

function joinSession(sessionId, isPrivate) {
    const token = localStorage.getItem("token");
    const password = isPrivate ? prompt("Введите пароль") : null;

    fetch(`${API_URL}/join`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ sessionId, password })
    })
        .then(res => res.json())
        .then(data => {
            if (data.error) throw new Error(data.error);
            sessionStorage.setItem('sessionId', sessionId);
            sessionStorage.setItem('userId', data.userId);
            sessionStorage.setItem('username', data.username);
            sessionStorage.setItem('isTemporary', data.isTemporary);

            window.location.href = `draw.html?sessionId=${sessionId}`;
        })
        .catch(err => alert("Ошибка: " + err.message));
}

function startSession(sessionId) {
    const token = localStorage.getItem("token");

    fetch(`${API_URL}/start?sessionId=${sessionId}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`
        },
    })
        .then(res => {
            if (!res.ok) {
                return res.json().then(data => { throw new Error(data.message || "Ошибка сервера"); });
            }
            return res.json();
        })
        .then(() => {
            alert("Сеанс запущен");
            fetchUserSessions();
        })
        .catch(err => alert("Ошибка запуска сеанса: " + err.message));
}

function deleteSession(sessionId) {
    const token = localStorage.getItem("token");

    fetch(`${API_URL}/delete?sessionId=${sessionId}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`
        },
    })
        .then(res => res.json())
        .then(() => {
            alert("Сеанс удалён");
            fetchUserSessions();
        })
        .catch(err => alert("Ошибка удаления сеанса: " + err.message));
}

function openEditSessionModal(name, isPrivate, sessionId) {
    const sessionNameInput = document.getElementById("editSessionName");
    sessionNameInput.placeholder = name;
    sessionNameInput.value = name;
    const isPrivateCheckbox = document.getElementById("editIsPrivate");
    isPrivateCheckbox.checked = isPrivate;
    const passwordField = document.getElementById("editPassword");
    passwordField.style.display = isPrivate ? "block" : "none";
    passwordField.type = "text";
    passwordField.value = "";
    isPrivateCheckbox.onchange = function () {
        passwordField.style.display = isPrivateCheckbox.checked ? "block" : "none";
    };
    document.getElementById("editSessionModal").setAttribute("data-session-id", sessionId);
    document.getElementById("editSessionModal").style.display = "block";
}

function closeEditSessionModal() {
    document.getElementById("editSessionModal").style.display = "none";
}

function updateSession() {
    const token = localStorage.getItem("token");

    const sessionId = document.getElementById("editSessionModal").getAttribute("data-session-id");
    const sessionName = document.getElementById("editSessionName").value.trim();
    const isPrivate = document.getElementById("editIsPrivate").checked;
    const password = document.getElementById("editPassword").value.trim();

    console.log("Отправка запроса с sessionId:", sessionId);

    if (!sessionName) {
        alert("Введите название сеанса.");
        return;
    }

    if (isPrivate && !password) {
        alert("Введите пароль для приватного сеанса");
        return;
    }

    fetch(`${API_URL}/update`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ sessionId, sessionName, isPrivate, password })
    })
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                alert("Ошибка: " + data.error);
            } else {
                alert("Настройки обновлены");
                closeEditSessionModal();
                fetchUserSessions();
            }
        })
        .catch(err => alert("Ошибка: " + err.message));
}

function showQrForSession(sessionId) {
    fetch(`${API_URL}/get-qr?sessionId=${sessionId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem("token")}` }
    })
        .then(res => res.json())
        .then(data => {
            const ip = location.hostname;
            const port = location.port;
            const joinUrl = `http://${ip}:${port}/pages/qr-join.html?sessionId=${sessionId}`;
            const shareText = `Присоединяйся к моему сеансу рисования! ${joinUrl}`;
            const encodedText = encodeURIComponent(shareText);

            document.getElementById('qrImage').src = data.qrCode;

            const shareContainer = document.getElementById('shareButtons');
            shareContainer.innerHTML = `
                <a href="https://t.me/share/url?url=${encodedText}" target="_blank" class="btn btn-primary btn-sm">Telegram</a>
                <a href="https://wa.me/?text=${encodedText}" target="_blank" class="btn btn-success btn-sm">WhatsApp</a>
                <a href="https://twitter.com/intent/tweet?text=${encodedText}" target="_blank" class="btn btn-info btn-sm">X (Twitter)</a>
                <button onclick="navigator.clipboard.writeText('${joinUrl}'); alert('Ссылка скопирована!')" class="btn btn-secondary btn-sm">Копировать</button>`;
            document.getElementById('qrModal').style.display = 'flex';
        })
        .catch(err => alert("Ошибка получения QR: " + err.message));
}



