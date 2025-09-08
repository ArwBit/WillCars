// public/js/products-frontend.js
const API_URL = 'http://localhost:3000'; // Ajusta según tu configuración

function showNotification(message, isError = false) {
    const notification = document.createElement('div');
    notification.className = `notification ${isError ? 'error' : 'success'}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    notification.style.display = 'block';
    setTimeout(() => {
        notification.style.display = 'none';
        notification.remove();
    }, 3000);
}

async function loadPendingFiles() {
    try {
        const response = await fetch(`${API_URL}/api/csv/pending-files`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (!response.ok) throw new Error('Error al cargar archivos pendientes');
        const data = await response.json();
        const tbody = document.getElementById('pendingFilesTableBody');
        tbody.innerHTML = data.files.map(file => `
            <tr>
                <td>${DOMPurify.sanitize(file.supplier_name)}</td>
                <td>${DOMPurify.sanitize(file.file_name)}</td>
                <td>${new Date(file.created_at).toLocaleString()}</td>
                <td>
                    <button class="btn btn-primary preview-csv" data-file-id="${file.id}">Ver CSV</button>
                </td>
            </tr>
        `).join('');

        document.querySelectorAll('.preview-csv').forEach(btn => {
            btn.addEventListener('click', async () => {
                const fileId = btn.dataset.fileId;
                await previewCsv(fileId);
            });
        });
    } catch (error) {
        showNotification(error.message || 'Error al cargar archivos pendientes', true);
    }
}

async function previewCsv(fileId) {
    try {
        const response = await fetch(`${API_URL}/api/csv/preview/${fileId}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (!response.ok) throw new Error('Error al cargar vista previa');
        const data = await response.json();
        const tbody = document.getElementById('csvPreviewTableBody');
        tbody.innerHTML = data.products.map(product => `
            <tr>
                <td>${DOMPurify.sanitize(product.code)}</td>
                <td>${DOMPurify.sanitize(product.description)}</td>
                <td>${DOMPurify.sanitize(product.brand || 'N/A')}</td>
                <td>${DOMPurify.sanitize(product.model || 'N/A')}</td>
                <td>${product.usd}</td>
                <td>${product.ref}</td>
                <td>${DOMPurify.sanitize(product.proveedor_id)}</td>
                <td>${DOMPurify.sanitize(product.image_path || 'N/A')}</td>
            </tr>
        `).join('');

        const modal = document.getElementById('csvPreviewModal');
        modal.style.display = 'block';
        const closeBtn = modal.querySelector('.close');
        closeBtn.onclick = () => modal.style.display = 'none';
        window.onclick = (event) => {
            if (event.target === modal) modal.style.display = 'none';
        };

        document.getElementById('approveCsvBtn').onclick = () => approveCsv(fileId);
        document.getElementById('rejectCsvBtn').onclick = () => rejectCsv(fileId);
    } catch (error) {
        showNotification(error.message || 'Error al cargar vista previa', true);
    }
}

async function approveCsv(fileId) {
    try {
        const response = await fetch(`${API_URL}/api/csv/approve/${fileId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            }
        });
        if (!response.ok) throw new Error('Error al aprobar archivo');
        showNotification('Archivo aprobado y productos cargados', false);
        document.getElementById('csvPreviewModal').style.display = 'none';
        loadPendingFiles();
    } catch (error) {
        showNotification(error.message || 'Error al aprobar archivo', true);
    }
}

async function rejectCsv(fileId) {
    try {
        const response = await fetch(`${API_URL}/api/csv/reject/${fileId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            }
        });
        if (!response.ok) throw new Error('Error al rechazar archivo');
        showNotification('Archivo rechazado', false);
        document.getElementById('csvPreviewModal').style.display = 'none';
        loadPendingFiles();
    } catch (error) {
        showNotification(error.message || 'Error al rechazar archivo', true);
    }
}

async function loadSuppliers() {
    try {
        const response = await fetch(`${API_URL}/api/suppliers`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (!response.ok) throw new Error('Error al cargar proveedores');
        const suppliers = await response.json();
        const selectManual = document.getElementById('proveedor_id');
        const selectCsv = document.getElementById('csvProveedorId');
        const options = '<option value="">Selecciona un proveedor</option>' + suppliers.map(s => `<option value="${s.id_pro}">${s.name}</option>`).join('');
        selectManual.innerHTML = options;
        selectCsv.innerHTML = options;
    } catch (error) {
        showNotification(error.message || 'Error al cargar proveedores', true);
    }
}

document.getElementById('manualProductForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('code', document.getElementById('code').value);
    formData.append('description', document.getElementById('description').value);
    formData.append('brand', document.getElementById('brand').value);
    formData.append('model', document.getElementById('model').value);
    formData.append('usd', document.getElementById('usd').value);
    formData.append('ref', document.getElementById('ref').value);
    formData.append('proveedor_id', document.getElementById('proveedor_id').value);
    formData.append('image', document.getElementById('image').files[0]);

    try {
        const response = await fetch(`${API_URL}/api/products`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: formData
        });
        if (!response.ok) throw new Error((await response.json()).error || 'Error al subir producto');
        showNotification('Producto subido exitosamente', false);
        document.getElementById('manualProductForm').reset();
    } catch (error) {
        showNotification(error.message || 'Error al subir producto', true);
    }
});

document.getElementById('uploadCsvForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('file', document.getElementById('csvFile').files[0]);
    formData.append('proveedor_id', document.getElementById('csvProveedorId').value);

    try {
        const response = await fetch(`${API_URL}/api/csv/upload-provider-csv`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: formData
        });
        if (!response.ok) throw new Error((await response.json()).error || 'Error al subir archivo');
        showNotification('Archivo subido exitosamente, pendiente de aprobación', false);
        document.getElementById('uploadCsvForm').reset();
        loadPendingFiles();
    } catch (error) {
        showNotification(error.message || 'Error al subir archivo', true);
    }
});

document.addEventListener('DOMContentLoaded', () => {
    loadPendingFiles();
    loadSuppliers();
});