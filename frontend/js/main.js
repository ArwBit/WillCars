(function ($) {
    "use strict";

    // Dropdown on mouse hover
    $(document).ready(function () {
        function toggleNavbarMethod() {
            if ($(window).width() > 992) {
                const $dropdowns = $('.navbar .dropdown');
                if ($dropdowns.length) {
                    $dropdowns.on('mouseover', function () {
                        $('.dropdown-toggle', this).trigger('click');
                    }).on('mouseout', function () {
                        $('.dropdown-toggle', this).trigger('click').blur();
                    });
                }
            } else {
                $('.navbar .dropdown').off('mouseover').off('mouseout');
            }
        }
        toggleNavbarMethod();
        $(window).resize(toggleNavbarMethod);

        // Registro de proveedores
        const registerRole = document.getElementById('registerRole');
        if (registerRole) {
            registerRole.addEventListener('change', (e) => {
                document.getElementById('proveedorNameGroup').style.display = e.target.value === 'proveedor' ? 'block' : 'none';
            });
        }

        const registerForm = document.getElementById('registerForm');
        if (registerForm) {
            registerForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const name = document.getElementById('registerName').value;
                const email = document.getElementById('registerEmail').value;
                const password = document.getElementById('registerPassword').value;
                const confirmPassword = document.getElementById('confirmPassword').value;
                const role = document.getElementById('registerRole').value;
                const proveedorName = document.getElementById('proveedorName').value;

                if (password !== confirmPassword) {
                    showNotification('Las contraseñas no coinciden', true);
                    return;
                }

                try {
                    const response = await fetch('http://localhost:3000/api/register', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name, email, password, role, proveedorName })
                    });

                    const result = await response.json();
                    if (!response.ok) throw new Error(result.error || 'Error al registrarse');

                    showNotification('Registro exitoso', false);
                    document.getElementById('registerModal').style.display = 'none';
                    document.getElementById('loginModal').style.display = 'block';
                } catch (error) {
                    showNotification(`Error: ${error.message}`, true);
                }
            });
        }
    });

    // Interceptor para añadir el token a solicitudes API
    const originalFetch = window.fetch;
    window.fetch = async (url, options = {}) => {
        const token = localStorage.getItem('token');
        if (url.startsWith('http://localhost:3000/api') && token && token !== 'null' && token !== 'undefined') {
            options.headers = {
                ...options.headers,
                'Authorization': `Bearer ${token}`
            };
        }
        try {
            return await originalFetch(url, options);
        } catch (error) {
            console.error('Error en fetch:', error);
            throw error;
        }
    };

    // Back to top button
    $(window).scroll(function () {
        const $backToTop = $('.back-to-top');
        if ($backToTop.length) {
            if ($(this).scrollTop() > 100) {
                $backToTop.fadeIn('slow');
            } else {
                $backToTop.fadeOut('slow');
            }
        }
    });
    $('.back-to-top').click(function () {
        $('html, body').animate({scrollTop: 0}, 1500, 'easeInOutExpo');
        return false;
    });

    // Vendor carousel
    if ($('.vendor-carousel').length) {
        $('.vendor-carousel').owlCarousel({
            loop: true,
            margin: 29,
            nav: false,
            autoplay: true,
            smartSpeed: 1000,
            responsive: {
                0: { items: 2 },
                576: { items: 3 },
                768: { items: 4 },
                992: { items: 5 },
                1200: { items: 6 }
            }
        });
    }

    // Related carousel
    if ($('.related-carousel').length) {
        $('.related-carousel').owlCarousel({
            loop: true,
            margin: 29,
            nav: false,
            autoplay: true,
            smartSpeed: 1000,
            responsive: {
                0: { items: 1 },
                576: { items: 2 },
                768: { items: 3 },
                992: { items: 4 }
            }
        });
    }

    // Product Quantity
    $('.quantity button').on('click', function () {
        var button = $(this);
        var $input = button.parent().parent().find('input');
        if ($input.length) {
            var oldValue = $input.val();
            var newVal;
            if (button.hasClass('btn-plus')) {
                newVal = parseFloat(oldValue) + 1;
            } else {
                newVal = parseFloat(oldValue) > 0 ? parseFloat(oldValue) - 1 : 0;
            }
            $input.val(newVal);
        }
    });

    console.log('main.js cargado correctamente');
})(jQuery);

function showNotification(message, isError = false) {
    const alert = document.createElement('div');
    alert.className = `custom-alert ${isError ? 'error' : ''}`;
    alert.textContent = message;
    document.body.appendChild(alert);
    alert.style.position = 'fixed';
    alert.style.top = '20px';
    alert.style.right = '20px';
    alert.style.padding = '15px';
    alert.style.borderRadius = '5px';
    alert.style.zIndex = '1000';
    alert.style.backgroundColor = isError ? '#dc3545' : '#28a745';
    alert.style.color = 'white';
    setTimeout(() => alert.remove(), 3000);
}