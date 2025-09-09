document.addEventListener('DOMContentLoaded', function() {
    // Resaltar página activa
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        const link = item.querySelector('a');
        if (link) {
            const href = link.getAttribute('href');
            item.classList.toggle('active', href === currentPage);
        }
    });

    // Configurar búsqueda
    setupSearch();
    
    // Configurar notificaciones
    setupNotifications();
});

function setupSearch() {
    const searchInput = document.querySelector('.search-bar input');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();
            console.log(`Buscando: ${searchTerm}`);
            if (typeof window.pageSpecificSearch === 'function') {
                window.pageSpecificSearch(searchTerm);
            }
        });
    }
}

function showConfirm(message, callback) {
    const confirmed = confirm(message);
    callback(confirmed);
}

function setupNotifications() {
    const notifications = document.querySelector('.notifications');
    if (notifications) {
        notifications.addEventListener('click', function() {
            alert('Mostrando notificaciones...');
        });
    }
}