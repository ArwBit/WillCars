// frontend/js/admin.js
let currentProductPage = 1;
const productLimit = 11;
let isSubmitting = false;
let socket; // Declarado aquí, pero inicializado en verifyAdmin()
let searchTimeout;
let currentProveedorId = ''; // Variable para rastrear el filtro de proveedor activo

const supplierImagePaths = {
    'PS-00001': '/Uploads/Sanchez Import/fotos Sanchez Import',
    'MAS-i002': '/Uploads/Mastro/Fotos_Mastro',
    'ARG-C003': '/Uploads/ARG_importaciones/Fotos_ARG',
    'Mcc-i004': '/Uploads/MultiOcc/Fotos_MultiOcc',
    'Wic-A1': '/Uploads/WillCars Import/Fotos_WillCars',
    'kod-Sc001': '/Uploads/Kode import/Fotos_Kode'
};

// Alternar sidebar
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');
    if (sidebar && mainContent) {
        sidebar.classList.toggle('collapsed');
        mainContent.classList.toggle('collapsed');
        localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed') ? 'true' : 'false');
    }
}

// Aplicar estado de colapso al cargar
function applySidebarState() {
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');
    if (sidebar && mainContent) {
        const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
        if (isCollapsed) {
            sidebar.classList.add('collapsed');
            mainContent.classList.add('collapsed');
        } else {
            sidebar.classList.remove('collapsed');
            mainContent.classList.remove('collapsed');
        }
    }
}

// Alternar modo oscuro
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', document.body.classList.contains('dark-mode') ? 'true' : 'false');
}

// Aplicar modo oscuro al cargar
function applyDarkMode() {
    const darkMode = localStorage.getItem('darkMode');
    if (darkMode === 'true') {
        document.body.classList.add('dark-mode');
        localStorage.setItem('darkMode', 'true');
    } else {
        document.body.classList.remove('dark-mode');
        localStorage.setItem('darkMode', 'false');
    }
}

