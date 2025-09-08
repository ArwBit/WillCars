const API_URL = 'http://localhost:3000/api';

document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM cargado, verificando admin...');
    try {
        const isAdmin = await verifyAdmin();
        if (isAdmin && window.location.pathname.includes('/admin/index.html')) {
            loadDashboard();
        }
    } catch (error) {
        console.error('Error al verificar admin:', error);
        showNotification('Error al cargar el dashboard', true);
    }
});

async function verifyAdmin() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login.html';
        return false;
    }
    try {
        const response = await fetchWithToken(`${API_URL}/auth/verify`);
        if (!response.ok) {
            window.location.href = '/login.html';
            return false;
        }
        const data = await response.json();
        return data.role === 'admin';
    } catch (error) {
        console.error('Error verificando admin:', error);
        window.location.href = '/login.html';
        return false;
    }
}

async function loadDashboard() {
    try {
        const response = await fetchWithToken(`${API_URL}/dashboard`);
        if (!response.ok) {
            throw new Error('Error al cargar datos del dashboard');
        }
        const data = await response.json();
        console.log('Datos del dashboard:', data);
        // Renderizar datos del dashboard
    } catch (error) {
        console.error('Error al cargar dashboard:', error);
        showNotification('Error al cargar el dashboard', true);
    }
}

async function fetchWithToken(url, options = {}) {
    let token = localStorage.getItem('token');
    options.headers = { ...options.headers, Authorization: `Bearer ${token}` };
    try {
        const response = await fetch(url, options);
        if (response.status === 401) {
            token = await refreshToken();
            if (token) {
                options.headers.Authorization = `Bearer ${token}`;
                return await fetch(url, options);
            }
        }
        return response;
    } catch (error) {
        console.error('Error en fetchWithToken:', error);
        throw error;
    }
}

async function refreshToken() {
    try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
            throw new Error('No refresh token available');
        }
        const response = await fetch(`${API_URL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken })
        });
        if (!response.ok) {
            throw new Error('Error al renovar token');
        }
        const data = await response.json();
        localStorage.setItem('token', data.token);
        return data.token;
    } catch (error) {
        console.error('Error al renovar token:', error);
        window.location.href = '/login.html';
        return null;
    }
}

function showNotification(message, isError = false) {
    const notification = document.getElementById('notification');
    if (notification) {
        notification.textContent = message;
        notification.className = isError ? 'error' : 'success';
        notification.style.display = 'block';
        setTimeout(() => {
            notification.style.display = 'none';
        }, 3000);
    }
}