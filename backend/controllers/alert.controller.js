// src/controllers/alert.controller.js
import AlertService from '../services/alert.service.js';

export const evaluarAlertaYNotificar = async (req, res) => {
    const { predictionData, phone } = req.body;

    if (!predictionData || !phone) {
        return res.status(400).json({ error: "Faltan datos: predictionData o phone." });
    }

    try {
        const resultado = await AlertService.evaluarYEnviarAlerta(predictionData, phone);
        return res.status(resultado.success ? 200 : 202).json(resultado);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
