// usuarios.js

// --- Variables globales para el modal ---
const userModal = document.getElementById('userModal');
const userForm = document.getElementById('userForm');
const modalTitle = document.getElementById('modalTitle');
const userIdField = document.getElementById('userId');
const nameField = document.getElementById('name');
const emailField = document.getElementById('email');
const passwordField = document.getElementById('password');
const roleField = document.getElementById('role');
const providerIdField = document.getElementById('providerId');
const saveUserBtn = document.getElementById('saveUserBtn');
const statusField = document.getElementById('status');
const closeButton = userModal ? userModal.querySelector('.close-button') : null;
const providerIdGroup = document.getElementById('providerIdGroup');

// --- Variables para paginación ---
let currentPage = 1;
const rowsPerPage = 10;

document.addEventListener('DOMContentLoaded', () => {
  loadUsers();

  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      currentPage = 1;
      loadUsers(currentPage, rowsPerPage, searchInput.value);
    });
  }

  const addUserBtn = document.getElementById('addUserBtn');
  if (addUserBtn) {
    addUserBtn.addEventListener('click', () => openUserModal('create'));
  }

  if (closeButton) {
    closeButton.addEventListener('click', closeUserModal);
  }

  window.addEventListener('click', (event) => {
    if (event.target === userModal) {
      closeUserModal();
    }
  });

  if (roleField && providerIdGroup) {
    roleField.addEventListener('change', () => {
      if (roleField.value === 'proveedor') {
        providerIdGroup.style.display = 'block';
        providerIdField.required = true;
      } else {
        providerIdField.value = '';
        providerIdGroup.style.display = 'none';
        providerIdField.required = false;
      }
    });
    if (roleField.value !== 'proveedor') {
      providerIdGroup.style.display = 'none';
      providerIdField.required = false;
    }
  }

  if (userForm) {
    userForm.addEventListener('submit', handleUserFormSubmit);
  }

  const prevPageBtn = document.getElementById('prevPage');
  const nextPageBtn = document.getElementById('nextPage');

  if (prevPageBtn) {
    prevPageBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        loadUsers(currentPage, rowsPerPage, searchInput ? searchInput.value : '');
      }
    });
  }

  if (nextPageBtn) {
    nextPageBtn.addEventListener('click', () => {
      currentPage++;
      loadUsers(currentPage, rowsPerPage, searchInput ? searchInput.value : '');
    });
  }
});

// --- Funciones para abrir y cerrar el modal de usuario ---
function openUserModal(mode, userData = {}) {
  console.log(`Abriendo modal en modo: ${mode}, datos:`, userData);
  if (!userModal || !userForm || !modalTitle || !passwordField || !userIdField || !nameField || !emailField || !roleField || !statusField) {
    console.error("Error: Algunos elementos del modal no se encontraron en el DOM.");
    if (userModal) userModal.style.display = 'none';
    return;
  }

  userForm.reset();
  userModal.style.display = 'flex';

  if (mode === 'create') {
    modalTitle.textContent = 'Crear Nuevo Usuario';
    userIdField.value = '';
    passwordField.required = true;
    passwordField.style.display = 'block';
    passwordField.placeholder = 'Ingrese contraseña';
    if (providerIdGroup) {
      providerIdField.value = '';
      providerIdGroup.style.display = 'none';
      providerIdField.required = false;
    }
    document.getElementById('whatsapp').value = '';
  } else if (mode === 'edit') {
    modalTitle.textContent = 'Editar Usuario';
    userIdField.value = userData.id || '';
    nameField.value = userData.name || '';
    emailField.value = userData.email || '';
    document.getElementById('whatsapp').value = userData.whatsapp || '';
    roleField.value = userData.role || 'user';
    statusField.value = userData.active ? 'active' : 'inactive';
    passwordField.required = false;
    passwordField.value = '';
    passwordField.style.display = 'none';
    if (providerIdGroup) {
      if (userData.role === 'proveedor') {
        providerIdField.value = userData.providerid || '';
        providerIdGroup.style.display = 'block';
        providerIdField.required = true;
      } else {
        providerIdField.value = '';
        providerIdGroup.style.display = 'none';
        providerIdField.required = false;
      }
    }
  }
}

