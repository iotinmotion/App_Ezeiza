const processCartData = (data) => {
    if (!data) return [];

    return data.map(cart => {
        // Asegurar que sean números para evitar errores de cálculo
        const current = Number(cart.cart_counter) || 0;
        const max = Number(cart.cart_counter_max) || 1; // Evitar división por cero
        
                let percentage = 0;
        if (max > 0) {
            percentage = Math.round((current / max) * 100);
        }

        return {
            ...cart,
            percentage: percentage, // Dato listo para el front

            color: cart.color || '#999'
        };
    }).sort((a, b) => {
        // Lógica de Ordenamiento: Rojo (1) -> Naranja (2) -> Verde (3) -> Otros (4)
        const getColorPriority = (color) => {
            const c = color.toLowerCase();
            if (c.includes('dc3545') || c.includes('e74c3c') || c.includes('red')) return 1;
            if (c.includes('fd7e14') || c.includes('f1c40f') || c.includes('orange')) return 2;
            if (c.includes('28a745') || c.includes('green')) return 3;
            return 4;
        };

        const priorityA = getColorPriority(a.color);
        const priorityB = getColorPriority(b.color);


        if (priorityA !== priorityB) {
            return priorityA - priorityB;
        }
        // Si tienen el mismo color, ordenar por porcentaje ascendente

        return a.percentage - b.percentage;
    });
};

const calculateZonesMetrics = (cartDetails) => {
    let totalCarritos = 0;
    let criticalZones = 0;
    let completeZones = 0;
    let totalPercentage = 0;

    cartDetails.forEach(cart => {
        totalCarritos += Number(cart.cart_counter) || 0;
        if (cart.percentage <= 20) criticalZones++;
        if (cart.percentage >= 80) completeZones++;
        totalPercentage += cart.percentage;
    });

    const avgPercentage = cartDetails.length > 0 ? Math.round(totalPercentage / cartDetails.length) : 0;

    return [
        { name: 'Total de Carritos', carts: totalCarritos, status: 'ok', footer_card: 'Detectados en tiempo real' },
        { name: 'Promedio Llenado', carts: avgPercentage + '%', status: avgPercentage < 30 ? 'low' : 'ok', footer_card: 'Promedio General' },
        { name: 'Zonas Críticas', carts: criticalZones, status: 'critical', footer_card: 'Nivel Bajo (<20%)' },
        { name: 'Zonas Completas', carts: completeZones, status: 'ok', footer_card: 'Nivel Alto (>80%)' }
    ];
};

module.exports = { processCartData, calculateZonesMetrics };