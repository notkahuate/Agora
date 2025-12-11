document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    try {
        const response = await fetch("http://localhost:3000/api/auth/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.message || "Error al iniciar sesión");
            return;
        }

        // Guardar token y usuario en localStorage
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));

        // Redirigir por rol
        switch (data.user.rol) {
            case "super_admin":
                window.location.href = "superadmin-dashboard.html";
                break;

            case "auditor":
                window.location.href = "auditor-dashboard.html";
                break;

            case "usuario":
                window.location.href = "usuario-dashboard.html";
                break;

            default:
                alert("Rol desconocido, consulta al administrador.");
                break;
        }

    } catch (error) {
        console.error("Error:", error);
        alert("Hubo un problema al conectar con el servidor.");
    }
});
