document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Lógica de Modo Oscuro
    const themeToggle = document.getElementById('themeToggle');
    const currentTheme = localStorage.getItem('theme');

    if (currentTheme) {
        document.documentElement.setAttribute('data-theme', currentTheme);
    }

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            let theme = document.documentElement.getAttribute('data-theme');
            if (theme === 'dark') {
                document.documentElement.setAttribute('data-theme', 'light');
                localStorage.setItem('theme', 'light');
            } else {
                document.documentElement.setAttribute('data-theme', 'dark');
                localStorage.setItem('theme', 'dark');
            }
        });
    }

    // 2. RESPUESTA A TU PREGUNTA: Validación de Formulario de Login
    const loginForm = document.getElementById('loginForm');
    
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            let isValid = true;
            const usernameInput = document.getElementById('username');
            const passwordInput = document.getElementById('password');
            const userError = document.getElementById('userError');
            const passError = document.getElementById('passError');

            // Resetear errores
            userError.style.display = 'none';
            passError.style.display = 'none';

            if (!usernameInput.value.trim()) {
                userError.textContent = 'El usuario es requerido';
                userError.style.display = 'block';
                isValid = false;
            }

            if (!passwordInput.value.trim()) {
                passError.textContent = 'La contraseña es requerida';
                passError.style.display = 'block';
                isValid = false;
            }

            if (!isValid) {
                e.preventDefault(); // Evita que se envíe el formulario
            }
        });
    }
});