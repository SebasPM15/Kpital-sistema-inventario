import AlertService from '../services/alert.service.js';

export const evaluarAlertaYNotificar = async (req, res) => {
    const { predictionData, email, isManual = false } = req.body;

    if (!predictionData || !email) {
        return res.status(400).json({
            success: false,
            error: 'Faltan datos requeridos: predictionData o email.',
        });
    }

    try {
        // Validar estructura de predictionData
        if (!predictionData.success || !predictionData.data || !predictionData.data.CODIGO) {
            return res.status(400).json({
                success: false,
                error: 'Estructura de predictionData inválida.',
            });
        }

        // Validar formato de email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                error: 'Formato de email inválido.',
            });
        }

        const resultado = await AlertService.evaluarYEnviarAlerta(predictionData, email, isManual);

        if (resultado.alreadySent) {
            return res.status(200).json({
                success: false,
                message: 'Alerta ya fue enviada hoy. Puede reenviar manualmente si es necesario.',
                canResend: true,
                details: resultado.details,
            });
        }

        if (!resultado.success) {
            return res.status(202).json({
                ...resultado,
                canResend: isManual ? false : true,
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Alerta enviada correctamente.',
            isManual,
            sentAt: new Date().toISOString(),
            details: resultado.details,
        });
    } catch (error) {
        logger.error(`Error en alertas: ${error.message}`, {
            error: error.stack,
            payload: { email, isManual },
        });

        return res.status(500).json({
            success: false,
            error: 'Error interno al procesar la alerta.',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        });
    }
};