async function verifyAdmin() {
    console.log('Ejecutando verifyAdmin');
    const token = localStorage.getItem('token');
    console.log('Token inicial (verifyAdmin):', token ? 'Token presente (longitud ' + token.length + ')' : 'NO TOKEN EN LOCAL STORAGE'); // Más detalle aquí

    if (!token) {
        console.log('No token detectado, redirigiendo a login...');
        window.location.href = '../admin/login.html';
        return false;
    }
    try {
        const response = await fetch(`${API_URL}/auth/verify`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await response.json();
        if (!response.ok || !data.valid || data.role !== 'admin') {
            console.log('Verificación fallida o no admin:', data);
            localStorage.removeItem('token');
            localStorage.removeItem('currentUser');
            window.location.href = '../admin/login.html';
            return false;
        }
        console.log('Token verificado:', data);
        const userName = document.getElementById('userName');
        const userRole = document.getElementById('userRole');
        if (userName) userName.textContent = data.name || 'Administrador';
        if (userRole) userRole.textContent = data.role === 'admin' ? 'Super Admin' : 'Usuario';

        // Inicialización de Socket.IO
        if (!socket) {
            console.log('Inicializando Socket.IO...');
            socket = io('http://localhost:3000', {
                auth: { token: token },
                transports: ['websocket', 'polling']
            });
            
            socket.on('connect', () => {
                console.log('Conectado a WebSocket con ID:', socket.id);
            });
            
            socket.on('connect_error', (error) => {
                console.error('Error de conexión WebSocket:', error.message);
                if (error.message.includes('Autenticación requerida') || error.message.includes('Token inválido')) {
                    showNotification('Sesión expirada o token inválido para WebSocket. Por favor, inicia sesión.', true);
                    console.warn('Necesitas iniciar sesión para usar el WebSocket o tu token ha expirado.');
                }
            });
            
            socket.on('productUpdated', (data) => {
                console.log('Evento productUpdated recibido vía WebSocket:', data);
                showNotification(`Producto ${data.code} actualizado.`, false);
                if (window.location.pathname.includes('/admin/Productos.html')) {
                    loadProducts(currentProductPage, productLimit, document.getElementById('productSearchInput')?.value || '', currentProveedorId);
                }
            });
            
            socket.on('newOrder', (data) => {
                console.log('Evento newOrder recibido vía WebSocket:', data);
                showNotification(`¡Nuevo pedido! #${data.orderId} de ${data.userName}.`, false);
                if (window.location.pathname.includes('/admin/index.html')) {
                    loadStats();
                }
            });
        }
        return true;
    } catch (error) {
        console.error('Error verificando admin (catch):', error);
        localStorage.removeItem('token');
        localStorage.removeItem('currentUser');
        window.location.href = '../admin/login.html';
        return false;
    }
}

function showNotification(message, isError = false) {
    const notification = document.getElementById('notification');
    if (notification) {
        notification.textContent = message;
        notification.classList.remove('show', 'success', 'error');
        notification.classList.add('show', isError ? 'error' : 'success');
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    } else {
        console.warn('Elemento #notification no encontrado');
    }
}

function showConfirm(message, callback) {
    const confirmModal = document.getElementById('confirmModal');
    const confirmMessage = document.getElementById('confirmMessage');
    const confirmYes = document.getElementById('confirmYes');
    const confirmNo = document.getElementById('confirmNo');
    
    if (!confirmModal || !confirmMessage || !confirmYes || !confirmNo) {
        console.error('Elementos del modal de confirmación no encontrados');
        showNotification('Error: Modal de confirmación no encontrado', true);
        callback(false);
        return;
    }
    
    confirmMessage.textContent = message;
    const yesHandler = () => {
        callback(true);
        confirmYes.removeEventListener('click', yesHandler);
        confirmNo.removeEventListener('click', noHandler);
        $('#confirmModal').modal('hide');
    };
    const noHandler = () => {
        callback(false);
        confirmYes.removeEventListener('click', yesHandler);
        confirmNo.removeEventListener('click', noHandler);
        $('#confirmModal').modal('hide');
    };
    
    confirmYes.removeEventListener('click', yesHandler);
    confirmNo.removeEventListener('click', noHandler);
    confirmYes.addEventListener('click', yesHandler);
    confirmNo.addEventListener('click', noHandler);
    
    $('#confirmModal').modal('show');
}

async function loadStats() {
    try {
        console.log('Cargando estadísticas...');
        const token = localStorage.getItem('token');
        console.log('Token en loadStats:', token);
        
        if (!token) {
            showNotification('No autenticado. Por favor, inicia sesión.', true);
            setTimeout(() => window.location.href = '../admin/login.html', 2000);
            return;
        }
        
        const response = await fetch(`${API_URL}/stats`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        console.log('Respuesta /api/stats:', response.status, response.statusText);
        if (!response.ok) {
            if (response.status === 401) {
                localStorage.removeItem('token');
                localStorage.removeItem('currentUser');
                showNotification('Sesión expirada. Por favor, inicia sesión nuevamente.', true);
                setTimeout(() => window.location.href = '../admin/login.html', 2000);
                return;
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const stats = await response.json();
        console.log('Estadísticas recibidas:', stats);
        
        const elements = {
            totalProducts: document.getElementById('totalProducts'),
            totalUsers: document.getElementById('totalUsers'),
            totalOrders: document.getElementById('totalOrders'),
            totalSales: document.getElementById('totalSales')
        };
        
        for (const [key, element] of Object.entries(elements)) {
            if (!element) {
                console.error(`Elemento ${key} no encontrado en el DOM`);
                return;
            }
        }

        elements.totalProducts.textContent = stats.totalProducts || '0';
        elements.totalUsers.textContent = stats.totalUsers || '0';
        elements.totalOrders.textContent = stats.totalOrders || '0';
        elements.totalSales.textContent = `$${parseFloat(stats.totalSales || 0).toFixed(2)}`;

        const salesChartCanvas = document.getElementById('salesChart')?.getContext('2d');
        const productsChartCanvas = document.getElementById('productsChart')?.getContext('2d');

        if (window.salesChart instanceof Chart) {
            console.log('Destruyendo gráfico existente: salesChart');
            window.salesChart.destroy();
        }
        
        if (window.productsChart instanceof Chart) {
            console.log('Destruyendo gráfico existente: productsChart');
            window.productsChart.destroy();
        }

        if (salesChartCanvas && typeof Chart !== 'undefined') {
            console.log('Creando nuevo gráfico: salesChart');
            window.salesChart = new Chart(salesChartCanvas, {
                type: 'line',
                data: {
                    labels: stats.salesData?.labels || ['Ene', 'Feb', 'Mar'],
                    datasets: [{
                        label: 'Ventas Mensuales',
                        data: stats.salesData?.values || [0, 0, 0],
                        borderColor: '#3a86ff',
                        fill: false
                    }]
                }
            });
        } else {
            console.warn('salesChartCanvas o Chart no disponible');
        }
        
        if (productsChartCanvas && typeof Chart !== 'undefined') {
            console.log('Creando nuevo gráfico: productsChart');
            window.productsChart = new Chart(productsChartCanvas, {
                type: 'bar',
                data: {
                    labels: stats.popularProducts?.labels || ['Producto 1', 'Producto 2'],
                    datasets: [{
                        label: 'Productos Populares',
                        data: stats.popularProducts?.values || [0, 0],
                        backgroundColor: '#3a86ff'
                    }]
                }
            });
        } else {
            console.warn('productsChartCanvas o Chart no disponible');
        }
    } catch (error) {
        console.error('Error al cargar estadísticas:', error);
        showNotification('Error al cargar estadísticas', true);
    }
}

function logout() {
    console.log('Ejecutando logout');
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');
    console.log('localStorage limpio:', localStorage.getItem('token'), localStorage.getItem('currentUser'));
    window.location.href = '../admin/login.html';
}

function openModal() {
    console.log('Ejecutando openModal');
    const modalLabel = document.getElementById('productModalLabel');
    const productForm = document.getElementById('productForm');
    const imagePreview = document.getElementById('imagePreview');
    const originalProductCode = document.getElementById('originalProductCode');
    const productCodeInput = document.getElementById('productCode');
    
    if (!modalLabel || !productForm || !imagePreview || !originalProductCode || !productCodeInput) {
        console.error('Elementos necesarios no encontrados:', {
            modalLabel: !!modalLabel,
            productForm: !!productForm,
            imagePreview: !!imagePreview,
            originalProductCode: !!originalProductCode,
            productCodeInput: !!productCodeInput
        });
        showNotification('Error: No se pudo abrir el formulario', true);
        return;
    }

    modalLabel.textContent = 'Nuevo Producto';
    productForm.reset();
    productForm.dataset.code = '';
    imagePreview.style.display = 'none';
    imagePreview.src = '#';
    originalProductCode.value = '';
    productCodeInput.disabled = false;

    productForm.removeEventListener('submit', window.saveProductHandler);
    window.saveProductHandler = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (isSubmitting) {
            console.log('Envío bloqueado, ya en proceso');
            return;
        }
        isSubmitting = true;
        const submitButton = productForm.querySelector('button[type="submit"]');
        console.log('Manejando submit del formulario');
        if (submitButton) submitButton.disabled = true;
        try {
            await saveProduct(e);
        } catch (error) {
            console.error('Error en submit:', error);
            showNotification(`Error: ${error.message}`, true);
        } finally {
            isSubmitting = false;
            if (submitButton) submitButton.disabled = false;
        }
    };
    
    productForm.addEventListener('submit', window.saveProductHandler, { once: false });
    try {
        console.log('Intentando abrir el modal con Bootstrap...');
        const $modal = $('#productModal');
        $modal
            .off('shown.bs.modal')
            .off('hidden.bs.modal')
            .on('shown.bs.modal', function () {
                console.log('Modal completamente abierto');
                loadProveedores();
                productCodeInput.focus();
            })
            .on('hidden.bs.modal', function () {
                console.log('Modal completamente cerrado');
                productForm.reset();
                productForm.dataset.code = '';
                imagePreview.style.display = 'none';
                imagePreview.src = '#';
                productCodeInput.disabled = false;
            })
            .modal('show');
        console.log('Modal debería estar abriéndose...');
    } catch (error) {
        console.error('Error al abrir el modal con Bootstrap:', error.message, error.stack);
        showNotification('Error al abrir el formulario: ' + error.message, true);
    }
}

function closeModal() {
    console.log('closeModal ejecutado');
    $('#productModal').modal('hide');
    const productForm = document.getElementById('productForm');
    const productCode = document.getElementById('productCode');
    const imagePreview = document.getElementById('imagePreview');
    
    if (productForm) productForm.reset();
    if (productCode) productCode.disabled = false;
    if (productForm) productForm.dataset.code = '';
    if (imagePreview) {
        imagePreview.style.display = 'none';
        imagePreview.src = '#';
    }
}

async function loadProveedores() {
    try {
        const token = localStorage.getItem('token');
        console.log('Cargando proveedores con token:', token);
        const response = await fetch(`${API_URL}/proveedores`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log('Cargando proveedores, estado:', response.status);
        if (!response.ok) {
            throw new Error(`Error al cargar proveedores: ${response.status}`);
        }
        const proveedores = await response.json();
        console.log('Proveedores recibidos:', proveedores);
        const select = document.getElementById('proveedor_id');
        if (!select) {
            console.error('Elemento #proveedor_id no encontrado');
            showNotification('Error: Campo de proveedores no encontrado', true);
            return;
        }
        select.innerHTML = '<option value="">Selecciona un proveedor</option>';
        if (proveedores.length > 0) {
            proveedores.forEach(proveedor => {
                const option = document.createElement('option');
                // CAMBIO AQUÍ: Usar proveedor.id_pro en lugar de proveedor.id
                option.value = DOMPurify.sanitize(proveedor.id_pro);
                option.textContent = DOMPurify.sanitize(proveedor.name);
                select.appendChild(option);
            });
            console.log('Proveedores cargados, sin selección por defecto');
            console.log('Contenido de #proveedor_id:', select.outerHTML);
        } else {
            console.log('No se encontraron proveedores');
            select.innerHTML = '<option value="">No hay proveedores disponibles</option>';
            showNotification('No hay proveedores disponibles', true);
        }
    } catch (error) {
        console.error('Error cargando proveedores:', error.message);
        showNotification('Error al cargar proveedores', true);
    }
}

function previewImage() {
    const input = document.getElementById('productImage');
    const preview = document.getElementById('imagePreview');
    if (!input || !preview) {
        console.error('Elementos necesarios no encontrados:', {
            input: !!input,
            preview: !!preview
        });
        return;
    }
    preview.style.display = 'none';
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            preview.src = e.target.result;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(input.files[0]);
    }
}

async function loadProducts(page = 1, limit = productLimit, searchTerm = '', proveedorId = '', sort = 'created_at', order = 'desc') {
    currentProductPage = page;
    currentProveedorId = proveedorId;
    let url = `${API_URL}/products?page=${page}&limit=${limit}&sort=${sort}&order=${order}`;
    if (searchTerm) {
        url += `&search=${encodeURIComponent(searchTerm)}`;
    }
    if (proveedorId) {
        url += `&proveedor_id=${encodeURIComponent(proveedorId)}`;
    }
    console.log('Ejecutando loadProducts:', { page, limit, searchTerm, proveedorId, sort, order });
    console.log('Solicitando productos desde:', url);
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log('Respuesta /api/products:', response.status, response.statusText);
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                showNotification('Sesión expirada o no autorizada. Por favor, inicia sesión de nuevo.', true);
                logout();
                return;
            }
            throw new Error(`Error HTTP: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        console.log('Datos recibidos de /api/products:', data);
        currentProductPage = data.currentPage;
        const productsTableBody = document.getElementById('productsTableBody');
        if (productsTableBody) {
            productsTableBody.innerHTML = '';
            if (data.products && data.products.length > 0) {
                data.products.forEach(product => {
                    const imageSrc = product.image_path
                        ? `http://localhost:3000${encodeURI(DOMPurify.sanitize(product.image_path)).replace(/%20/g, ' ')}`
                        : 'http://localhost:3000/img/willcars-1.jpg';
                    const refPrice = (product.ref == null || parseFloat(product.ref) > 1000 || parseFloat(product.ref) < 0 || isNaN(parseFloat(product.ref)))
                        ? parseFloat(product.usd * 1.2).toFixed(2)
                        : parseFloat(product.ref).toFixed(2);
                    const row = `
                        <tr data-product-id="${product.id}">
                            <td><img src="${imageSrc}" alt="${DOMPurify.sanitize(product.description || 'Producto')}" width="50" height="50" onerror="this.src='http://localhost:3000/img/willcars-1.jpg'"></td>
                            <td>${DOMPurify.sanitize(product.code)}</td>
                            <td>${DOMPurify.sanitize(product.description)}</td>
                            <td>${DOMPurify.sanitize(product.brand || '')}</td>
                            <td>${DOMPurify.sanitize(product.model || '')}</td>
                            <td>$${parseFloat(product.usd || 0).toFixed(2)}</td>
                            <td>$${refPrice}</td>
                            <td>${DOMPurify.sanitize(product.proveedor_id || 'N/A')}</td>
                            <td>${DOMPurify.sanitize(product.proveedor_name || 'N/A')}</td>
                            <td>
                                <div class="action-buttons">
                                    <button class="btn btn-edit" data-code="${product.code}" title="Editar">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button class="btn btn-delete" data-code="${product.code}" title="Eliminar">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `;
                    productsTableBody.innerHTML += row;
                });
            } else {
                productsTableBody.innerHTML = '<tr><td colspan="10" class="text-center">No hay productos disponibles.</td></tr>';
            }
        }
        const paginationInfo = document.getElementById('productPageInfo');
        const prevProductPageBtn = document.getElementById('prevProductPage');
        const nextProductPageBtn = document.getElementById('nextProductPage');
        if (paginationInfo) {
            if (data.currentPage != null && data.totalPages != null) {
                paginationInfo.textContent = `Página ${data.currentPage} de ${data.totalPages}`;
            } else {
                paginationInfo.textContent = 'Paginación no disponible';
                console.warn('Los datos de paginación (currentPage, totalPages) no se recibieron de la API.');
            }
        }
        if (prevProductPageBtn) {
            prevProductPageBtn.disabled = !(data.hasPrevPage || false);
        }
        if (nextProductPageBtn) {
            nextProductPageBtn.disabled = !(data.hasNextPage || false);
        }
        console.log('Estado de Paginación Actual:', {
            currentPage: data.currentPage,
            totalPages: data.totalPages,
            hasPrevPage: data.hasPrevPage,
            hasNextPage: data.hasNextPage
        });
        document.querySelectorAll('.btn-edit').forEach(button => {
            button.removeEventListener('click', handleEditButtonClick);
            button.addEventListener('click', handleEditButtonClick);
        });
        document.querySelectorAll('.btn-delete').forEach(button => {
            button.removeEventListener('click', handleDeleteButtonClick);
            button.addEventListener('click', handleDeleteButtonClick);
        });
        updateSupplierStatusIndicators();
    } catch (error) {
        console.error('Error al cargar productos:', error);
        showNotification('Error al cargar productos. Por favor, inténtalo de nuevo.', true);
        const productsTableBody = document.getElementById('productsTableBody');
        if (productsTableBody) {
            productsTableBody.innerHTML = '<tr><td colspan="10" class="text-center text-danger">Error al cargar productos.</td></tr>';
        }
    }
}

