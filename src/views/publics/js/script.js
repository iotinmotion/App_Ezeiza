document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Lógica de Modo Oscuro
    const themeToggle = document.getElementById('themeToggle');
    const currentTheme = localStorage.getItem('theme');

    if (currentTheme) {
        document.documentElement.setAttribute('data-theme', currentTheme);
    }

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            let theme = document.documentElement.getAttribute('data-theme');
            if (theme === 'dark') {
                document.documentElement.setAttribute('data-theme', 'light');
                localStorage.setItem('theme', 'light');
            } else {
                document.documentElement.setAttribute('data-theme', 'dark');
                localStorage.setItem('theme', 'dark');
            }
        });
    }

    // 2. RESPUESTA A TU PREGUNTA: Validación de Formulario de Login
    const loginForm = document.getElementById('loginForm');
    
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            let isValid = true;
            const usernameInput = document.getElementById('username');
            const passwordInput = document.getElementById('password');
            const userError = document.getElementById('userError');
            const passError = document.getElementById('passError');

            // Resetear errores
            userError.style.display = 'none';
            passError.style.display = 'none';

            if (!usernameInput.value.trim()) {
                userError.textContent = 'El usuario es requerido';
                userError.style.display = 'block';
                isValid = false;
            }

            if (!passwordInput.value.trim()) {
                passError.textContent = 'La contraseña es requerida';
                passError.style.display = 'block';
                isValid = false;
            }

            if (!isValid) {
                e.preventDefault(); // Evita que se envíe el formulario
            }
        });
    }

    // 3. Inicialización de WebSocket para Dashboard
    const summaryGrid = document.getElementById('summaryGrid');
    if (summaryGrid) {
        initDashboardUpdates(summaryGrid);
    }
});

/**
 * Función para manejar actualizaciones en tiempo real vía WebSocket
 * @param {HTMLElement} summaryGridElement - Elemento contenedor de las tarjetas de resumen
 */
function initDashboardUpdates(summaryGridElement) {
    // Verificar si la librería socket.io está cargada
    if (typeof io === 'undefined') {
        console.error('Error: La librería Socket.io no está cargada. Verifique la conexión con el servidor.');
        return;
    }

    const socket = io();
    const statusBadge = document.getElementById('connectionStatus');
    const sensorGrid = document.getElementById('sensorGrid');
    const rawDataGrid = document.getElementById('rawDataGrid');
    
    // Obtener el ID de la app desde el atributo data del HTML
    const userApp = summaryGridElement.dataset.appId;

    // Eventos de conexión
    socket.on('connect', () => {
        if (statusBadge) statusBadge.style.display = 'none';
        if (userApp) socket.emit('request_dashboard_data', userApp);
    });

    socket.on('disconnect', () => {
        if (statusBadge) statusBadge.style.display = 'inline-block';
    });

    // Escuchar actualizaciones del servidor
    socket.on('dashboard_update', (data) => {
        // 1. Actualizar Tarjetas de Resumen (cards-grid)
        if (data.zones) {
            data.zones.forEach(zone => {
                // Buscar tarjeta existente por atributo data-zone-name de forma segura
                const card = Array.from(summaryGridElement.children).find(el => el.dataset.zoneName === String(zone.name));

                if (card) {
                    // Actualizar estado (clase)
                    card.className = `card status-${zone.status}`;
                    // Actualizar número
                    const numberEl = card.querySelector('.number');
                    if (numberEl) numberEl.textContent = zone.carts;
                    // Actualizar etiqueta
                    const labelEl = card.querySelector('.label');
                    if (labelEl) labelEl.textContent = zone.footer_card;
                } else {
                    // Crear nueva tarjeta si no existe (fallback)
                    const newCardHTML = `
                        <div class="card status-${zone.status}" data-zone-name="${zone.name}">
                            <div class="card-header"><h3>${zone.name}</h3></div>
                            <div class="card-body">
                                <div class="metric"><span class="number">${zone.carts}</span><span class="label">${zone.footer_card}</span></div>
                            </div>
                        </div>`;
                    summaryGridElement.insertAdjacentHTML('beforeend', newCardHTML);
                }
            });
        }

        // 2. Actualizar Cuadrícula de Sensores (split-card -> sensor-grid)
        if (sensorGrid && data.cartDetails) {
            // Ordenar los datos por porcentaje (menor a mayor)
            const sortedDetails = [...data.cartDetails].sort((a, b) => a.percentage - b.percentage);

            sortedDetails.forEach(cart => {
                const zoneName = String(cart.zone || 'Zona');
                let sensor = Array.from(sensorGrid.children).find(el => el.dataset.sensorZone === zoneName);

                if (sensor) {
                    sensor.style.backgroundColor = cart.color || '#999';
                    sensor.setAttribute('data-tooltip', `Carritos: ${cart.cart_counter}`);
                    // El porcentaje es el segundo div hijo
                    if (sensor.children[1]) sensor.children[1].textContent = `${cart.percentage}%`;
                } else {
                    sensor = document.createElement('div');
                    sensor.className = 'sensor-square fade-in';
                    sensor.setAttribute('data-tooltip', `Carritos: ${cart.cart_counter}`);
                    sensor.style.backgroundColor = cart.color || '#999';
                    sensor.setAttribute('data-sensor-zone', zoneName);
                    sensor.innerHTML = `
                        <div style="font-size: 0.7em; margin-bottom: 2px;">${zoneName}</div>
                        <div>${cart.percentage}%</div>`;
                }
                // appendChild mueve el elemento al final si ya existe, logrando el ordenamiento visual
                sensorGrid.appendChild(sensor);
            });
        }

        // 3. Actualizar Información Adicional (rawData)
        if (rawDataGrid && data.rawData) {
            // Ordenar por color: Rojo (#dc3545) primero, Verde (#28a745) último
            const colorPriority = { '#dc3545': 1, '#fd7e14': 2, '#28a745': 3 };
            const getPriority = (c) => colorPriority[c] || 4;
            const sortedRawData = [...data.rawData].sort((a, b) => getPriority(a.color) - getPriority(b.color));

            rawDataGrid.innerHTML = sortedRawData.map(doc => {
                const borderColor = doc.color || 'transparent';
                const content = Object.keys(doc).map(key => {
                    let val = doc[key];
                    if (typeof val === 'object' && val !== null) val = JSON.stringify(val);
                    return `<div style="font-size: 0.75em; overflow-wrap: break-word;"><strong>${key}:</strong> ${val}</div>`;
                }).join('');
                return `<div class="card" style="border-left: 5px solid ${borderColor};"><div class="card-body">${content}</div></div>`;
            }).join('');
        }
    });
}