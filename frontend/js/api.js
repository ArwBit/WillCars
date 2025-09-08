const API_URL = 'http://localhost:3000/api';

const api = {
    // Realizar peticiones HTTP
    async request(endpoint, method = 'GET', body = null, requiresAuth = false) {
        const headers = {
            'Content-Type': 'application/json',
        };
        if (requiresAuth) {
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('No se encontró el token de autenticación');
            }
            headers['Authorization'] = `Bearer ${token}`;
        }

        const config = { method, headers };
        if (body) {
            config.body = JSON.stringify(body);
        }

        const response = await fetch(`${API_URL}${endpoint}`, config);
        if (!response.ok) {
            if (response.status === 401) {
                localStorage.removeItem('token');
                localStorage.removeItem('currentUser');
                window.location.href = '/login.html';
                throw new Error('Sesión expirada. Por favor, inicia sesión.');
            }
            const error = await response.json();
            throw new Error(error.error || 'Error en la solicitud');
        }
        return response.json();
    },

    // Productos
    async getProducts(page = 1, limit = 10, search = '') {
        return this.request(`/products?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`);
    },

    async getProduct(code) {
        return this.request(`/products/${code}`);
    },

    async createProduct(product, imageFile) {
        const formData = new FormData();
        for (const key in product) {
            formData.append(key, product[key]);
        }
        if (imageFile) {
            formData.append('image', imageFile);
        }
        const response = await fetch(`${API_URL}/products`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
            },
            body: formData,
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Error al crear producto');
        }
        return response.json();
    },

    async updateProduct(code, product, imageFile) {
        const formData = new FormData();
        for (const key in product) {
            formData.append(key, product[key]);
        }
        if (imageFile) {
            formData.append('image', imageFile);
        }
        const response = await fetch(`${API_URL}/products/${code}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
            },
            body: formData,
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Error al actualizar producto');
        }
        return response.json();
    },

    async deleteProduct(code) {
        return this.request(`/products/${code}`, 'DELETE', null, true);
    },

    // Usuarios
    async getUsers() {
        return this.request('/users', 'GET', null, true);
    },

    // Pedidos
    async getOrders(page = 1, limit = 10) {
        return this.request(`/orders?page=${page}&limit=${limit}`, 'GET', null, true);
    },

    async createOrder(order) {
        return this.request('/orders', 'POST', order, true);
    },

    // Ventas
    async getSales() {
        return this.request('/sales', 'GET', null, true);
    },

    // Configuraciones
    async getSettings() {
        return this.request('/settings', 'GET', null, true);
    },

    async updateSettings(settings) {
        return this.request('/settings', 'PUT', settings, true);
    },
};

export default api;