function handleEditButtonClick(event) {
    const code = event.currentTarget.dataset.code;
    editProduct(code);
}

function handleDeleteButtonClick(event) {
    const code = event.currentTarget.dataset.code;
    deleteProduct(code);
}

async function updateSupplierStatusIndicators() {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('No se encontró el token de autenticación');
        }

        const response = await fetch(`${API_URL}/proveedores/status`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error(`Error al obtener estado de proveedores: ${response.status}`);
        }

        const statuses = await response.json();
        console.log('Respuesta de /proveedores/status:', statuses);

        if (!Array.isArray(statuses)) {
            console.error('statuses no es un arreglo:', statuses);
            showNotification('Error: Datos de proveedores no válidos', true);
            return;
        }

        const supplierButtonMap = {
            'sanchezStatusIndicator': 'PS-00001',
            'mastroStatusIndicator': 'MAS-i002',
            'argImportStatusIndicator': 'ARG-C003',
            'multiOccStatusIndicator': 'Mcc-i004',
            'willcarsImportStatusIndicator': 'Wic-A1',
            'kodeImportStatusIndicator': 'kod-Sc001'
        };

        for (const indicatorId in supplierButtonMap) {
            const indicator = document.getElementById(indicatorId);
            if (indicator) {
                const supplierId = supplierButtonMap[indicatorId];
                console.log(`Actualizando indicador para ${supplierId}`);
                const status = statuses.find(s => s.supplier_id === supplierId) || { active: false };
                indicator.classList.remove('green', 'red');
                indicator.classList.add(status.active ? 'green' : 'red');
                indicator.textContent = status.active ? '' : ''; // Go-Activo - Stop-Inactivo
            } else {
                console.error(`No se encontró el indicador con ID: ${indicatorId}`);
            }
        }
    } catch (error) {
        console.error('Error al actualizar indicadores de estado:', error);
        showNotification('Error al actualizar indicadores de estado', true);
    }
}
async function updateProductVisibility(id_pro, action) {
    try {
        console.log(`Actualizando proveedor ${id_pro} con acción ${action}`);
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('No se encontró el token de autenticación');
        }

        const visible = action === 'activate';

        const response = await fetch(`http://localhost:3000/api/proveedores/status/${id_pro}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ visible })
        });

        if (!response.ok) {
            throw new Error(`Error al actualizar proveedor: ${response.status}`);
        }

        const updatedSupplier = await response.json();
        const indicator = document.getElementById(`${id_pro}StatusIndicator`);
        if (indicator) {
            indicator.classList.remove('green', 'red');
            indicator.classList.add(updatedSupplier.visible ? 'green' : 'red');
            indicator.textContent = updatedSupplier.visible ? 'Activo' : 'Inactivo';
        } else {
            console.error(`No se encontró el indicador para ${id_pro}`);
        }

        showNotification(`Proveedor ${id_pro} actualizado correctamente`, false);
        await loadProducts(1, 10, '', '');
    } catch (error) {
        console.error('Error en updateProductVisibility:', error);
        showNotification('Error al actualizar visibilidad del proveedor', true);
    }
}
async function loadPendingFiles() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/pending-csvs`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!response.ok) {
            throw new Error(`Error al cargar archivos pendientes: ${response.status}`);
        }
        const files = await response.json();
        const pendingFilesTableBody = document.getElementById('pendingFilesTableBody');
        if (pendingFilesTableBody) {
            pendingFilesTableBody.innerHTML = '';
            if (files.length > 0) {
                files.forEach(file => {
                    const row = `
                        <tr data-csv-id="${file.id}">
                            <td>${DOMPurify.sanitize(file.proveedor_name || 'N/A')}</td>
                            <td>${DOMPurify.sanitize(file.file_path.split('/').pop())}</td>
                            <td>${new Date(file.created_at).toLocaleDateString()}</td>
                            <td>
                                <button class="btn btn-primary btn-view-csv" data-csv-id="${file.id}">Ver</button>
                                <button class="btn btn-success btn-approve-csv" data-csv-id="${file.id}">Aprobar</button>
                                <button class="btn btn-danger btn-reject-csv" data-csv-id="${file.id}">Rechazar</button>
                            </td>
                        </tr>
                    `;
                    pendingFilesTableBody.innerHTML += row;
                });
                document.querySelectorAll('.btn-view-csv').forEach(button => {
                    button.addEventListener('click', () => viewPendingCsv(button.dataset.csvId));
                });
                document.querySelectorAll('.btn-approve-csv').forEach(button => {
                    button.addEventListener('click', () => approvePendingCsv(button.dataset.csvId));
                });
                document.querySelectorAll('.btn-reject-csv').forEach(button => {
                    button.addEventListener('click', () => rejectPendingCsv(button.dataset.csvId));
                });
            } else {
                pendingFilesTableBody.innerHTML = '<tr><td colspan="4">No hay archivos pendientes</td></tr>';
            }
        }
    } catch (error) {
        console.error('Error al cargar archivos pendientes:', error);
        showNotification('Error al cargar archivos pendientes', true);
    }
}

