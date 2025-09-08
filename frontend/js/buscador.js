// Variables globales
//const API_URL = 'http://localhost:3000/api'; // Descomentado para confirmar la URL
let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
let cart = JSON.parse(localStorage.getItem('cart')) || [];
let searchTimeout;
let indexToRemove = null;
let currentPage = 1;
let searchQuery = '';
let productLimit = 10;
let totalProducts = 0;
let totalPages = 1;
let hasPrevPage = false;
let hasNextPage = false;
let selectedCategory = 'all'; // Mantener para compatibilidad con categorías
let selectedProveedorId = ''; // Nueva variable para proveedor_id


/**
 * Limpia todos los backdrops residuales, restaura el estado del body y habilita el scroll.
 */

$(document).ready(function() {
    // Limpiar backdrops al cerrar el modal
    $(document).on('hidden.bs.modal', '#supplierModal', function () {
        $('.modal-backdrop').remove(); // Elimina todos los backdrops
        $('body').removeClass('modal-open'); // Restaura el estado del body
    });

    // Cerrar otros modales antes de abrir supplierModal
    $(document).on('show.bs.modal', '#supplierModal', function () {
        $('.modal').not(this).modal('hide'); // Cierra otros modales
    });
});

$(document).ready(function() {
    // Limpiar backdrops y cerrar otros modales
    $(document).on('hidden.bs.modal', '.modal', function () {
        $('.modal-backdrop').remove();
        $('body').removeClass('modal-open');
    });

    $(document).on('show.bs.modal', '.modal', function () {
        $('.modal').not(this).modal('hide'); // Cierra otros modales
    });
});


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

function closeCart() {
    const cartSidebar = document.getElementById('cartSidebar');
    if (cartSidebar) cartSidebar.classList.remove('show');
}

function closeModal() {
    document.querySelectorAll('.modal').forEach(modal => modal.classList.remove('show'));
}

