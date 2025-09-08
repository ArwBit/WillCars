const API_URL = 'http://localhost:3000/api';

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    console.log('Formulario de login enviado');
    const email = document.getElementById('email').value.toLowerCase();
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('errorMessage');
    errorMessage.style.display = 'none';
    try {
        console.log('Enviando solicitud a /auth/login');
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();
        console.log('Respuesta recibida:', data);
        if (!response.ok) {
            errorMessage.textContent = data.error || 'Error al iniciar sesión';
            errorMessage.style.display = 'block';
            return;
        }
        localStorage.setItem('token', data.token);
        localStorage.setItem('currentUser', JSON.stringify({ email: data.user.email, role: data.user.role }));
        console.log('Token y currentUser guardados:', { token: data.token, currentUser: data.user });
        if (data.user.role === 'admin') {
            console.log('Redirigiendo a index.html');
            window.location.href = 'index.html';
        } else {
            console.log('Redirigiendo a buscador.html');
            window.location.href = '../buscador.html';
        }
    } catch (error) {
        console.error('Error en login:', error);
        errorMessage.textContent = 'Error al conectar con el servidor. Verifica que el backend esté corriendo.';
        errorMessage.style.display = 'block';
    }
});