async function viewPendingCsv(csvId) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/pending-csv/${csvId}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!response.ok) {
            throw new Error(`Error al cargar contenido del archivo: ${response.status}`);
        }
        const { data } = await response.json();
        const previewContent = document.getElementById('csvPreviewContent');
        if (previewContent) {
            previewContent.innerHTML = '';
            if (data.length > 0) {
                const table = document.createElement('table');
                table.className = 'table table-bordered';
                const thead = document.createElement('thead');
                const tbody = document.createElement('tbody');
                const headers = Object.keys(data[0]);
                const headerRow = document.createElement('tr');
                headers.forEach(header => {
                    const th = document.createElement('th');
                    th.textContent = DOMPurify.sanitize(header);
                    headerRow.appendChild(th);
                });
                thead.appendChild(headerRow);
                data.forEach(row => {
                    const tr = document.createElement('tr');
                    headers.forEach(header => {
                        const td = document.createElement('td');
                        td.textContent = DOMPurify.sanitize(row[header] ? row[header].toString() : '');
                        tr.appendChild(td);
                    });
                    tbody.appendChild(tr);
                });
                table.appendChild(thead);
                table.appendChild(tbody);
                previewContent.appendChild(table);
                $('#csvPreviewModal').modal('show');
            } else {
                previewContent.innerHTML = '<p>No hay datos para mostrar</p>';
                $('#csvPreviewModal').modal('show');
            }
        }
    } catch (error) {
        console.error('Error al previsualizar archivo:', error);
        showNotification('Error al previsualizar archivo', true);
    }
}

