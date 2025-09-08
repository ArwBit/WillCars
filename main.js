// frontend/js/main.js
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
        $('#registerForm').on('submit', async function(e) {
            e.preventDefault();
            const name = $('#registerName').val();
            const email = $('#registerEmail').val().toLowerCase();
            const password = $('#registerPassword').val();
            const confirmPassword = $('#confirmPassword').val();
            const proveedor_id = $('#proveedor_id').val();

            if (password !== confirmPassword) {
                showNotification('Las contraseñas no coinciden', true);
                return;
            }
            if (password.length < 6) {
                showNotification('La contraseña debe tener al menos 6 caracteres', true);
                return;
            }
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                showNotification('Por favor, ingresa un email válido', true);
                return;
            }
            if (!proveedor_id) {
                showNotification('Por favor, ingresa un ID de proveedor válido', true);
                return;
            }

            try {
                const response = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, password, role: 'proveedor', status: 'pending', proveedor_id })
                });
                if (!response.ok) throw new Error((await response.json()).message || 'Error al registrar');
                showNotification('Registro enviado, pendiente de aprobación', false);
                $('#registerForm')[0].reset();
                $('#registerModal').modal('hide'); // Usar Bootstrap para cerrar el modal
            } catch (error) {
                showNotification(`Error: ${error.message}`, true);
            }
        });

        // Mostrar modales con Bootstrap
        $('#showRegisterLink').click(function(e) {
            e.preventDefault();
            $('#loginModal').modal('hide');
            $('#registerModal').modal('show');
        });

        $('#showLoginLink').click(function(e) {
            e.preventDefault();
            $('#registerModal').modal('hide');
            $('#loginModal').modal('show');
        });
    });

    // ... (resto del código de main.js sin cambios)

    console.log('main.js cargado correctamente');
})(jQuery);

function showNotification(message, isError = false) {
    const alert = $('<div class="custom-alert ' + (isError ? 'error' : '') + '">' + message + '</div>');
    $('body').append(alert);
    alert.fadeIn(300).delay(2000).fadeOut(300, function() {
        $(this).remove();
    });
}