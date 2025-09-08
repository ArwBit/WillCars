// pedidos.js
let currentOrderPage = 1;
const orderLimit = 5;
// Asegúrate que esta URL es correcta y apunte a tu backend
//const API_URL = 'http://localhost:3000/api'; // Definir API_URL si no está ya definida globalmente

// --- Función para renderizar una fila de pedido (o actualizar si ya existe) ---
function renderOrderRow(order) {
    const tableBody = document.getElementById('ordersTableBody');
    let row = document.querySelector(`tr[data-order-id="${order.id}"]`); // Intenta encontrar la fila existente

    if (!row) {
        // Si la fila no existe, créala y la inserta al principio para los pedidos nuevos
        row = tableBody.insertRow(0);
        row.dataset.orderId = order.id; // Asigna el ID del pedido a la fila HTML
    }

    // Define el HTML interno de la fila. Esto actualizará el contenido si la fila ya existía.
    row.innerHTML = `
        <td>${order.id}</td>
        <td>${order.user_email || 'Invitado'}</td>
        <td>$${parseFloat(order.total || 0).toFixed(2)}</td>
        <td>${order.contact_method}</td>
        <td>${order.email || '-'}</td>
        <td>${order.whatsapp || '-'}</td>
        <td>${order.status}</td>
        <td>${new Date(order.created_at).toLocaleDateString()}</td>
        <td>
            <div class="action-buttons">
                <button class="btn btn-edit" data-id="${order.id}" title="Editar">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-details" data-id="${order.id}" title="Detalles">
                    <i class="fas fa-eye"></i>
                </button>
            </div>
        </td>
    `;

    // Adjunta los event listeners a los botones de la fila recién creada o actualizada
    const editBtn = row.querySelector('.btn-edit');
    if (editBtn) {
        editBtn.addEventListener('click', handleEditOrder);
    }
    const detailsBtn = row.querySelector('.btn-details');
    if (detailsBtn) {
        detailsBtn.addEventListener('click', handleShowDetails);
    }
}

// --- Cargar pedidos desde la API ---
async function loadOrders(page = 1, limit = orderLimit, searchTerm = '') {
    const token = localStorage.getItem('token');
    if (!token) {
        showNotification('No estás autenticado. Por favor, inicia sesión.', true);
        setTimeout(() => window.location.href = '../admin/login.html', 2000);
        return;
    }
    try {
        const url = `${API_URL}/orders?page=${page}&limit=${limit}${searchTerm ? `&search=${encodeURIComponent(searchTerm)}` : ''}`;
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            if (response.status === 401) {
                localStorage.removeItem('token');
                showNotification('Sesión expirada. Por favor, inicia sesión nuevamente.', true);
                setTimeout(() => window.location.href = '../admin/login.html', 2000);
                return;
            }
            throw new Error('Error al cargar pedidos');
        }
        const data = await response.json();
        const tableBody = document.getElementById('ordersTableBody');
        tableBody.innerHTML = ''; // Limpiar la tabla antes de renderizar los nuevos datos

        // Renderiza cada pedido obtenido de la API usando la función renderOrderRow
        data.orders.forEach(order => renderOrderRow(order));

        document.getElementById('pageInfo').textContent = `Página ${data.page} de ${data.pages}`;
        document.getElementById('prevPage').disabled = data.page === 1;
        document.getElementById('nextPage').disabled = data.page === data.pages;
        currentOrderPage = data.page;

    } catch (error) {
        console.error('Error al cargar pedidos:', error);
        showNotification('Error al cargar pedidos', true);
    }
}

// --- Función para obtener los detalles de un pedido específico desde el backend (Esta es la que se usará para el modal) ---
async function fetchOrderDetails(orderId) {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            console.error('No token found. User not authenticated.');
            showNotification('No autorizado. Por favor, inicie sesión.', true);
            return null;
        }

        const response = await fetch(`${API_URL}/orders/${orderId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Error al obtener detalles del pedido: ${response.statusText}`);
        }

        const orderDetails = await response.json();
        console.log(`Detalles del pedido ${orderId} recibidos:`, orderDetails);
        return orderDetails;
    } catch (error) {
        console.error(`Error en fetchOrderDetails para el pedido ${orderId}:`, error);
        showNotification(`Error al cargar detalles del pedido: ${error.message}`, true);
        return null;
    }
}