async function approvePendingCsv(csvId) {
    showConfirm('¿Estás seguro de aprobar este archivo?', async (confirmed) => {
        if (confirmed) {
            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`${API_URL}/pending-csv/${csvId}/approve`, {
                    method: 'PUT',
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (!response.ok) {
                    throw new Error(`Error al aprobar archivo: ${response.status}`);
                }
                showNotification('Archivo aprobado con éxito', false);
                loadPendingFiles();
                loadProducts(currentProductPage, productLimit, document.getElementById('productSearchInput')?.value || '', currentProveedorId);
            } catch (error) {
                console.error('Error al aprobar archivo:', error);
                showNotification('Error al aprobar archivo', true);
            }
        }
    });
}

async function rejectPendingCsv(csvId) {
    showConfirm('¿Estás seguro de rechazar este archivo?', async (confirmed) => {
        if (confirmed) {
            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`${API_URL}/pending-csv/${csvId}/reject`, {
                    method: 'PUT',
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (!response.ok) {
                    throw new Error(`Error al rechazar archivo: ${response.status}`);
                }
                showNotification('Archivo rechazado con éxito', false);
                loadPendingFiles();
            } catch (error) {
                console.error('Error al rechazar archivo:', error);
                showNotification('Error al rechazar archivo', true);
            }
        }
    });
}
// Agrega los event listeners en una sección de inicialización
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.activate-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id_pro = btn.dataset.id_pro;
            updateProductVisibility(id_pro, 'activate');
        });
    });

    document.querySelectorAll('.deactivate-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id_pro = btn.dataset.id_pro;
            updateProductVisibility(id_pro, 'deactivate');
        });
    });
});

async function loadSuppliers() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/proveedores`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!response.ok) {
            throw new Error(`Error al cargar proveedores: ${response.status}`);
        }
        const suppliers = await response.json();
        const tbody = document.querySelector('#suppliersTable tbody');
        if (!tbody) {
            console.error('Tabla #suppliersTable tbody no encontrada');
            showNotification('Error: Tabla de proveedores no encontrada', true);
            return;
        }
        tbody.innerHTML = '';
        if (suppliers.length > 0) {
            suppliers.forEach(supplier => {
                const row = `
                    <tr>
                        <td>${DOMPurify.sanitize(supplier.name)}</td>
                        <td>
                            <button class="btn btn-danger btn-sm delete-supplier-btn" data-proveedor-id="${DOMPurify.sanitize(supplier.id)}" title="Eliminar">
                                <i class="fas fa-trash"></i> Eliminar
                            </button>
                            <button class="btn btn-success btn-sm save-supplier-btn" data-proveedor-id="${DOMPurify.sanitize(supplier.id)}" title="Guardar">
                                <i class="fas fa-save"></i> Guardar
                            </button>
                        </td>
                    </tr>
                `;
                tbody.innerHTML += row;
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="2" class="text-center">No hay proveedores disponibles</td></tr>';
        }
    } catch (error) {
        console.error('Error al cargar proveedores:', error);
        showNotification('Error al cargar proveedores', true);
    }
}

async function deleteSupplierProducts(proveedorId) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/products/delete-by-supplier`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ proveedor_id: proveedorId })
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error al eliminar productos');
        }
        showNotification('Productos del proveedor eliminados con éxito', false);
        if (currentProveedorId === proveedorId) {
            currentProveedorId = '';
            loadProducts(1, productLimit, document.getElementById('productSearchInput')?.value || '');
        } else {
            loadProducts(currentProductPage, productLimit, document.getElementById('productSearchInput')?.value || '', currentProveedorId);
        }
        loadSuppliers();
        updateSupplierStatusIndicators();
        if (socket) socket.emit('productUpdated', { proveedor_id: proveedorId, action: 'deleted' });
    } catch (error) {
        console.error('Error al eliminar productos del proveedor:', error);
        showNotification(`Error al eliminar productos: ${error.message}`, true);
    }
}

async function saveSupplierProducts(proveedorId) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/products/export-csv${proveedorId ? `?proveedor_id=${encodeURIComponent(proveedorId)}` : ''}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error al exportar a CSV');
        }
        const blob = await response.blob();
        const supplierName = document.querySelector(`button[data-proveedor-id="${proveedorId}"]`)?.closest('tr')?.querySelector('td')?.textContent.trim().replace(/\s+/g, '_') || 'proveedor';
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${supplierName}_${new Date().toISOString()}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        showNotification('Productos exportados a CSV con éxito', false);
        updateSupplierStatusIndicators();
        if (socket) socket.emit('productUpdated', { proveedor_id: proveedorId, action: 'exported' });
    } catch (error) {
        console.error('Error al exportar productos a CSV:', error);
        showNotification(`Error al exportar a CSV: ${error.message}`, true);
    }
}