const confirmationModal = document.getElementById('confirmationModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const downloadOrderBtn = document.getElementById('downloadOrderBtn');

function showConfirmationModal() {
    if (confirmationModal) confirmationModal.classList.add('show');
}

function hideConfirmationModal() {
    if (confirmationModal) {
        confirmationModal.classList.remove('show');
    }
}

if (closeModalBtn) closeModalBtn.addEventListener('click', hideConfirmationModal);
if (downloadOrderBtn) {
    downloadOrderBtn.addEventListener('click', () => {
        alert('Funcionalidad de descarga en desarrollo. ¡Pedido enviado con éxito!');
        hideConfirmationModal();
    });
}

if (confirmationModal) {
    confirmationModal.addEventListener('click', (event) => {
        if (event.target === confirmationModal) {
            hideConfirmationModal();
        }
    });
}

function openRequestModal() {
    const requestModal = document.getElementById('requestModal');
    if (requestModal) {
        requestModal.classList.add('show');
        const fullNameInput = document.getElementById('fullNameInput');
        const emailInput = document.getElementById('emailInput');
        const whatsappInput = document.getElementById('whatsappInput');
        const clientCodeDisplay = document.getElementById('clientCodeDisplay');

        if (currentUser) {
            if (fullNameInput && currentUser.fullName) fullNameInput.value = currentUser.fullName;
            else if (fullNameInput) fullNameInput.value = '';
            if (emailInput && currentUser.email) emailInput.value = currentUser.email;
            else if (emailInput) emailInput.value = '';
            if (whatsappInput && currentUser.whatsapp) whatsappInput.value = currentUser.whatsapp;
            else if (whatsappInput) whatsappInput.value = '';
            if (clientCodeDisplay && currentUser.client_code) clientCodeDisplay.textContent = currentUser.client_code;
            else if (clientCodeDisplay) clientCodeDisplay.textContent = 'No asignado';

            if (currentUser.email && currentUser.whatsapp) {
                document.querySelector('.contact-method-btn[data-method="both"]')?.click();
            } else if (currentUser.email) {
                document.querySelector('.contact-method-btn[data-method="email"]')?.click();
            } else if (currentUser.whatsapp) {
                document.querySelector('.contact-method-btn[data-method="whatsapp"]')?.click();
            } else {
                document.querySelectorAll('.contact-method-btn').forEach(btn => btn.classList.remove('selected'));
                document.querySelector('.contact-method-btn[data-method="email"]')?.classList.add('selected');
            }
        } else {
            if (fullNameInput) fullNameInput.value = '';
            if (emailInput) emailInput.value = '';
            if (whatsappInput) whatsappInput.value = '';
            if (clientCodeDisplay) clientCodeDisplay.textContent = 'Ej: Ucc-00001';
            document.querySelectorAll('.contact-method-btn').forEach(btn => btn.classList.remove('selected'));
            document.querySelector('.contact-method-btn[data-method="email"]')?.classList.add('selected');
        }

        const emailBtn = document.querySelector('.contact-method-btn[data-method="email"]');
        if (emailBtn && !document.querySelector('.contact-method-btn.selected')) {
            document.querySelectorAll('.contact-method-btn').forEach(b => b.classList.remove('selected'));
            emailBtn.classList.add('selected');
        }
        updateContactInputs();
        showOrder();
    } else {
        console.warn('Elemento #requestModal no encontrado');
        showNotification('Error: Modal de pedido no encontrado');
    }
}

function updateContactInputs() {
    const selectedBtn = document.querySelector('.contact-method-btn.selected');
    const contactMethod = selectedBtn ? selectedBtn.dataset.method : 'email';
    const emailInput = document.getElementById('emailInput');
    const whatsappInput = document.getElementById('whatsappInput');
    const emailInputGroup = document.getElementById('emailInputGroup');
    const whatsappInputGroup = document.getElementById('whatsappInputGroup');
    const contactInput = document.querySelector('.contact-input');

    if (!emailInput || !whatsappInput || !emailInputGroup || !whatsappInputGroup || !contactInput) {
        console.warn('Elementos de contacto no encontrados');
        showNotification('Error: Campos de contacto no encontrados', true);
        return;
    }

    contactInput.style.display = 'block';
    emailInputGroup.style.display = contactMethod === 'email' || contactMethod === 'both' ? 'block' : 'none';
    whatsappInputGroup.style.display = contactMethod === 'whatsapp' || contactMethod === 'both' ? 'block' : 'none';
    emailInput.disabled = contactMethod === 'whatsapp';
    whatsappInput.disabled = contactMethod === 'email';
    emailInput.required = contactMethod === 'email' || contactMethod === 'both';
    whatsappInput.required = contactMethod === 'whatsapp' || contactMethod === 'both';
}

function generateOrderText() {
    let contactInfo = '<h3>Información de Contacto:</h3>';
    contactInfo += `<p><strong>Usuario:</strong> ${currentUser ? DOMPurify.sanitize(currentUser.email) : 'Anónimo'}</p>`;
    contactInfo += `<p><strong>Código Cliente:</strong> ${currentUser ? DOMPurify.sanitize(currentUser.client_code) : 'N/A'}</p>`;

    const method = document.querySelector('.contact-method-btn.selected')?.dataset.method;
    const emailInput = document.getElementById('emailInput')?.value;
    const whatsappInput = document.getElementById('whatsappInput')?.value;

    if (method === 'email' && emailInput) {
        contactInfo += `<p><strong>Email de Contacto:</strong> ${DOMPurify.sanitize(emailInput)}</p>`;
    }
    if (method === 'whatsapp' && whatsappInput) {
        contactInfo += `<p><strong>WhatsApp de Contacto:</strong> ${DOMPurify.sanitize(whatsappInput)}</p>`;
    }
    if (method === 'both') {
        if (emailInput) contactInfo += `<p><strong>Email de Contacto:</strong> ${DOMPurify.sanitize(emailInput)}</p>`;
        if (whatsappInput) contactInfo += `<p><strong>WhatsApp de Contacto:</strong> ${DOMPurify.sanitize(whatsappInput)}</p>`;
    }

    let orderHtml = '<h3>Productos del Pedido:</h3>';
    orderHtml += '<table class="order-summary-table">';
    orderHtml += '<thead><tr><th>Código</th><th>Producto</th><th>USD Ref</th><th>Cantidad</th><th>Subtotal</th></tr></thead><tbody>';
    let total = 0;

    cart.forEach(item => {
        if (!item.code || !item.description || item.ref === undefined || item.quantity === undefined) return;

        const subtotal = parseFloat(item.ref) * parseFloat(item.quantity);
        total += subtotal;

        const refDisplay = parseFloat(item.ref) === 0 ? 'N/A' : `$${parseFloat(item.ref).toFixed(2)}`;

        orderHtml += `<tr>
                        <td>${DOMPurify.sanitize(item.code)}</td>
                        <td>${DOMPurify.sanitize(item.description)}</td>
                        <td>${DOMPurify.sanitize(refDisplay)}</td>
                        <td>${DOMPurify.sanitize(String(item.quantity))}</td>
                        <td>$${subtotal.toFixed(2)}</td>
                      </tr>`;
    });

    orderHtml += `</tbody><tfoot><tr><td colspan="4" class="total-label">Total:</td><td class="total-value">$${total.toFixed(2)}</td></tr></tfoot>`;
    orderHtml += '</table>';

    return contactInfo + orderHtml;
}

function generatePlaintextOrderSummary() {
    const fullNameInput = document.getElementById('fullNameInput')?.value?.trim();
    const clientCodeInput = document.getElementById('clientCodeInput')?.value?.trim();

    let orderDetails = '=== Pedido de Will Cars ===\n\n';

    orderDetails += 'Información de Contacto:\n';
    orderDetails += `Usuario: ${currentUser ? DOMPurify.sanitize(currentUser.email) : 'Anónimo'}\n`;
    orderDetails += `Código Cliente: ${currentUser ? DOMPurify.sanitize(currentUser.client_code) : 'N/A'}\n`;

    const method = document.querySelector('.contact-method-btn.selected')?.dataset.method;
    const emailInput = document.getElementById('emailInput')?.value;
    const whatsappInput = document.getElementById('whatsappInput')?.value;

    if (method === 'email' && emailInput) orderDetails += `Email de Contacto: ${DOMPurify.sanitize(emailInput)}\n`;
    if (method === 'whatsapp' && whatsappInput) orderDetails += `WhatsApp de Contacto: ${DOMPurify.sanitize(whatsappInput)}\n`;
    if (method === 'both') {
        if (emailInput) orderDetails += `Email de Contacto: ${DOMPurify.sanitize(emailInput)}\n`;
        if (whatsappInput) orderDetails += `WhatsApp de Contacto: ${DOMPurify.sanitize(whatsappInput)}\n`;
    }
    if (fullNameInput) orderDetails += `Nombre / Rif: ${DOMPurify.sanitize(fullNameInput)}\n`;
    if (clientCodeInput) orderDetails += `Código Cliente: ${DOMPurify.sanitize(clientCodeInput)}\n`;

    orderDetails += '\nProductos del Pedido:\n';
    orderDetails += '---------------------------------------------------------------------------------------------------\n';
    
    const HEADER_CODE = 'Código'.padEnd(11); 
    const HEADER_PRODUCT = 'Producto'.padEnd(25); 
    const HEADER_USD_REF = '(USD) Ref'.padEnd(12);
    const HEADER_SUBTOTAL = 'Subtotal'.padEnd(11);
    const HEADER_CANT = 'Cant.'.padEnd(7);     

    orderDetails += `${HEADER_CODE} | ${HEADER_PRODUCT} | ${HEADER_USD_REF} | ${HEADER_SUBTOTAL} | ${HEADER_CANT}\n`;
    orderDetails += `-----------|--------------------------|------------|-----------|-------\n`;

    let total = 0;

    cart.forEach(item => {
        if (!item.code || !item.description || item.ref === undefined || item.quantity === undefined) return;

        const itemRefValue = parseFloat(item.ref) || 0; 
        const subtotal = itemRefValue * parseFloat(item.quantity);
        total += subtotal;

        const code = String(DOMPurify.sanitize(item.code)).substring(0, 11).padEnd(11);
        const description = String(DOMPurify.sanitize(item.description)).substring(0, 25).padEnd(25); 
        const refDisplay = `USD$${itemRefValue.toFixed(2)}`;
        const ref = String(DOMPurify.sanitize(refDisplay)).substring(0, 12).padEnd(12); 
        const subtotalStr = `$${subtotal.toFixed(2)}`;
        const subtotalPadded = String(subtotalStr).substring(0, 11).padEnd(11); 
        const quantity = String(item.quantity);
        const quantityPadded = String(quantity).substring(0, 7).padEnd(7); 

        orderDetails += `${code} | ${description} | ${ref} | ${subtotalPadded} | ${quantityPadded}\n`;
    });

    orderDetails += `-----------|--------------------------|------------|-----------|-------\n`;
    const totalLineLength = 
        HEADER_CODE.length + 
        HEADER_PRODUCT.length + 
        HEADER_USD_REF.length + 
        HEADER_SUBTOTAL.length + 
        HEADER_CANT.length + 
        (5 - 1) * 3; 
    orderDetails += `Total: $${total.toFixed(2)}\n`.padStart(totalLineLength + `Total: $${total.toFixed(2)}\n`.length - 2); 
    orderDetails += '---------------------------------------------------------------------------------------------------\n';

    return orderDetails;
}

function generateOrderEmailBody() {
    const customerNameInput = document.getElementById('fullNameInput')?.value?.trim();
    const customerName = customerNameInput || 'Estimado Cliente';
    const clientCodeInput = document.getElementById('clientCodeInput')?.value?.trim();
    const clientCodeDisplay = clientCodeInput || (currentUser && currentUser.client_code ? DOMPurify.sanitize(currentUser.client_code) : 'N/A');
    const method = document.querySelector('.contact-method-btn.selected')?.dataset.method;
    const emailInput = document.getElementById('emailInput')?.value?.trim();
    const whatsappInput = document.getElementById('whatsappInput')?.value?.trim();

    let contactDetails = '';
    let contactPreferenceText = 'No especificado';
    let preferredContactForMessage = 'desconocido';

    if (method === 'email' && emailInput) {
        contactPreferenceText = 'Email';
        contactDetails = `Email: ${DOMPurify.sanitize(emailInput)}\n`;
        preferredContactForMessage = DOMPurify.sanitize(emailInput);
    } else if (method === 'whatsapp' && whatsappInput) {
        contactPreferenceText = 'WhatsApp';
        contactDetails = `WhatsApp: ${DOMPurify.sanitize(whatsappInput)}\n`;
        preferredContactForMessage = DOMPurify.sanitize(whatsappInput);
    } else if (method === 'both') {
        contactPreferenceText = 'Email y WhatsApp';
        contactDetails = `Email: ${DOMPurify.sanitize(emailInput) || 'N/A'}\nWhatsApp: ${DOMPurify.sanitize(whatsappInput) || 'N/A'}\n`;
        preferredContactForMessage = DOMPurify.sanitize(emailInput) || DOMPurify.sanitize(whatsappInput);
    }

    let emailBody = `¡Buen dia ${DOMPurify.sanitize(customerName)}!
    
Gracias por su pedido en WillCars. Hemos recibido su solicitud y está en proceso.Detalles de su Pedido: #(pendiente de confirmación)
Código Cliente: ${clientCodeDisplay}
Contacto Preferido: ${contactPreferenceText}
${contactDetails}
`;     const EMAIL_HEADER_CODE = 'Código'.padEnd(11);
     const EMAIL_HEADER_PRODUCT = 'Producto'.padEnd(25);
     const EMAIL_HEADER_USD_REF = '(USD) Ref'.padEnd(12);
     const EMAIL_HEADER_SUBTOTAL = 'Subtotal'.padEnd(11);
     const EMAIL_HEADER_CANT = 'Cant.'.padEnd(7);

     emailBody += `${EMAIL_HEADER_CODE} | ${EMAIL_HEADER_PRODUCT} | ${EMAIL_HEADER_USD_REF} | ${EMAIL_HEADER_SUBTOTAL} | ${EMAIL_HEADER_CANT}\n`;
     emailBody += `-----------|--------------------------|------------|-----------|-------\n`;

     let total = 0;

     cart.forEach(item => {
         if (!item.code || !item.description || item.ref === undefined || item.quantity === undefined) return;
         const subtotal = parseFloat(item.ref) * parseFloat(item.quantity);
         total += subtotal;

         const code = String(DOMPurify.sanitize(item.code)).substring(0, 11).padEnd(11);
         const description = String(DOMPurify.sanitize(item.description)).substring(0, 25).padEnd(25);
         const refDisplay = `USD$${parseFloat(item.ref).toFixed(2)}`;
         const ref = String(DOMPurify.sanitize(refDisplay)).substring(0, 12).padEnd(12);
         const subtotalStr = `$${subtotal.toFixed(2)}`;
         const subtotalPadded = String(subtotalStr).substring(0, 11).padEnd(11);
         const quantity = String(item.quantity);
         const quantityPadded = String(quantity).substring(0, 7).padEnd(7);

         emailBody += `${code} | ${description} | ${ref} | ${subtotalPadded} | ${quantityPadded}\n`;
     });

     emailBody += `-----------|--------------------------|------------|-----------|-------\n`;
     const totalLineLength = 
         EMAIL_HEADER_CODE.length + 
         EMAIL_HEADER_PRODUCT.length + 
         EMAIL_HEADER_USD_REF.length + 
         EMAIL_HEADER_SUBTOTAL.length + 
         EMAIL_HEADER_CANT.length + 
         (5 - 1) * 3; 
     emailBody += `Total: $${total.toFixed(2)}\n`.padStart(totalLineLength + `Total: $${total.toFixed(2)}\n`.length - 2); 
     
     emailBody += '\n';
     emailBody += `En breve nos pondremos en contacto con usted, a través de su método preferido (${preferredContactForMessage}).¡Gracias por su confianza!
Atentamente,
El equipo de WillCars
WillCars © ${new Date().getFullYear()}
`;     return emailBody;
 }

 function showOrder() {
     const orderSummary = document.getElementById('orderSummary');
     const downloadBtn = document.getElementById('downloadPreviewBtn');
     const buttonGroup = document.querySelector('.button-group');
     const showOrderBtn = document.getElementById('showOrderBtn');
     const sendOrderBtn = document.getElementById('sendOrderBtn');

     if (!orderSummary || !downloadBtn || !buttonGroup || !showOrderBtn || !sendOrderBtn) {
         showNotification('Error: No se pudieron encontrar todos los elementos necesarios del pedido en la página.', true);
         return;
     }

     const method = document.querySelector('.contact-method-btn.selected')?.dataset.method;
     const emailInput = document.getElementById('emailInput')?.value;
     const whatsappInput = document.getElementById('whatsappInput')?.value;

     if (!method) {
         showNotification('Por favor, selecciona un método de contacto.');
         return;
     }
     if ((method === 'email' || method === 'both') && (!emailInput || !emailInput.includes('@'))) {
         showNotification('Por favor, ingresa un email válido.');
         return;
     }
     if ((method === 'whatsapp' || method === 'both') && (!whatsappInput || whatsappInput.length < 7)) {
         showNotification('Por favor, ingresa un número de WhatsApp válido.');
         return;
     }

     if (cart.length === 0) {
         orderSummary.innerHTML = '<p>El carrito está vacío. Añade productos para ver tu pedido.</p>';
         orderSummary.style.display = 'block';
         downloadBtn.style.display = 'none';
         buttonGroup.style.display = 'none';
         showOrderBtn.style.display = 'block';
         return;
     }

     try {
         const orderHtml = generateOrderText();
         orderSummary.innerHTML = orderHtml;
         orderSummary.style.display = 'block';
         showOrderBtn.style.display = 'none';
         downloadBtn.style.display = 'block';
         buttonGroup.style.display = 'flex';

         downloadBtn.onclick = () => {
             try {
                 const plainTextEmailBody = generateOrderEmailBody();
                 const clientCodeForFileName = document.getElementById('clientCodeInput')?.value?.trim() || (currentUser ? currentUser.client_code : 'anon');
                 const blob = new Blob([plainTextEmailBody], { type: 'text/plain;charset=utf-8' });
                 const url = URL.createObjectURL(blob);
                 const a = document.createElement('a');
                 a.href = url;
                 a.download = `pedido_willcars_preview_${clientCodeForFileName}.txt`;
                 document.body.appendChild(a);
                 a.click();
                 document.body.removeChild(a);
                 URL.revokeObjectURL(url);
             } catch (error) {
                 console.error('Error al descargar el archivo de pedido:', error);
                 showNotification('Error al descargar la vista previa del pedido');
             }
         };
     } catch (error) {
         console.error('Error al preparar la vista del pedido:', error);
         showNotification('Error al mostrar el resumen del pedido.');
     }
 }

async function loadProducts(searchTerm = '', page = 1, limit = 10, category = selectedCategory, proveedorId = selectedProveedorId) {
    try {
        // Obtener proveedor_id de la URL para mantener el estado al recargar
        const urlParams = new URLSearchParams(window.location.search);
        const urlProveedorId = urlParams.get('proveedor_id') || '';
        proveedorId = urlProveedorId || proveedorId;

        // Construir la URL con parámetros
        let url = `${API_URL}/products/public?page=${page}&limit=${limit}`;
        if (searchTerm) url += `&search=${encodeURIComponent(searchTerm)}`;
        if (category !== 'all') url += `&category=${encodeURIComponent(category)}`;
        if (proveedorId) url += `&proveedor_id=${encodeURIComponent(proveedorId)}`;

        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        
        const data = await response.json();
        renderProducts(data.products);
        
        // Actualizar estado de paginación
        currentPage = data.currentPage || page;
        totalPages = data.totalPages || 1;
        hasPrevPage = currentPage > 1;
        hasNextPage = currentPage < totalPages;
        selectedProveedorId = proveedorId; // Actualizar variable global
        updatePaginationControls();
    } catch (error) {
        console.error('Error al cargar productos:', error);
        showNotification('Error al cargar productos', true);
    }
}

function updatePaginationControls() {
    const paginationInfoSpan = document.getElementById('paginationInfo');
    const prevButton = document.getElementById('paginationPrev');
    const nextButton = document.getElementById('paginationNext');

    if (paginationInfoSpan) {
        paginationInfoSpan.textContent = `Página ${currentPage} de ${totalPages}`;
    }

    if (prevButton) prevButton.disabled = !hasPrevPage;
    if (nextButton) nextButton.disabled = !hasNextPage;
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function resetSearch() {
    const searchInput = document.getElementById('searchProducts');
    const categoryButton = document.querySelector('.search-category-btn');
    if (searchInput) {
        searchInput.value = '';
        searchQuery = '';
        selectedCategory = 'all';
        selectedProveedorId = ''; // Resetear proveedor_id
        if (categoryButton) categoryButton.textContent = 'Proveedores'; // Mostrar "Proveedores" en el botón
        window.history.pushState({}, '', '/buscador.html'); // Resetear URL
        loadProducts('', 1, productLimit, 'all', ''); // Cargar todos los productos
    }
}

function renderProducts(filteredProducts) {
    const tbody = document.getElementById('productTableBody');
    const container = document.getElementById('productTableContainer');
    if (!tbody || !container) {
        console.error('Tabla de productos no encontrada');
        showNotification('Error: Tabla de productos no encontrada', true);
        return;
    }
    tbody.innerHTML = '';
    if (!Array.isArray(filteredProducts) || filteredProducts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="no-results">No se encontraron productos</td></tr>';
        return;
    }
    const fragment = document.createDocumentFragment();
    try {
        filteredProducts.forEach((product, index) => {
            console.log(`Procesando producto ${index}:`, product);
            if (!product.code || !product.description) {
                console.warn(`Producto ${index} con datos incompletos:`, product);
                return;
            }
            const imageSrc = product.image_path
                ? `http://localhost:3000${encodeURI(DOMPurify.sanitize(product.image_path)).replace(/%20/g, ' ')}`
                : '/img/willcars-1.jpg';
            const usdDisplay = parseFloat(product.usd || 0);
            const usdFormatted = isNaN(usdDisplay) || usdDisplay === 0 ? 'N/A' : `$${usdDisplay.toFixed(2)}`;
            const refDisplay = parseFloat(product.ref || 0);
            const refFormatted = isNaN(refDisplay) || refDisplay === 0 ? 'N/A' : `$${refDisplay.toFixed(2)}`;
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><img class="product-image" src="${imageSrc}" alt="${DOMPurify.sanitize(product.description || 'Producto')}" onerror="this.src='/img/willcars-1.jpg'" width="100" data-code="${DOMPurify.sanitize(product.code)}"></td>
                <td>${DOMPurify.sanitize(product.code || '')}</td>
                <td>${DOMPurify.sanitize(product.description || '')}</td>
                <td>${DOMPurify.sanitize(product.brand || '-')}</td>
                <td>${DOMPurify.sanitize(product.model || '-')}</td>
                <td>${usdFormatted}</td>
                <td>${refFormatted}</td>
                <td>${DOMPurify.sanitize(product.proveedor_id || '-')}</td>
                <td>
                    <button class="btn-action btn-cart" data-code="${DOMPurify.sanitize(product.code)}" title="Añadir al carrito"><i class="fas fa-cart-plus"></i></button>
                    <button class="btn-action btn-details" data-code="${DOMPurify.sanitize(product.code)}" title="Ver detalles"><i class="fas fa-info-circle"></i></button>
                </td>
            `;
            fragment.appendChild(row);
        });
        tbody.appendChild(fragment);
        tbody.querySelectorAll('.btn-cart').forEach(btn => {
            btn.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                const code = btn.dataset.code;
                const product = filteredProducts.find(p => p.code === code);
                if (product) addToCart(event, product);
            });
        });
        tbody.querySelectorAll('.btn-details').forEach(btn => {
            btn.addEventListener('click', () => showDetails(btn.dataset.code));
        });
        tbody.querySelectorAll('.product-image').forEach(img => {
            img.addEventListener('click', () => {
                const productCode = img.dataset.code;
                if (productCode) showDetails(productCode);
            });
        });
        console.log('Productos renderizados en la tabla');
    } catch (error) {
        console.error('Error al renderizar productos:', error);
        showNotification('Error al renderizar productos', true);
    }
}

async function loadSupplierLogos() {
    try {
        const response = await fetch(`${API_URL}/suppliers/logos`);
        const logos = await response.json();
        const container = document.getElementById('supplierLogosContainer');
        if (container) {
            container.innerHTML = '';
            logos.forEach(logo => {
                const img = document.createElement('img');
                img.src = DOMPurify.sanitize(logo.url);
                img.alt = DOMPurify.sanitize(logo.name);
                container.appendChild(img);
            });
        }
    } catch (error) {
        console.error('Error al cargar logos de proveedores:', error);
    }
}

async function addToCart(event, product) {
    event.preventDefault();
    event.stopPropagation();
    try {
        const existingItem = cart.find(item => item.code === product.code);
        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            cart.push({
                id: product.id,
                code: product.code,
                description: product.description,
                ref: parseFloat(product.ref || 0),
                quantity: 1
            });
        }
        localStorage.setItem('cart', JSON.stringify(cart));
        updateCartCount();
        renderCart();
        showNotification(`Producto ${product.description} añadido al carrito`, false);
    } catch (error) {
        console.error('Error al añadir al carrito:', error);
        showNotification('Error al añadir al carrito', true);
    }
}

async function showDetails(code) {
    try {
        const response = await fetch(`${API_URL}/products/${code}`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error al obtener producto');
        }
        const product = await response.json();
        const modalTitle = document.getElementById('modalTitle');
        const modalContent = document.getElementById('modalContent');
        const detailsModal = document.getElementById('detailsModal');
        const productImage = document.getElementById('productImage');
        if (!modalTitle || !modalContent || !detailsModal || !productImage) {
            console.error('Elementos del modal no encontrados');
            showNotification('Error: Modal de detalles no configurado');
            return;
        }
        modalTitle.textContent = product.description;
        const usdDetailDisplay = parseFloat(product.usd || 0);
        const usdDetailFormatted = usdDetailDisplay === 0 ? 'N/A' : `$${usdDetailDisplay.toFixed(2)}`;
        const refDetailDisplay = parseFloat(product.ref || 0);
        const refDetailFormatted = refDetailDisplay === 0 ? 'N/A' : `$${refDetailDisplay.toFixed(2)}`;
        modalContent.innerHTML = `
            <p><strong>Código:</strong> ${DOMPurify.sanitize(product.code)}</p>
            <p><strong>Descripción:</strong> ${DOMPurify.sanitize(product.description)}</p>
            <p><strong>Marca:</strong> ${DOMPurify.sanitize(product.brand || '-')}</p>
            <p><strong>Modelo:</strong> ${DOMPurify.sanitize(product.model || '-')}</p>
            <p><strong>Precio USD:</strong> ${usdDetailFormatted}</p>
            <p><strong>Ref:</strong> ${refDetailFormatted}</p>
            <p><strong>Proveedor:</strong> ${DOMPurify.sanitize(product.proveedor_id || '-')}</p>
            ${product.discount ? `<p><strong>Descuento:</strong> ${parseFloat(product.discount).toFixed(2)}%</p>` : ''}
        `;
        productImage.src = product.image_path
            ? `http://localhost:3000${encodeURI(DOMPurify.sanitize(product.image_path)).replace(/%20/g, ' ')}`
            : '/img/willcars-1.jpg';
        productImage.onerror = () => productImage.src = '/img/willcars-1.jpg';
        detailsModal.classList.add('show');
    } catch (error) {
        console.error('Error al mostrar detalles:', error);
        showNotification('Error al mostrar detalles: ' + error.message);
    }
}

function updateCartCount() {
    const totalItems = cart.reduce((sum, item) => sum + (item.quantity || 0), 0);
    document.querySelectorAll('.cart-count').forEach(el => el.textContent = totalItems);
}

function renderCart() {
    const cartItems = document.getElementById('cartItems');
    if (!cartItems) {
        console.warn('Elemento #cartItems no encontrado');
        return;
    }
    cartItems.innerHTML = '';
    let total = 0;
    cart.forEach((item, index) => {
        if (!item.code || !item.ref || !item.quantity) return;
        const subtotal = item.ref * item.quantity;
        total += subtotal;
        const refCartDisplay = item.ref === 0 ? 'N/A' : `$${item.ref.toFixed(2)}`;
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${DOMPurify.sanitize(item.code)}</td>
            <td>${DOMPurify.sanitize(item.description)}</td>
            <td>${refCartDisplay}</td>
            <td>
                <div class="quantity-controls">
                    <button class="quantity-btn cart-quantity-btn" data-index="${index}" data-action="decrease">-</button>
                    <span class="quantity-value">${item.quantity}</span>
                    <button class="quantity-btn cart-quantity-btn" data-index="${index}" data-action="increase">+</button>
                </div>
            </td>
            <td>$${subtotal.toFixed(2)}</td>
            <td>
                <button class="btn-action btn-cart delete-btn" data-index="${index}">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        cartItems.appendChild(row);
    });

    cartItems.querySelectorAll('.cart-quantity-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const index = parseInt(e.target.dataset.index);
            const action = e.target.dataset.action;
            if (action === 'increase') {
                updateQuantity(index, cart[index].quantity + 1);
            } else if (action === 'decrease' && cart[index].quantity > 1) {
                updateQuantity(index, cart[index].quantity - 1);
            } else if (action === 'decrease') {
                showConfirmModal(index);
            }
        });
    });

    cartItems.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const index = parseInt(e.target.closest('.delete-btn').dataset.index);
            showConfirmModal(index);
        });
    });

    const cartTotal = document.getElementById('cartTotal');
    if (cartTotal) cartTotal.textContent = `$${total.toFixed(2)}`;
}

