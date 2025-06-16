function checkAuth() {
    const token = localStorage.getItem("token");
    const accountLink = document.getElementById("accountLink");
    const logoutItem = document.getElementById("logoutItem");

    if (token) {
        accountLink.textContent = "Личный кабинет";
        accountLink.href = "personal_account.html"; 
        logoutItem.classList.remove("d-none"); 
    } else {
        accountLink.textContent = "Авторизация";
        accountLink.href = "auth.html";
        logoutItem.classList.add("d-none"); 
    }
}

function logout() {
    localStorage.removeItem("token");
    sessionStorage.clear();
    window.location.reload();
}