async function loadRecentProducts() {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            showNotification('Sesión no iniciada. Por favor, inicia sesión.', true);
            return;
        }
        const response = await fetch(`${API_URL}/products?page=1&limit=5&sort=created_at&order=desc`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!response.ok) {
            if (response.status === 401) {
                localStorage.removeItem('token');
                showNotification('Sesión expirada. Por favor, inicia sesión nuevamente.', true);
                setTimeout(() => window.location.href = '../login.html', 2000);
                return;
            }
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        const tableBody = document.getElementById('recentProductsTableBody');
        if (!tableBody) {
            console.warn('Elemento #recentProductsTableBody no encontrado');
            return;
        }
        if (!data.products || data.products.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6">No hay productos recientes</td></tr>';
            return;
        }
        tableBody.innerHTML = data.products.map(product => {
            const imgSrc = product.image_path && !product.image_path.includes('<id>')
                ? `http://localhost:3000${DOMPurify.sanitize(product.image_path)}`
                : '/img/willcars-1.jpg';
            return `
                <tr>
                    <td><img src="${imgSrc}" alt="${DOMPurify.sanitize(product.description || product.code)}" width="50" style="object-fit: cover;" onerror="this.src='/img/willcars-1.jpg'"></td>
                    <td>${DOMPurify.sanitize(product.code)}</td>
                    <td>${DOMPurify.sanitize(product.description)}</td>
                    <td>${DOMPurify.sanitize(product.brand || '-')}</td>
                    <td>$${parseFloat(product.usd || 0).toFixed(2)}</td>
                    <td>${DOMPurify.sanitize(product.proveedor_name || '-')}</td>
                </tr>
            `;
        }).join('');
        console.log('Productos recientes cargados:', data.products.length);
    } catch (error) {
        console.error('Error al cargar productos recientes:', error);
        showNotification('Error al cargar productos recientes', true);
    }
}

async function editProduct(code) {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            showNotification('Sesión expirada. Por favor, inicia sesión nuevamente.', true);
            setTimeout(() => window.location.href = '../admin/login.html', 2000);
            return;
        }
        const response = await fetch(`${API_URL}/products/${code}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error al obtener producto');
        }
        const product = await response.json();
        const modalLabel = document.getElementById('productModalLabel');
        const productForm = document.getElementById('productForm');
        const imagePreview = document.getElementById('imagePreview');
        const productCodeInput = document.getElementById('productCode');
        const originalProductCode = document.getElementById('originalProductCode');

        if (!modalLabel || !productForm || !imagePreview || !productCodeInput || !originalProductCode) {
            showNotification('Error: Elementos del formulario no encontrados', true);
            return;
        }
        
        modalLabel.textContent = 'Editar Producto';
        productCodeInput.value = product.code;
        productCodeInput.disabled = true;
        originalProductCode.value = product.code;
        productForm.dataset.code = product.code;

        document.getElementById('productCodeId').value = product.product_code_id || product.code;
        document.getElementById('productDescription').value = product.description || '';
        document.getElementById('productBrand').value = product.brand || '';
        document.getElementById('productModel').value = product.model || '';
        document.getElementById('productUsd').value = parseFloat(product.usd || 0).toFixed(2);
        document.getElementById('productRef').value = parseFloat(product.ref || 0).toFixed(2);
        document.getElementById('productDiscount').value = product.discount ? parseFloat(product.discount).toFixed(2) : '';
        document.getElementById('proveedor_id').value = product.proveedor_id || '';
        document.getElementById('productImage').value = '';
        
        if (product.image_path && !product.image_path.includes('<id>')) {
            imagePreview.src = `http://localhost:3000${DOMPurify.sanitize(product.image_path)}`;
            imagePreview.style.display = 'block';
        } else {
            imagePreview.style.display = 'none';
            imagePreview.src = '#';
        }
        
        await loadProveedores();
        productForm.removeEventListener('submit', window.saveProductHandler);
        window.saveProductHandler = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (isSubmitting) {
                console.log('Envío bloqueado, ya en proceso');
                return;
            }
            isSubmitting = true;
            const submitButton = productForm.querySelector('button[type="submit"]');
            console.log('Manejando submit del formulario');
            if (submitButton) submitButton.disabled = true;
            try {
                await saveProduct(e);
            } catch (error) {
                console.error('Error en submit:', error);
                showNotification(`Error: ${error.message}`, true);
            } finally {
                isSubmitting = false;
                if (submitButton) submitButton.disabled = false;
            }
        };
        productForm.addEventListener('submit', window.saveProductHandler, { once: false });
        $('#productModal').modal('show');
    } catch (error) {
        console.error('Error en editProduct:', error);
        showNotification(`No se pudo cargar el producto para editar: ${error.message}`, true);
    }
}