function updateQuantity(index, newQuantity) {
    if (!cart[index]) return;
    newQuantity = parseInt(newQuantity);
    if (newQuantity >= 1) {
        cart[index].quantity = newQuantity;
        localStorage.setItem('cart', JSON.stringify(cart));
        updateCartCount();
        renderCart();
    } else {
        showConfirmModal(index);
    }
}

function showConfirmModal(index) {
    if (!cart[index]) return;
    indexToRemove = index;
    document.getElementById('confirmMessage').textContent = `¿Desea eliminar este producto: ${cart[index].description}?`;
    const confirmModal = document.getElementById('confirmModal');
    confirmModal?.classList.add('show');
}

function removeFromCart() {
    if (indexToRemove === null || !cart[indexToRemove]) return;
    const item = cart[indexToRemove];
    cart.splice(indexToRemove, 1);
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCount();
    renderCart();
    closeModal();
    indexToRemove = null;
    showNotification(`Producto ${item.description} eliminado del carrito`);
}

function openCart() {
    renderCart();
    document.getElementById('cartSidebar').classList.add('show');
}

function showLoginModal() {
    const loginModal = document.getElementById('loginModal');
    loginModal?.classList.add('show');
}

function showRegisterModal() {
    closeModal();
    const registerModal = document.getElementById('registerModal');
    registerModal?.classList.add('show');
}

