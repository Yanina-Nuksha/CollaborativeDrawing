const API_URL = `http://${window.location.hostname}:5116/auth`;

function toggleForms() {
    document.getElementById("loginForm").style.display =
        document.getElementById("loginForm").style.display === "none" ? "block" : "none";
    document.getElementById("registerForm").style.display =
        document.getElementById("registerForm").style.display === "none" ? "block" : "none";
}

async function register() {
    const username = document.getElementById("registerUsername").value.trim();
    const password = document.getElementById("registerPassword").value.trim();

    if (!username || !password) {
        alert("Введите имя пользователя и пароль.");
        return;
    }

    if (!isValidPassword(password)) {
        alert("Пароль должен быть не менее 8 символов и содержать хотя бы одну букву и одну цифру.");
        return;
    }

    const response = await fetch(`${API_URL}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
    });

    const data = await response.json();
    if (response.ok) {
        alert("Регистрация успешна! Теперь войдите.");
        toggleForms();
    } else {
        alert("Ошибка: " + data.error);
    }
}

function isValidPassword(password) {
    const minLength = password.length >= 8;
    const hasLetter = /[a-zA-Zа-яА-Я]/.test(password);
    const hasDigit = /\d/.test(password);
    return minLength && hasLetter && hasDigit;
}

async function login() {
    const username = document.getElementById("loginUsername").value.trim();
    const password = document.getElementById("loginPassword").value.trim();

    const response = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
    });

    const data = await response.json();
    if (response.ok) {
        localStorage.setItem("token", data.token);
        alert("Вход успешен!");
        window.location.href = "personal_account.html"; 
    } else {
        alert("Ошибка: " + data.error);
    }
}
