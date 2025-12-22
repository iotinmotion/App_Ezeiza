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
    const mapElement = document.getElementById('map');
    let currentFilter = 'all';
    let lastRawData = []; // Almacenar últimos datos para filtrar localmente
    let lastCartDetails = []; // Almacenar últimos datos de mapa para filtrar localmente
    let mapInstance;
    let mapMarkers = [];
    
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

    // 4. Inicialización de Mapa (si existe el elemento y Leaflet está cargado)
    if (mapElement && typeof L !== 'undefined') {
        // Zoom ajustado a 17 (alejado un 20% respecto a 18)
        mapInstance = L.map('map').setView([-34.81191701488496, -58.542542882351924], 17);
        
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }).addTo(mapInstance);

        // Leyenda Flotante
        const legend = L.control({ position: 'bottomright' });
        legend.onAdd = function (map) {
            const div = L.DomUtil.create('div', 'info legend');
            div.style.backgroundColor = 'white';
            div.style.padding = '10px';
            div.style.borderRadius = '8px';
            div.style.boxShadow = '0 0 15px rgba(0,0,0,0.2)';
            div.innerHTML = `
                <h4 style="margin:0 0 8px;font-size:14px;font-weight:bold;">Referencias</h4>
                <div style="display:flex;align-items:center;margin-bottom:5px;">
                    <span style="background:#dc3545;width:12px;height:12px;border-radius:50%;display:inline-block;margin-right:8px;"></span>
                    <span style="font-size:12px;">Crítico (0-20%)</span>
                </div>
                <div style="display:flex;align-items:center;margin-bottom:5px;">
                    <span style="background:#fd7e14;width:12px;height:12px;border-radius:50%;display:inline-block;margin-right:8px;"></span>
                    <span style="font-size:12px;">Medio (20-80%)</span>
                </div>
                <div style="display:flex;align-items:center;">
                    <span style="background:#28a745;width:12px;height:12px;border-radius:50%;display:inline-block;margin-right:8px;"></span>
                    <span style="font-size:12px;">Completo (80-100%)</span>
                </div>
            `;
            return div;
        };
        legend.addTo(mapInstance);
    }

    // Configurar botones de filtro
    const filterButtons = document.querySelectorAll('.btn-filter');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Actualizar estado visual de botones
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Actualizar filtro y renderizar
            currentFilter = btn.dataset.filter;
            if (lastRawData.length > 0) {
                renderRawData(lastRawData);
            }
            if (lastCartDetails.length > 0) {
                renderMapMarkers(lastCartDetails);
            }
        });
    });

    // Función auxiliar para renderizar Información Adicional
    const renderRawData = (dataList) => {
        if (!rawDataGrid) return;

        // Filtrar datos
        const filteredData = dataList.filter(doc => {
            if (currentFilter === 'all') return true;
            const color = (doc.color || '').toLowerCase();
            if (currentFilter === 'critico') return color === '#dc3545';
            if (currentFilter === 'medio') return color === '#fd7e14';
            if (currentFilter === 'completo') return color === '#28a745';
            return true;
        });

        // Ordenar por color: Rojo (#dc3545) primero, Verde (#28a745) último
        const colorPriority = { '#dc3545': 1, '#fd7e14': 2, '#28a745': 3 };
        const getPriority = (c) => colorPriority[c] || 4;
        const sortedRawData = [...filteredData].sort((a, b) => getPriority(a.color) - getPriority(b.color));

        rawDataGrid.innerHTML = sortedRawData.map(doc => {
            const maxVal = doc.cart_counter_max || 1;
            const pct = doc.percentage !== undefined ? doc.percentage : Math.round((doc.cart_counter / maxVal) * 100);
            const color = doc.color || '#999';
            const missing = Math.max(0, maxVal - doc.cart_counter);
            
            return `
            <div class="card" style="padding: 15px; border-left: 5px solid ${color};">
                <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 10px; border-bottom: 1px solid #eee; margin-bottom: 10px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <h4 style="margin: 0; font-size: 1.1em;">${doc.zone || 'Zona'}</h4>
                        <span style="background-color: ${color}; width: 15px; height: 15px; border-radius: 50%; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.1);"></span>
                    </div>
                    <svg viewBox="0 0 36 36" style="width: 50px; height: 50px; cursor: help;" title="Faltan ${missing} carritos para llenar">
                        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#eee" stroke-width="3" />
                        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="${color}" stroke-width="3" stroke-dasharray="${pct}, 100" style="transition: stroke-dasharray 0.5s ease;" />
                        <text x="18" y="20.35" text-anchor="middle" fill="#333" font-size="10px" font-weight="bold">${pct}%</text>
                    </svg>
                </div>
                <div style="display: flex; align-items: center; gap: 8px; color: #666;">
                    <span style="font-size: 1.2em;">🛒</span>
                    <span style="font-weight: 600; font-size: 0.95em;">${doc.cart_counter} / ${doc.cart_counter_max}</span>
                </div>
            </div>`;
        }).join('');
    };

    // Función auxiliar para renderizar Marcadores en el Mapa
    const renderMapMarkers = (details) => {
        if (!mapInstance) return;

        // Limpiar marcadores existentes
        mapMarkers.forEach(marker => mapInstance.removeLayer(marker));
        mapMarkers = [];

        // Filtrar datos
        const filteredDetails = details.filter(zone => {
            if (currentFilter === 'all') return true;
            const color = (zone.color || '').toLowerCase();
            if (currentFilter === 'critico') return color === '#dc3545';
            if (currentFilter === 'medio') return color === '#fd7e14';
            if (currentFilter === 'completo') return color === '#28a745';
            return true;
        });

        filteredDetails.forEach(zone => {
            if (zone.location && Array.isArray(zone.location) && zone.location.length >= 2) {
                const maxVal = zone.cart_counter_max || 1;
                const pct = zone.percentage !== undefined ? zone.percentage : Math.round((zone.cart_counter / maxVal) * 100);
                
                const marker = L.circleMarker(zone.location, {
                    radius: 10,
                    fillColor: zone.color,
                    color: '#fff',
                    weight: 2,
                    opacity: 1,
                    fillOpacity: 0.8
                }).addTo(mapInstance);
                
                marker.bindPopup(`
                    <div style="text-align:center;">
                        <strong style="font-size:1.1em;">${zone.zone || 'Zona'}</strong><br>
                        <span style="color:${zone.color};font-weight:bold;font-size:1.2em;">${pct}%</span> Ocupación<br>
                        <span style="font-size:0.9em;color:#666;">${zone.cart_counter} / ${maxVal} carritos</span>
                    </div>
                `);
                mapMarkers.push(marker);
            }
        });
    };

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
            lastRawData = data.rawData; // Guardar datos para filtrado local
            renderRawData(lastRawData);
        }

        // 4. Actualizar Mapa en Tiempo Real
        if (mapInstance && data.cartDetails) {
            lastCartDetails = data.cartDetails;
            renderMapMarkers(lastCartDetails);
        }
    });
}