async function sendOrder() {
    const method = document.querySelector('.contact-method-btn.selected')?.dataset.method;
    const emailInput = document.getElementById('emailInput')?.value?.trim();
    let whatsappInput = document.getElementById('whatsappInput')?.value?.trim();
    const customerNameInputElem = document.getElementById('fullNameInput');
    const customerName = customerNameInputElem ? customerNameInputElem.value.trim() : '';
    const customerCodeInputElem = document.getElementById('clientCodeInput');
    const customerCode = customerCodeInputElem ? customerCodeInputElem.value.trim() : '';

    if (!method) {
        showNotification('Selecciona un método de contacto.', true);
        return;
    }
    if ((method === 'email' || method === 'both') && (!emailInput || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput))) {
        showNotification('Ingresa un email válido.', true);
        return;
    }
    if ((method === 'whatsapp' || method === 'both') && (!whatsappInput || !/^\+?\d{10,15}$/.test(whatsappInput))) {
        showNotification('Ingresa un número de WhatsApp válido.', true);
        return;
    }
    if (!customerName) {
        showNotification('Por favor, ingresa el Nombre / Rif.', true);
        customerNameInputElem?.focus();
        return;
    }

    let whatsappInputNormalized = whatsappInput ? whatsappInput.replace(/\D/g, '') : '';
    if (whatsappInputNormalized && !whatsappInputNormalized.startsWith('+')) {
        whatsappInputNormalized = `+58${whatsappInputNormalized.replace(/^0/, '')}`;
    }

    if (cart.length === 0) {
        showNotification('El carrito está vacío.', true);
        return;
    }

    const itemsForOrder = cart.map(item => ({
        product_id: item.code,
        quantity: item.quantity,
        description: item.description,
        usd: parseFloat(item.usd || 0),
        ref: parseFloat(item.ref || item.usd || 0)
    }));

    const orderData = {
        contact_method: method,
        email: emailInput,
        whatsapp: whatsappInputNormalized,
        items: itemsForOrder,
        customer_name: customerName,
        customer_code: customerCode
    };

    try {
        // Mostrar el spinner de carga
        const loadingSpinner = document.getElementById('loadingSpinner');
        if (loadingSpinner) {
            loadingSpinner.classList.add('show');
        }

        const token = localStorage.getItem('token');
        const headers = {
            'Content-Type': 'application/json'
        };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        // Enviar pedido
        const response = await fetch(`${API_URL}/customer-orders`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(orderData)
        });

        // Ocultar el spinner
        if (loadingSpinner) {
            loadingSpinner.classList.remove('show');
        }

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Error ${response.status}: ${errorData.message || 'Error al enviar el pedido'}`);
        }

        const newOrder = await response.json();

        // Cerrar el modal de solicitud
        hideRequestModal();

        // Mostrar el modal de confirmación por 5 segundos
        showConfirmationModal();
        setTimeout(() => {
            hideConfirmationModal();
        }, 5000);

        // Mostrar notificación adicional
        showNotification(`¡Excelente! Pedido #${newOrder.order_id} enviado con éxito!`, false);

        // Limpiar carrito
        cart = [];
        localStorage.setItem('cart', JSON.stringify(cart));
        updateCartCount();
        renderCart();

        // Emitir evento WebSocket
        if (typeof socket !== 'undefined' && socket.connected) {
            socket.emit('newOrder', { order: newOrder });
        }

    } catch (error) {
        // Ocultar el spinner en caso de error
        const loadingSpinner = document.getElementById('loadingSpinner');
        if (loadingSpinner) {
            loadingSpinner.classList.remove('show');
        }

        console.error('Error al enviar pedido:', error);
        showNotification(`Error al enviar pedido: ${error.message}`, true);
    }
}