function closeUserModal() {
  if (userModal) {
    userModal.style.display = 'none';
    userForm.reset();
    passwordField.style.display = 'block';
    passwordField.required = true;
    if (providerIdGroup) {
      providerIdGroup.style.display = 'none';
      providerIdField.required = false;
    }
  }
}

async function handleUserFormSubmit(event) {
  event.preventDefault();

  const id = userIdField.value;
  const name = nameField.value.trim();
  const email = emailField.value.trim();
  const whatsapp = document.getElementById('whatsapp').value.trim();
  const password = passwordField.value.trim();
  const role = roleField.value;
  const providerId = providerIdField.value.trim();
  const status = statusField.value;

  if (!name || !email || !role) {
    showNotification('Por favor, complete todos los campos obligatorios.', true);
    return;
  }
  if (!id && !password) {
    showNotification('La contraseña es obligatoria para nuevos usuarios.', true);
    return;
  }
  if (role === 'proveedor' && !providerId) {
    showNotification('El ID de proveedor es obligatorio para usuarios con rol de proveedor.', true);
    return;
  }
  if (whatsapp && !/^[0-9]{10,15}$/.test(whatsapp)) {
    showNotification('El número de WhatsApp debe contener entre 10 y 15 dígitos.', true);
    return;
  }

  const userData = {
    name,
    email,
    whatsapp: whatsapp || undefined,
    role,
    active: status === 'active', // Cambiar status a active
    password: password || undefined,
    providerId: role === 'proveedor' ? providerId : undefined
  };

  try {
    let response;
    const token = localStorage.getItem('token');
    if (!token) {
      showNotification('No autorizado. Por favor, inicie sesión.', true);
      window.location.href = '/login.html';
      return;
    }

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };

    if (id) {
      response = await fetch(`${API_URL}/users/${id}`, {
        method: 'PUT',
        headers: headers,
        body: JSON.stringify(userData)
      });
    } else {
      response = await fetch(`${API_URL}/users`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(userData)
      });
    }

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Error al guardar el usuario: ${response.status}`);
    }

    showNotification('Usuario guardado exitosamente.', false);
    closeUserModal();
    loadUsers();
  } catch (error) {
    console.error('Error al guardar el usuario:', error);
    showNotification(error.message || 'Error al guardar el usuario.', true);
    if (error.message.includes('No autorizado') || error.message.includes('401') || error.message.includes('403')) {
      localStorage.removeItem('token');
      window.location.href = '/login.html';
    }
  }
}

// --- Función para cargar usuarios ---
async function loadUsers(page = 1, limit = rowsPerPage, search = '') {
  const token = localStorage.getItem('token');
  if (!token) {
    showNotification('No autorizado. Por favor, inicie sesión.', true);
    window.location.href = '/login.html';
    return;
  }

  try {
    const url = `${API_URL}/users?page=${page}&limit=${limit}${search ? `&search=${encodeURIComponent(search)}` : ''}`;
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.status === 401 || response.status === 403) {
      throw new Error('No autorizado. Su sesión puede haber expirado.');
    }
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `Error al cargar usuarios: ${response.statusText}`);
    }

    const data = await response.json();
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) {
      console.error('El elemento "usersTableBody" no fue encontrado en el DOM.');
      return;
    }
    tbody.innerHTML = data.users.map(user => `
      <tr>
        <td><img src="${DOMPurify.sanitize(user.avatar || '../img/default-avatar.png')}" alt="Avatar" class="user-avatar" onerror="this.src='../img/default-avatar.png'"></td>
        <td>${DOMPurify.sanitize(user.name)}</td>
        <td>${DOMPurify.sanitize(user.email)}</td>
        <td>${DOMPurify.sanitize(user.whatsapp || 'N/A')}</td>
        <td>${DOMPurify.sanitize(user.role)}</td>
        <td>${user.role === 'proveedor' ? (user.providerid ? DOMPurify.sanitize(user.providerid) : 'N/A') : '-'}</td>
        <td><span class="status-${user.active ? 'active' : 'inactive'}">${user.active ? 'Activo' : 'Inactivo'}</span></td>
        <td>${DOMPurify.sanitize(user.last_login ? new Date(user.last_login).toLocaleString() : 'N/A')}</td>
        <td>
          <div class="action-buttons">
            <button class="btn btn-edit" data-id="${DOMPurify.sanitize(user.id)}">Editar</button>
            <button class="btn btn-toggle" data-id="${DOMPurify.sanitize(user.id)}">${user.active ? 'Desactivar' : 'Activar'}</button>
          </div>
        </td>
      </tr>
    `).join('');

    const pageInfoElem = document.getElementById('pageInfo');
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');

    if (pageInfoElem) pageInfoElem.textContent = `Página ${data.page} de ${data.pages}`;
    if (prevPageBtn) prevPageBtn.disabled = data.page === 1;
    if (nextPageBtn) nextPageBtn.disabled = data.page === data.pages;

    document.querySelectorAll('.btn-edit').forEach(btn => {
      btn.addEventListener('click', async () => {
        const userId = btn.dataset.id;
        try {
          const response = await fetch(`${API_URL}/users/${userId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Error al obtener datos del usuario para edición');
          }
          const userData = await response.json();
          openUserModal('edit', userData);
        } catch (error) {
          console.error('Error al cargar datos de usuario para edición:', error);
          showNotification('Error al cargar datos del usuario para edición.', true);
          if (error.message.includes('No autorizado')) {
            localStorage.removeItem('token');
            window.location.href = '/login.html';
          }
        }
      });
    });
    document.querySelectorAll('.btn-toggle').forEach(btn => {
      btn.addEventListener('click', () => toggleUserStatus(btn.dataset.id));
    });
  } catch (error) {
    console.error('Error al cargar usuarios:', error);
    showNotification(error.message || 'Error al cargar usuarios', true);
    if (error.message.includes('No autorizado')) {
      localStorage.removeItem('token');
      window.location.href = '/login.html';
    }
  }
}