// --- Mostrar detalles del pedido en un modal ---
async function showOrderDetailsModal(id) {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            showNotification('No autorizado. Por favor, inicia sesión.', true);
            return;
        }

        const response = await fetch(`${API_URL}/orders/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Error al obtener detalles del pedido ${id}`);
        }

        const order = await response.json();
        console.log('Detalles del pedido obtenidos:', order);

        // Llenar el modal con los datos generales del pedido
        document.getElementById('modalOrderId').textContent = order.id;
        document.getElementById('detail-id').textContent = order.id;
        document.getElementById('detail-user-email').textContent = order.user_email || 'Invitado';
        document.getElementById('detail-total').textContent = `$${parseFloat(order.total || 0).toFixed(2)}`; // Asegurar que total sea un número
        document.getElementById('detail-contact-method').textContent = order.contact_method;
        document.getElementById('detail-email').textContent = order.email || '-';
        document.getElementById('detail-whatsapp').textContent = order.whatsapp || '-';
        document.getElementById('detail-status').textContent = order.status;
        document.getElementById('detail-created-at').textContent = new Date(order.created_at).toLocaleDateString();

        const itemsTableBody = document.getElementById('orderDetailsItemsTableBody');
        itemsTableBody.innerHTML = ''; // Limpiar la tabla de ítems anterior

        if (order.items && order.items.length > 0) {
            order.items.forEach(item => {
                const itemRow = itemsTableBody.insertRow();
                
                // Columna 1: Código (Ya funciona)
                itemRow.insertCell(0).textContent = item.product_code || item.product_id || '-';
                
                // Columna 2: Descripción (Requiere datos correctos desde el backend/DB)
                itemRow.insertCell(1).textContent = item.product_name || 'N/A';
                
                // Columna 3: Cantidad (Ya funciona)
                itemRow.insertCell(2).textContent = item.quantity || 0;
                
                // Columna 4: Precio Unitario (¡AHORA SÍ USA item.ref, que es tu precio unitario del backend!)
                itemRow.insertCell(3).textContent = `$${parseFloat(item.ref || 0).toFixed(2)}`;
                
                // Columna 5: Ref (Ya que item.ref es el Precio Unitario, aquí ponemos el código del producto como referencia)
                itemRow.insertCell(4).textContent = item.product_code || '-'; 
                
                // Columna 6: Subtotal (Movido a esta posición)
                itemRow.insertCell(5).textContent = `$${parseFloat(item.subtotal || 0).toFixed(2)}`;
                
                // Columna 7: Notas (Requiere datos correctos desde el backend/DB)
                itemRow.insertCell(6).textContent = item.description || '-';
            });
        } else {
            const noItemsRow = itemsTableBody.insertRow();
            const noItemsCell = noItemsRow.insertCell(0);
            noItemsCell.colSpan = 6; // Cubrir todas las columnas de la tabla de ítems
            noItemsCell.textContent = 'No hay ítems para este pedido.';
            noItemsCell.classList.add('text-center');
        }

        // Mostrar el modal (asume que tienes el modal HTML y Bootstrap JS cargados)
        const orderDetailsModalElement = document.getElementById('orderDetailsModal');
        const orderDetailsModal = new bootstrap.Modal(orderDetailsModalElement);
        orderDetailsModal.show();

    } catch (error) {
        console.error('Error al mostrar detalles del pedido:', error);
        showNotification(`Error: ${error.message}`, true);
    }
}

// --- Editar pedido (carga los datos en el modal de edición) ---
async function editOrder(id) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/orders/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Error al obtener pedido para edición');
        const order = await response.json();
        document.getElementById('orderId').value = order.id;
        document.getElementById('orderStatus').value = order.status;
        new bootstrap.Modal(document.getElementById('editOrderModal')).show();
    } catch (error) {
        console.error('Error al cargar pedido para edición:', error);
        showNotification('Error al cargar pedido para edición', true);
    }
}

// --- Función auxiliar para manejar el click en el botón de edición ---
async function handleEditOrder(event) {
    const orderId = event.currentTarget.dataset.id;
    editOrder(orderId);
}

// --- Función auxiliar para manejar el click en el botón de detalles ---
async function handleShowDetails(event) {
    const orderId = event.currentTarget.dataset.id;
    // Ahora esta función solo llama a showOrderDetailsModal
    showOrderDetailsModal(orderId);
}