function hideRequestModal() {
    const requestModal = document.getElementById('requestModal');
    if (requestModal) {
        requestModal.classList.remove('show');
    }
}

function logout() {
    currentUser = null;
    localStorage.removeItem('currentUser');
    localStorage.removeItem('token');
    showNotification('Sesión cerrada');
    updateLoginButton();
}

function updateLoginButton() {
    const loginButton = document.getElementById('loginButton');
    const adminLink = document.getElementById('adminLink');
    if (loginButton) {
        if (currentUser) {
            loginButton.textContent = `Logout (${currentUser.email})`;
            adminLink?.classList.toggle('d-none', currentUser.role !== 'admin');
        } else {
            loginButton.textContent = 'Login';
            adminLink?.classList.add('d-none');
        }
    }
}

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded ejecutado. Inicializando buscador.js...');
    loadProducts();
    updateCartCount();
    renderCart();
    updateLoginButton();
    if (localStorage.getItem('darkMode') === 'true') {
        document.body.classList.add('dark-mode');
    }

    // Verificar jQuery y Bootstrap
    if (typeof $ === 'undefined') {
        console.error('jQuery no está cargado. Asegúrate de incluir <script src="https://code.jquery.com/jquery-3.5.1.min.js"> antes de Bootstrap.');
        showNotification('Error: jQuery no está cargado', true);
        return;
    }
    if (typeof $.fn.modal === 'undefined') {
        console.error('Bootstrap modal no está cargado. Asegúrate de incluir <script src="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/js/bootstrap.min.js">.');
        showNotification('Error: Bootstrap no está cargado', true);
        return;
    }

    // Limpiar cualquier backdrop residual al cargar la página
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => backdrop.remove());
    document.body.classList.remove('modal-open');
    document.body.style.overflow = ''; // Restaurar scroll
    console.log('Backdrops iniciales limpiados');

    // Manejar clics en los logotipos del modal
    const supplierLinks = document.querySelectorAll('.supplier-logo');
    console.log('Logotipos encontrados:', supplierLinks.length);
    supplierLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Clic en logotipo:', link.getAttribute('data-proveedor-id'));
            const proveedorId = link.getAttribute('data-proveedor-id') || '';
            searchQuery = ''; // Resetear búsqueda
            currentPage = 1; // Volver a la primera página
            selectedCategory = 'all'; // Resetear categoría
            selectedProveedorId = proveedorId; // Actualizar proveedor
            // Actualizar URL sin recargar
            const newUrl = proveedorId ? `/buscador.html?proveedor_id=${proveedorId}` : '/buscador.html';
            window.history.pushState({}, '', newUrl);
            loadProducts('', 1, productLimit, 'all', proveedorId);
            // Cerrar el modal y limpiar backdrop
            $('#supplierModal').modal('hide');
            setTimeout(() => {
                document.querySelectorAll('.modal-backdrop').forEach(backdrop => backdrop.remove());
                document.body.classList.remove('modal-open');
                document.body.style.overflow = ''; // Restaurar scroll
                console.log('Modal cerrado y backdrop limpiado');
            }, 500);
        });
    });

    // Manejar clic en el backdrop del modal
    const supplierModal = document.getElementById('supplierModal');
    if (supplierModal) {
        supplierModal.addEventListener('click', (e) => {
            if (e.target === supplierModal) {
                console.log('Clic en backdrop de supplierModal');
                $('#supplierModal').modal('hide');
                setTimeout(() => {
                    document.querySelectorAll('.modal-backdrop').forEach(backdrop => backdrop.remove());
                    document.body.classList.remove('modal-open');
                    document.body.style.overflow = ''; // Restaurar scroll
                    console.log('Backdrop cerrado y limpiado');
                }, 500);
            }
        });
    }

    // Manejar botón "Cerrar" del modal
    const supplierCloseBtn = document.querySelector('#supplierModal .btn-secondary');
    if (supplierCloseBtn) {
        supplierCloseBtn.addEventListener('click', () => {
            console.log('Clic en botón Cerrar de supplierModal');
            $('#supplierModal').modal('hide');
            setTimeout(() => {
                document.querySelectorAll('.modal-backdrop').forEach(backdrop => backdrop.remove());
                document.body.classList.remove('modal-open');
                document.body.style.overflow = ''; // Restaurar scroll
                console.log('Modal cerrado desde botón Cerrar');
            }, 500);
        });
    }

    // Manejar cierre del modal con el botón de cruz
    const supplierCloseCross = document.querySelector('#supplierModal .close');
    if (supplierCloseCross) {
        supplierCloseCross.addEventListener('click', () => {
            console.log('Clic en cruz de supplierModal');
            $('#supplierModal').modal('hide');
            setTimeout(() => {
                document.querySelectorAll('.modal-backdrop').forEach(backdrop => backdrop.remove());
                document.body.classList.remove('modal-open');
                document.body.style.overflow = ''; // Restaurar scroll
                console.log('Modal cerrado desde cruz');
            }, 500);
        });
    }

    // Manejar otros modales para evitar problemas similares
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                console.log(`Clic en backdrop de modal: ${this.id}`);
                $(this).modal('hide');
                setTimeout(() => {
                    document.querySelectorAll('.modal-backdrop').forEach(backdrop => backdrop.remove());
                    document.body.classList.remove('modal-open');
                    document.body.style.overflow = ''; // Restaurar scroll
                    console.log(`Backdrop de ${this.id} limpiado`);
                }, 500);
            }
        });
    });
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', () => {
            console.log(`Clic en botón cerrar de modal: ${closeBtn.closest('.modal')?.id}`);
            if (closeBtn.closest('#cartSidebar')) {
                closeCart();
            } else {
                closeModal();
                setTimeout(() => {
                    document.querySelectorAll('.modal-backdrop').forEach(backdrop => backdrop.remove());
                    document.body.classList.remove('modal-open');
                    document.body.style.overflow = ''; // Restaurar scroll
                    console.log('Modal genérico cerrado y backdrop limpiado');
                }, 500);
            }
        });
    });

    // Resto del código de DOMContentLoaded
    const categoryItems = document.querySelectorAll('.search-category-menu .dropdown-item');
    const categoryButton = document.querySelector('.search-category-btn');
    if (categoryItems && categoryButton) {
        categoryItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                selectedCategory = e.target.getAttribute('data-category');
                categoryButton.textContent = e.target.textContent;
                selectedProveedorId = ''; // Resetear proveedor al seleccionar categoría
                window.history.pushState({}, '', '/buscador.html'); // Resetear URL
                loadProducts(searchQuery, 1, productLimit, selectedCategory);
            });
        });
    }

    const cartIconDesktop = document.getElementById('cartIconDesktop');
    const requestOrderBtn = document.getElementById('requestOrderBtn');
    const clearCartBtn = document.getElementById('clearCartBtn');
    const showOrderBtn = document.getElementById('showOrderBtn');
    const sendOrderBtn = document.getElementById('sendOrderBtn');
    const cancelOrderBtn = document.getElementById('cancelOrderBtn');
    const searchProducts = document.getElementById('searchProducts');
    const resetSearchBtn = document.getElementById('resetSearchBtn');
    const loginButton = document.getElementById('loginButton');
    const showRegisterLink = document.getElementById('showRegisterLink');
    const showLoginLink = document.getElementById('showLoginLink');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const confirmYes = document.getElementById('confirmYes');
    const confirmCancel = document.getElementById('confirmCancel');
    const continueShoppingBtn = document.getElementById('continueShoppingBtn');
    const themeToggle = document.getElementById('themeToggle');
    const paginationPrev = document.getElementById('paginationPrev');
    const paginationNext = document.getElementById('paginationNext');
    const downloadPreviewBtn = document.getElementById('downloadPreviewBtn');
    const downloadOrderBtn = document.getElementById('downloadOrderBtn');

    if (paginationPrev) {
        paginationPrev.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                loadProducts(searchQuery, currentPage, productLimit, selectedCategory, selectedProveedorId);
            }
        });
    }

    if (paginationNext) {
        paginationNext.addEventListener('click', () => {
            if (currentPage < totalPages) {
                currentPage++;
                loadProducts(searchQuery, currentPage, productLimit, selectedCategory, selectedProveedorId);
            }
        });
    }

    if (cartIconDesktop) {
        cartIconDesktop.addEventListener('click', (e) => {
            e.preventDefault();
            openCart();
        });
    }

    if (requestOrderBtn) requestOrderBtn.addEventListener('click', openRequestModal);
    if (clearCartBtn) {
        clearCartBtn.addEventListener('click', () => {
            if (cart.length === 0) {
                showNotification('El carrito ya está vacío');
                return;
            }
            document.getElementById('confirmMessage').textContent = '¿Desea vaciar todo el carrito?';
            const confirmModal = document.getElementById('confirmModal');
            confirmModal?.classList.add('show');
            const confirmYes = document.getElementById('confirmYes');
            confirmYes.onclick = () => {
                cart = [];
                localStorage.setItem('cart', JSON.stringify(cart));
                updateCartCount();
                renderCart();
                closeModal();
                showNotification('Carrito vaciado');
            };
        });
    }
    if (showOrderBtn) showOrderBtn.addEventListener('click', showOrder);
    if (sendOrderBtn) sendOrderBtn.addEventListener('click', sendOrder);
    if (cancelOrderBtn) cancelOrderBtn.addEventListener('click', closeModal);
    if (downloadPreviewBtn) downloadPreviewBtn.addEventListener('click', () => {
        const plainTextEmailBody = generateOrderEmailBody();
        const clientCodeForFileName = document.getElementById('clientCodeInput')?.value?.trim() || (currentUser ? currentUser.client_code : 'anon');
        const blob = new Blob([plainTextEmailBody], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pedido_willcars_preview_${clientCodeForFileName}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
    if (downloadOrderBtn) downloadOrderBtn.addEventListener('click', () => {
        alert('Funcionalidad de descarga en desarrollo. ¡Pedido enviado con éxito!');
        hideConfirmationModal();
    });
    if (searchProducts) {
        const debouncedSearch = debounce((searchTerm) => {
            searchQuery = searchTerm;
            loadProducts(searchTerm, 1, productLimit, selectedCategory, selectedProveedorId);
        }, 300);
        searchProducts.addEventListener('input', (e) => {
            debouncedSearch(e.target.value);
        });
    }
    if (resetSearchBtn) resetSearchBtn.addEventListener('click', (e) => {
        e.preventDefault();
        resetSearch();
    });
    if (loginButton) loginButton.addEventListener('click', (e) => {
        e.preventDefault();
        if (currentUser) logout();
        else showLoginModal();
    });
    if (showRegisterLink) showRegisterLink.addEventListener('click', showRegisterModal);
    if (showLoginLink) showLoginLink.addEventListener('click', showLoginModal);
    if (loginForm) loginForm.addEventListener('submit', async e => {
        e.preventDefault();
        const email = document.getElementById('loginEmail')?.value.toLowerCase();
        const password = document.getElementById('loginPassword')?.value;
        if (!email || !password) {
            showNotification('Por favor, completa todos los campos');
            return;
        }
        try {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await response.json();
            if (data.token) {
                currentUser = {
                    email: data.user.email,
                    role: data.user.role,
                    client_code: data.user.client_code,
                    name: data.user.name,
                    whatsapp: data.user.whatsapp
                };
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
                localStorage.setItem('token', data.token);
                showNotification(`¡Bienvenido, ${email}!`);
                updateLoginButton();
                closeModal();
            } else {
                showNotification(data.error || 'Email o contraseña incorrectos');
            }
        } catch (error) {
            console.error('Error al iniciar sesión:', error);
            showNotification('Error al iniciar sesión. Intenta de nuevo.');
        }
    });
    if (registerForm) registerForm.addEventListener('submit', async e => {
        e.preventDefault();
        const name = document.getElementById('registerName')?.value;
        const email = document.getElementById('registerEmail')?.value.toLowerCase();
        const password = document.getElementById('registerPassword')?.value;
        const confirmPassword = document.getElementById('confirmPassword')?.value;
        const role = document.getElementById('registerRole')?.value;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!name || name.length < 3) {
            showNotification('El nombre debe tener al menos 3 caracteres', true);
            return;
        }
        if (!emailRegex.test(email)) {
            showNotification('Por favor, ingresa un email válido', true);
            return;
        }
        if (password !== confirmPassword) {
            showNotification('Las contraseñas no coinciden', true);
            return;
        }
        try {
            const response = await fetch(`${API_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password, role })
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Error al registrar');
            }
            currentUser = {
                email: data.user.email,
                role: data.user.role,
                client_code: data.user.client_code,
                name: data.user.name,
                whatsapp: data.user.whatsapp
            };
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            localStorage.setItem('token', data.token);
            showNotification('Registro exitoso. ¡Bienvenido!', false);
            updateLoginButton();
            closeModal();
        } catch (error) {
            console.error('Error al registrar:', error);
            showNotification(`Error: ${error.message}`, true);
        }
    });
    if (confirmYes) confirmYes.addEventListener('click', removeFromCart);
    if (confirmCancel) confirmCancel.addEventListener('click', closeModal);
    if (continueShoppingBtn) continueShoppingBtn.addEventListener('click', closeCart);
    if (themeToggle) themeToggle.addEventListener('click', toggleDarkMode);

    document.querySelectorAll('.contact-method-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.contact-method-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            updateContactInputs();
        });
    });
});

    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', () => {
            if (closeBtn.closest('#cartSidebar')) closeCart();
            else {
                closeModal();
                setTimeout(() => {
                    document.querySelectorAll('.modal-backdrop').forEach(backdrop => backdrop.remove());
                    document.body.classList.remove('modal-open');
                }, 300);
            }
        });
    });
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                $(this).modal('hide');
                setTimeout(() => {
                    document.querySelectorAll('.modal-backdrop').forEach(backdrop => backdrop.remove());
                    document.body.classList.remove('modal-open');
                }, 300);
            }
        });
    });


if (typeof io !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
        const socket = io('http://localhost:3000', {
            auth: { token },
            transports: ['websocket', 'polling'],
            reconnectionAttempts: 3,
            reconnectionDelay: 1000
        });

        socket.on('connect', () => {
            console.log('WebSocket conectado en buscador.js, socket ID:', socket.id);
            showNotification('Conexión en tiempo real establecida', false);
        });

        socket.on('connect_error', async (err) => {
            console.error('Error de conexión WebSocket:', err.message);
            if (err.message.includes('jwt expired')) {
                try {
                    const response = await fetch(`${API_URL}/auth/refresh-token`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: currentUser?.email })
                    });
                    const data = await response.json();
                    if (response.ok && data.token) {
                        localStorage.setItem('token', data.token);
                        socket.auth.token = data.token;
                        socket.connect();
                        showNotification('Sesión renovada, conexión en tiempo real restablecida', false);
                    } else {
                        throw new Error(data.error || 'No se pudo renovar la sesión');
                    }
                } catch (error) {
                    console.error('Error al refrescar token:', error);
                    showNotification('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.', true);
                    logout();
                }
            } else {
                showNotification('Error de conexión en tiempo real. Intenta recargar la página.', true);
            }
        });

        socket.on('productUpdated', (data) => {
            console.log('Producto actualizado:', data);
            loadProducts(searchQuery, currentPage, productLimit, selectedCategory, selectedProveedorId);
        });

        socket.on('newOrder', (data) => {
            console.log('Nuevo pedido recibido:', data);
            showNotification(`Tu pedido #${data.order.order_id} ha sido creado con éxito!`, false);
        });

        socket.on('disconnect', () => {
            console.log('WebSocket desconectado');
            showNotification('Conexión en tiempo real perdida', true);
        });
    } else {
        console.warn('No hay token, WebSocket no iniciado');
        showNotification('Inicia sesión para recibir actualizaciones en tiempo real.', true);
    }
}