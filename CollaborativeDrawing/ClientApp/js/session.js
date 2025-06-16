let selectedUserId = null;
const API_URL = `http://${window.location.hostname}:5116/session`;

function fetchSessions() {
    fetch(`${API_URL}/list`)
        .then(res => res.json())
        .then(sessions => {
            allSessions = sessions.filter(s => s.isActive); 
            renderSessions(allSessions);
        })
        .catch(err => alert("Ошибка загрузки сеансов: " + err.message));
}

function renderSessions(sessions) {
    const sessionContainer = document.getElementById("sessions");
    sessionContainer.innerHTML = "";

    sessions.forEach(s => {
        let sessionCard = document.createElement("div");
        sessionCard.classList.add("session-card", "p-3", "border", "mb-3");

        let title = document.createElement("h3");
        title.textContent = s.name;
        title.classList.add("text-primary", "mb-2");

        let status = document.createElement("p");
        status.innerHTML = `<strong>Статус:</strong> ${s.isPrivate ? '<span class="text-danger">Приватный</span>' : '<span class="text-success">Открытый</span>'}`;

        let joinButton = document.createElement("button");
        joinButton.textContent = "Присоединиться";
        joinButton.classList.add("btn-custom", "w-100", "mt-2");
        joinButton.onclick = () => joinSession(s.id, s.isPrivate);

        sessionCard.appendChild(title);
        sessionCard.appendChild(status);
        sessionCard.appendChild(joinButton);

        sessionContainer.appendChild(sessionCard);
    });
}

function filterSessions() {
    const searchQuery = document.getElementById("searchInput").value.toLowerCase();
    const filterValue = document.getElementById("filterSelect").value;

    let filteredSessions = allSessions.filter(s =>
        s.name.toLowerCase().includes(searchQuery) &&
        (filterValue === "all" || (filterValue === "private" && s.isPrivate) || (filterValue === "public" && !s.isPrivate))
    );

    renderSessions(filteredSessions);
}

function joinSession(sessionId, isPrivate) {
    let token = localStorage.getItem("token");
    let password = isPrivate ? prompt("Введите пароль") : null;
    const tempUserId = sessionStorage.getItem('userId');
    let username = null;

    if (!token && !tempUserId) {
        username = prompt("Введите ваше имя");
        if (!username || username.trim() === "") {
            alert("Имя не может быть пустым");
            return;
        }
    }

    if (!token && tempUserId) {
        username = sessionStorage.getItem('username');
    }

    fetch(`${API_URL}/join`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sessionId, username, password, tempUserId })
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

function removeUser(sessionId, userId) {
    let hostId = sessionStorage.getItem('userId');
    let token = localStorage.getItem("token");

    fetch(`${API_URL}/removeUser`, {
        method: 'POST',
        body: JSON.stringify({ sessionId, hostId, userId }),
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    })
        .then(res => {
        if (!res.ok) {
            return res.text().then(text => { throw new Error(text) });
        }
        return res.json();
        })
        .then(data => {
            console.log(data.message);
            fetchSessionUsers(); 
            connection.invoke("RemoveUserFromSession", sessionId, userId)
                .catch(err => console.error("Ошибка при отключении пользователя:", err));
            chatConnection.invoke("RemoveUserFromChat", sessionId, userId)
                .catch(err => console.error("Ошибка при удалении из чата:", err));
        })
        .catch(err => console.error("Ошибка удаления пользователя:", err));
}

function leaveSession() {
    let sessionId = urlParams.get('sessionId');
    let userId = sessionStorage.getItem('userId');
    let userName = sessionStorage.getItem('username');

    connection.invoke("LeaveSession", sessionId, userId)
        .then(() => {
            sessionStorage.clear();
            window.location.href = "index.html";
        })
        .catch(err => console.error("Ошибка при выходе из сессии:", err));

    connection.invoke("NotifyUserLeft", sessionId, userName)
        .catch(err => console.error("Ошибка отправки уведомления о выходе:", err));
    

    if (chatConnection && chatConnection.state === "Connected") {
        chatConnection.invoke("LeaveSession", sessionId)
            .catch(err => console.error("Ошибка при выходе из чата:", err));
    }
}

function endSession() {
    const sessionId = sessionStorage.getItem("sessionId");
    if (!sessionId) return alert("Сессия не найдена!");

    const token = localStorage.getItem("token");

    fetch(`${API_URL}/end?sessionId=${sessionId}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
    })
        .then(res => {
            if (!res.ok) {
                return res.text().then(text => { throw new Error(text) });
            }
            return res.json(); 
        })
        .then(() => {
            connection.invoke("EndSession", sessionId)
                .catch(err => console.error("Ошибка при вызове EndSession:", err));
            sessionStorage.clear();
            window.location.href = "index.html";
        })
        .catch(err => alert("Ошибка остановки сеанса: " + err.message));
}


function fetchSessionUsers() {
    let sessionId = urlParams.get('sessionId');

    fetch(`${API_URL}/users?sessionId=${sessionId}`)
        .then(res => res.json())
        .then(users => {
            let userList = document.getElementById('user-list');
            if (!userList) return;

            console.log("Загруженные пользователи:", users);

            userList.innerHTML = users.map(user => {
                let statusIcon = {
                    active: '🟢',
                    inactive: '🟡'
                }[user.status];

                return `
                <li class="user-item" data-user-id="${user.id}">
                    ${statusIcon} <span class="username">${user.username}</span>
                    ${user.temporary ? "<span class='guest'>(Гость)</span>" : ""}
                    <button class="remove-user" onclick="event.stopPropagation(); removeUser('${sessionId}', '${user.id}')">❌</button>
                </li>`;
            }).join('');
        })
        .catch(err => console.error("Ошибка загрузки пользователей:", err));
}

function highlightUserElements(userId) {
    if (selectedUserId === userId) {
        layer.getChildren().forEach(element => {
            element.filters([]);
            element.cache();
        });
        selectedUserId = null;
    } else {
        layer.getChildren().forEach(element => {
            if (element.getAttr('userid') === userId) {
                element.filters([Konva.Filters.Blur, Konva.Filters.Emboss]); 
                element.cache();
            }
        });
        selectedUserId = userId;
    }
    layer.batchDraw();  
}

async function checkIfHost(sessionId) {
    const token = localStorage.getItem("token");
    const userId = sessionStorage.getItem("userId"); 

    if (!token) return;

    try {
        const res = await fetch(`${API_URL}/session-info?sessionId=${sessionId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!res.ok) {
            throw new Error(await res.text());
        }

        const sessionData = await res.json();

        if (sessionData.hostId === userId) {
            document.getElementById("endSessionButton").style.display = "block";
        }
    } catch (error) {
        console.error("Ошибка проверки хоста:", error);
    }
}