// --- Guardar estado del pedido ---
document.getElementById('saveOrderBtn').addEventListener('click', async () => {
    const id = document.getElementById('orderId').value;
    const status = document.getElementById('orderStatus').value;
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/orders/${id}/status`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status })
        });
        if (!response.ok) throw new Error('Error al actualizar estado');
        showNotification('Estado actualizado correctamente', false);
        bootstrap.Modal.getInstance(document.getElementById('editOrderModal')).hide();
        loadOrders(currentOrderPage); // Recargar la página actual para reflejar el cambio
    } catch (error) {
        console.error('Error al actualizar estado:', error);
        showNotification('Error al actualizar estado', true);
    }
});

// --- Evento de búsqueda ---
document.getElementById('searchInput').addEventListener('input', () => {
    const searchTerm = document.getElementById('searchInput').value.trim();
    loadOrders(1, orderLimit, searchTerm);
});

// --- Eventos de paginación ---
document.getElementById('prevPage').addEventListener('click', () => {
    if (currentOrderPage > 1) loadOrders(currentOrderPage - 1);
});

document.getElementById('nextPage').addEventListener('click', () => {
    loadOrders(currentOrderPage + 1);
});

// --- Funciones para la UI (sidebar, dark mode, logout) - Asumen que están en un script global o admin.js ---
// Asegúrate de que estas funciones (toggleSidebar, toggleDarkMode, logout, verifyAdmin, showNotification)
// estén definidas en otro archivo (como admin.js o un script global) o definelas aquí si solo las usas en pedidos.js
// Por ahora, asumimos que están en otro lugar, como indicabas en el comentario original.

document.querySelector('.toggle-btn')?.addEventListener('click', () => {
    document.querySelector('.sidebar').classList.toggle('collapsed');
    document.querySelector('.main-content').classList.toggle('collapsed');
});

document.getElementById('darkModeToggle')?.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', document.body.classList.contains('dark-mode') ? 'enabled' : 'disabled');
});

if (localStorage.getItem('darkMode') === 'enabled') {
    document.body.classList.add('dark-mode');
}

function logout() {
    localStorage.removeItem('token');
    window.location.href = '../admin/login.html';
}

// Asegúrate de que `showNotification` y `verifyAdmin` estén definidas.
// Si no están en un archivo global como `admin.js`, podrías tener que definirlas aquí:
/*
function showNotification(message, isError = false) {
    const notification = document.getElementById('notification');
    if (!notification) {
        console.warn('Elemento #notification no encontrado');
        return;
    }
    notification.textContent = message;
    notification.classList.remove('error');
    if (isError) notification.classList.add('error');
    notification.classList.add('show');
    setTimeout(() => notification.classList.remove('show'), 3000);
}

// Ejemplo de verifyAdmin si no está en admin.js. DEBERÍA VENIR DE ADMIN.JS
async function verifyAdmin() {
    const token = localStorage.getItem('token');
    if (!token) return false;
    try {
        const response = await fetch(`${API_URL}/auth/verify-admin`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return response.ok;
    } catch (error) {
        console.error('Error verifying admin:', error);
        return false;
    }
}
*/


// --- Carga inicial y configuración de WebSockets ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM cargado, verificando admin...');
    // verifyAdmin y showNotification deben estar definidos en admin.js o un script global
    if (typeof verifyAdmin === 'function' && typeof showNotification === 'function') {
        if (await verifyAdmin()) {
            console.log('Admin verificado, cargando pedidos...');
            loadOrders();
        } else {
            console.log('No admin, redirigiendo a admin/login.html...');
            // Puedes redirigir aquí o simplemente no cargar los pedidos
            window.location.href = '../admin/login.html';
        }
    } else {
        console.error('Funciones verifyAdmin o showNotification no están definidas. Asegúrate de que admin.js esté cargado correctamente.');
        // Si no existen, redirige para evitar errores
        window.location.href = '../admin/login.html';
    }

    // Inicializar Socket.IO y listeners
    // Asegúrate de que el script de Socket.IO esté cargado en tu HTML
    // <script src="http://localhost:3000/socket.io/socket.io.js"></script>
    const socket = io('http://localhost:3000', {
        auth: {
            token: localStorage.getItem('token')
        },
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
    });

    socket.on('connect', () => {
        console.log('Conectado a WebSocket');
        showNotification('Conectado al servidor en tiempo real', false);
    });

    socket.on('connect_error', (error) => {
        console.error('Error de conexión WebSocket:', error);
        showNotification(`Error de conexión WebSocket: ${error.message}`, true);
    });

    socket.on('reconnect_attempt', () => {
        console.log('Intentando reconectar a WebSocket...');
    });

    socket.on('reconnect', () => {
        showNotification('Reconectado al servidor', false);
    });

    // --- Lógica para el nuevo pedido en tiempo real ---
    socket.on('newOrder', (data) => {
        showNotification(`Nuevo pedido #${data.order.id} recibido`, false);
        console.log('Nuevo pedido recibido vía WebSocket:', data.order);

        // Si el usuario está viendo la primera página, insertamos el pedido directamente.
        if (currentOrderPage === 1) {
            renderOrderRow(data.order); // Usamos la función refactorizada para añadir la fila
            // Si al agregar el pedido superamos el límite de elementos por página,
            // eliminamos el último para mantener la coherencia visual.
            const tableBody = document.getElementById('ordersTableBody');
            if (tableBody.children.length > orderLimit) {
                tableBody.removeChild(tableBody.lastChild);
            }
        } else {
            // Si el usuario no está en la primera página, simplemente notificamos.
            // Una recarga automática podría ser molesta si el usuario está en medio de algo.
            // Puedes decidir si quieres un loadOrders(currentOrderPage) aquí o solo la notificación.
            console.log("Nuevo pedido recibido pero no en la página actual. Recargue para verlo.");
        }
        // Si tienes una función para actualizar el contador de notificaciones, llámala aquí:
        // updateNotificationBadge();
    });
});