// --- Función para cambiar el estado del usuario ---
async function toggleUserStatus(userId) {
  if (typeof showConfirm === 'function') {
    showConfirm(`¿Estás seguro de cambiar el estado del usuario ID ${userId}?`, async (confirmed) => {
      if (confirmed) {
        try {
          const token = localStorage.getItem('token');
          if (!token) {
            showNotification('No autorizado. Por favor, inicie sesión.', true);
            window.location.href = '/login.html';
            return;
          }
          const userResponse = await fetch(`${API_URL}/users/${userId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (!userResponse.ok) {
            throw new Error('Error al obtener datos del usuario');
          }
          const user = await userResponse.json();
          const newStatus = user.active ? 'inactive' : 'active';
          const endpoint = newStatus === 'active' ? `/api/users/${userId}/approve` : `/api/users/${userId}/reject`;

          const response = await fetch(`${API_URL}${endpoint}`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `Error al cambiar estado: ${response.status}`);
          }
          showNotification('Estado del usuario actualizado', false);
          loadUsers();
        } catch (error) {
          console.error('Error al cambiar estado:', error);
          showNotification(error.message || 'Error al cambiar estado', true);
          if (error.message.includes('No autorizado')) {
            localStorage.removeItem('token');
            window.location.href = '/login.html';
          }
        }
      }
    });
  } else {
    const confirmed = confirm(`¿Estás seguro de cambiar el estado del usuario ID ${userId}?`);
    if (confirmed) {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          showNotification('No autorizado. Por favor, inicie sesión.', true);
          window.location.href = '/login.html';
          return;
        }
        const userResponse = await fetch(`${API_URL}/users/${userId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!userResponse.ok) {
          throw new Error('Error al obtener datos del usuario');
        }
        const user = await userResponse.json();
        const newStatus = user.active ? 'inactive' : 'active';
        const endpoint = newStatus === 'active' ? `/api/users/${userId}/approve` : `/api/users/${userId}/reject`;

        const response = await fetch(`${API_URL}${endpoint}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || `Error al cambiar estado: ${response.status}`);
        }
        showNotification('Estado del usuario actualizado', false);
        loadUsers();
      } catch (error) {
        console.error('Error al cambiar estado:', error);
        showNotification(error.message || 'Error al cambiar estado', true);
        if (error.message.includes('No autorizado')) {
          localStorage.removeItem('token');
          window.location.href = '/login.html';
        }
      }
    }
  }
}