async function saveProduct(e) {
    e.preventDefault();
    console.log('saveProduct ejecutado');
    try {
        console.log('Iniciando validación de formulario');
        const code = DOMPurify.sanitize(document.getElementById('productCode')?.value?.trim() || '');
        const product_code_id = DOMPurify.sanitize(document.getElementById('productCodeId')?.value?.trim() || code);
        const originalCodeForEdit = document.getElementById('originalProductCode')?.value?.trim();
        const isEdit = document.getElementById('productForm')?.dataset.code;
        console.log('Estado inicial:', { code, product_code_id, isEdit, originalCodeForEdit });
        console.log('Estado inicial:', { code, product_code_id, isEdit, originalCodeForEdit });
        if (!code) {
            showNotification('El código es requerido', true);
            throw new Error('Código no proporcionado');
        }
        if (code.length > 20) {
            showNotification('El código debe tener máximo 20 caracteres', true);
            throw new Error('Código demasiado largo');
        }
        const description = DOMPurify.sanitize(document.getElementById('productDescription')?.value?.trim() || '');
        if (!description) {
            showNotification('La descripción es requerida', true);
            throw new Error('Descripción vacía');
        }
        const usd = parseFloat(document.getElementById('productUsd')?.value?.trim());
        if (isNaN(usd) || usd <= 0) {
            showNotification('El precio USD debe ser un número positivo', true);
            throw new Error('USD inválido');
        }
        const ref = parseFloat(document.getElementById('productRef')?.value?.trim());
        if (isNaN(ref) || ref <= 0) {
            showNotification('El precio REF debe ser un número positivo', true);
            throw new Error('REF inválido');
        }
        const discount = document.getElementById('productDiscount')?.value?.trim();
        if (discount && (isNaN(parseFloat(discount)) || parseFloat(discount) < 0 || parseFloat(discount) > 100)) {
            showNotification('El descuento debe ser un número entre 0 y 100', true);
            throw new Error('Descuento inválido');
        }
        const proveedorId = DOMPurify.sanitize(document.getElementById('proveedor_id')?.value || '');
        if (!proveedorId) {
            showNotification('Por favor, selecciona un proveedor válido', true);
            throw new Error('Proveedor no seleccionado');
        }
        const imageFile = document.getElementById('productImage')?.files[0];
        if (imageFile) {
            console.log('Imagen seleccionada:', imageFile.name);
            if (!['image/jpeg', 'image/png'].includes(imageFile.type)) {
                showNotification('Solo se permiten imágenes JPG o PNG', true);
                throw new Error('Tipo de imagen inválido');
            }
            if (imageFile.size > 2 * 1024 * 1024) {
                showNotification('La imagen no debe superar los 2MB', true);
                throw new Error('Imagen demasiado grande');
            }
        }
        const token = localStorage.getItem('token');
        if (!token) {
            showNotification('Sesión expirada. Por favor, inicia sesión nuevamente.', true);
            setTimeout(() => window.location.href = '../admin/login.html', 2000);
            throw new Error('Token no encontrado');
        }
        if (!isEdit) {
            console.log('Verificando si el código existe:', code);
            const response = await fetch(`${API_URL}/products/${code}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.ok) {
                showNotification('El código del producto ya existe', true);
                throw new Error('Código ya existe');
            } else if (response.status !== 404) {
                showNotification('Error al verificar el código del producto', true);
                throw new Error('Error al verificar código');
            }
        }
        const formData = new FormData();
        formData.append('code', code);
        formData.append('description', description);
        formData.append('brand', DOMPurify.sanitize(document.getElementById('productBrand')?.value?.trim() || ''));
        formData.append('model', DOMPurify.sanitize(document.getElementById('productModel')?.value?.trim() || ''));
        formData.append('usd', usd.toString());
        formData.append('ref', ref.toString());
        formData.append('discount', discount ? parseFloat(discount).toString() : '');
        formData.append('proveedor_id', proveedorId);
        formData.append('product_code_id', product_code_id);
        if (imageFile) formData.append('image', imageFile);
        const url = isEdit ? `${API_URL}/products/${originalCodeForEdit}` : `${API_URL}/products`;
        const method = isEdit ? 'PUT' : 'POST';
        console.log('Enviando a:', url, 'Método:', method);
        const response = await fetch(url, {
            method,
            headers: { Authorization: `Bearer ${token}` },
            body: formData
        });
        const result = await response.json();
        console.log('Respuesta /api/products:', result);
        if (!response.ok) {
            throw new Error(result.error || (isEdit ? 'Error al actualizar producto' : 'Error al crear producto'));
        }
        showNotification(isEdit ? 'Producto actualizado correctamente' : 'Producto creado correctamente', false);
        loadProducts(currentProductPage, productLimit, document.getElementById('productSearchInput')?.value || '', currentProveedorId);
        $('#productModal').modal('hide');
        document.getElementById('productForm').reset();
        document.getElementById('imagePreview').style.display = 'none';
        document.getElementById('productCode').disabled = false;
        document.getElementById('productForm').dataset.code = '';
        if (socket) socket.emit('productUpdated', { code, description });
    } catch (error) {
        console.error('Error al guardar el producto:', error);
        showNotification(`Error: ${error.message}`, true);
    }
}

async function deleteProduct(code) {
    showConfirm(`¿Estás seguro de eliminar el producto con código "${code}"? Esta acción es irreversible.`, async (confirmed) => {
        if (confirmed) {
            const token = localStorage.getItem('token');
            if (!token) {
                showNotification('Sesión expirada. Por favor, inicia sesión nuevamente.', true);
                setTimeout(() => window.location.href = '../admin/login.html', 2000);
                return;
            }
            try {
                const response = await fetch(`${API_URL}/products/${code}`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Error al eliminar producto');
                }
                showNotification('Producto eliminado correctamente', false);
                loadProducts(currentProductPage, productLimit, document.getElementById('productSearchInput')?.value || '', currentProveedorId);
                if (socket) socket.emit('productUpdated', { code, status: 'deleted' });
            } catch (error) {
                console.error('Error al eliminar producto:', error);
                showNotification(`Error al eliminar producto: ${error.message}`, true);
            }
        } else {
            showNotification('Eliminación cancelada', false);
        }
    });
}

async function uploadProducts(event) {
    event.preventDefault();
    const submitButton = event.target.querySelector('button[type="submit"]');
    if (isSubmitting) {
        console.log('Envío masivo bloqueado, ya en proceso');
        return;
    }
    isSubmitting = true;
    if (submitButton) submitButton.disabled = true;
    try {
        const fileInput = document.getElementById('bulkUploadFile');
        const file = fileInput?.files[0];
        if (!file) {
            showNotification('Por favor, selecciona un archivo CSV', true);
            throw new Error('No se seleccionó ningún archivo');
        }
        const formData = new FormData();
        formData.append('file', file);
        const token = localStorage.getItem('token');
        if (!token) {
            showNotification('Sesión expirada. Por favor, inicia sesión nuevamente.', true);
            setTimeout(() => window.location.href = '../admin/login.html', 2000);
            throw new Error('Token no encontrado');
        }
        const response = await fetch(`${API_URL}/products/bulk`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: formData
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.error || 'Error al cargar productos masivamente');
        }
        showNotification(`Carga masiva completada: ${result.inserted} productos insertados`, false);
        fileInput.value = '';
        loadProducts(currentProductPage, productLimit, document.getElementById('productSearchInput')?.value || '', currentProveedorId);
        updateSupplierStatusIndicators();
        if (socket) socket.emit('productUpdated', { action: 'bulkUploaded', proveedor_id: currentProveedorId });
    } catch (error) {
        console.error('Error en uploadProducts:', error);
        showNotification(`Error: ${error.message}`, true);
    } finally {
        isSubmitting = false;
        if (submitButton) submitButton.disabled = false;
    }
}

function initBulkUpload() {
    const bulkUploadForm = document.getElementById('bulkUploadForm');
    if (bulkUploadForm) {
        bulkUploadForm.addEventListener('submit', uploadProducts);
    } else {
        console.warn('Formulario #bulkUploadForm no encontrado');
    }
}

async function uploadProducts(event) {
    event.preventDefault();
    const submitButton = event.target.querySelector('button[type="submit"]');
    if (isSubmitting) {
        console.log('Envío masivo bloqueado, ya en proceso');
        return;
    }
    isSubmitting = true;
    if (submitButton) submitButton.disabled = true;
    try {
        const fileInput = document.getElementById('bulkUploadFile');
        const file = fileInput?.files[0];
        if (!file) {
            showNotification('Por favor, selecciona un archivo CSV', true);
            throw new Error('No se seleccionó ningún archivo');
        }
        const formData = new FormData();
        formData.append('file', file);
        const token = localStorage.getItem('token');
        if (!token) {
            showNotification('Sesión expirada. Por favor, inicia sesión nuevamente.', true);
            setTimeout(() => window.location.href = '../admin/login.html', 2000);
            throw new Error('Token no encontrado');
        }
        const response = await fetch(`${API_URL}/products/bulk`, { // Ruta corregida
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: formData
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.error || 'Error al cargar productos masivamente');
        }
        showNotification(`Carga masiva completada: ${result.inserted} productos insertados`, false);
        fileInput.value = '';
        loadProducts(currentProductPage, productLimit, document.getElementById('productSearchInput')?.value || '', currentProveedorId);
        updateSupplierStatusIndicators();
        if (socket) socket.emit('productUpdated', { action: 'bulkUploaded', proveedor_id: currentProveedorId });
    } catch (error) {
        console.error('Error en uploadProducts:', error);
        showNotification(`Error: ${error.message}`, true);
    } finally {
        isSubmitting = false;
        if (submitButton) submitButton.disabled = false;
    }
}
function initBulkUpload() {
    const bulkUploadForm = document.getElementById('bulkUploadForm');
    if (bulkUploadForm) {
        bulkUploadForm.addEventListener('submit', uploadProducts);
    } else {
        console.warn('Formulario #bulkUploadForm no encontrado');
    }
}


document.addEventListener('DOMContentLoaded', async () => {
    applySidebarState();
    applyDarkMode();
    const isAdmin = await verifyAdmin();
    if (isAdmin) {
        if (window.location.pathname.includes('/admin/index.html') || window.location.pathname === '/admin/') {
            loadStats();
            loadRecentProducts();
        } else if (window.location.pathname.includes('/admin/Productos.html')) {
            loadProducts(1);
            loadPendingFiles();
            document.getElementById('newProductBtn')?.addEventListener('click', openModal);
            document.getElementById('productImage')?.addEventListener('change', previewImage);
            document.getElementById('productSearchInput')?.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                const searchTerm = e.target.value.trim();
                searchTimeout = setTimeout(() => {
                    loadProducts(1, productLimit, searchTerm, currentProveedorId);
                }, 300);
            });
            document.getElementById('prevProductPage')?.addEventListener('click', () => loadProducts(currentProductPage - 1, productLimit, document.getElementById('productSearchInput')?.value || '', currentProveedorId));
            document.getElementById('nextProductPage')?.addEventListener('click', () => loadProducts(currentProductPage + 1, productLimit, document.getElementById('productSearchInput')?.value || '', currentProveedorId));
            document.querySelectorAll('.dropdown-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    e.preventDefault();
                    const action = item.dataset.action;
                    const proveedorId = item.dataset.proveedorId;
                    if (action === 'show') {
                        loadProducts(1, productLimit, document.getElementById('productSearchInput')?.value || '', proveedorId);
                    } else {
                        updateProductVisibility(proveedorId, action);
                    }
                    item.closest('.dropdown-menu').style.display = 'none';
                });
            });
            document.querySelectorAll('.btn-import-specific').forEach(btn => {
                btn.addEventListener('click', () => {
                    const dropdownMenu = btn.nextElementSibling;
                    document.querySelectorAll('.dropdown-menu').forEach(menu => {
                        if (menu !== dropdownMenu) menu.style.display = 'none';
                    });
                    dropdownMenu.style.display = dropdownMenu.style.display === 'block' ? 'none' : 'block';
                });
            });
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.dropdown')) {
                    document.querySelectorAll('.dropdown-menu').forEach(menu => {
                        menu.style.display = 'none';
                    });
                }
            });
            document.getElementById('showAllProductsBtn')?.addEventListener('click', () => {
                currentProveedorId = '';
                loadProducts(1, productLimit, document.getElementById('productSearchInput')?.value || '');
            });
            document.getElementById('allProductsBtn')?.addEventListener('click', () => {
                loadSuppliers();
                $('#databaseModal').modal('show');
            });
            document.getElementById('suppliersTable')?.addEventListener('click', (e) => {
                if (e.target.closest('.delete-supplier-btn')) {
                    const proveedorId = e.target.closest('.delete-supplier-btn').dataset.proveedorId;
                    showConfirm('¿Estás seguro de eliminar todos los productos de este proveedor?', (confirmed) => {
                        if (confirmed) {
                            deleteSupplierProducts(proveedorId);
                        }
                    });
                } else if (e.target.closest('.save-supplier-btn')) {
                    const proveedorId = e.target.closest('.save-supplier-btn').dataset.proveedorId;
                    saveSupplierProducts(proveedorId);
                }
            });
            document.getElementById('cancelProductBtn')?.addEventListener('click', closeModal);
            initBulkUpload();
        } else if (window.location.pathname.includes('/admin/Usuarios.html')) {
            console.log('Página de Usuarios cargada');
        }
        document.querySelector('.toggle-btn')?.addEventListener('click', toggleSidebar);
        document.getElementById('darkModeToggle')?.addEventListener('click', toggleDarkMode);
        document.getElementById('logoutBtn')?.addEventListener('click', logout);
    }
});