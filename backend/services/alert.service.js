// src/services/alert.service.js
import axios from 'axios';
import { logger } from '../utils/logger.js';

class AlertService {
    async sendWhatsAppMessage(phone, message) {
        const token = process.env.CALLMEBOT_API_KEY;

        if (!phone || !token) {
            logger.error("❌ Teléfono o token no configurados.");
            return {
                success: false,
                error: "Número de teléfono no enviado o token no definido en variables de entorno."
            };
        }

        const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodeURIComponent(message)}&apikey=${token}`;

        try {
            const response = await axios.get(url);
            const responseText = response.data;

            const isSuccess = typeof responseText === 'string' && (
                responseText.includes('Message queued') ||
                responseText.includes('Message sent successfully')
            );

            if (isSuccess) {
                logger.info(`✅ Mensaje enviado a WhatsApp (${phone})`);
                return {
                    success: true,
                    message: 'Mensaje enviado correctamente.',
                    rawResponse: responseText
                };
            } else {
                logger.warn(`⚠️ Respuesta inesperada: ${responseText}`);
                return {
                    success: false,
                    error: 'Respuesta inesperada del servicio de WhatsApp.',
                    rawResponse: responseText
                };
            }
        } catch (error) {
            logger.error(`❌ Error al enviar WhatsApp: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    generarMensaje(producto) {
        return `⚠️ *ALERTA DE STOCK* ⚠️\n\n` +
            `🧾 Producto: *${producto.DESCRIPCION}*\n` +
            `📦 Código: ${producto.CODIGO}\n` +
            `🔢 Stock Total: ${producto.STOCK_TOTAL}\n` +
            `📉 Punto de Reorden: ${producto.PUNTO_REORDEN}\n` +
            `📆 Fecha Reposición Ideal: ${producto.FECHA_REPOSICION}\n` +
            `⏳ Días de cobertura: ${producto.DIAS_COBERTURA}\n` +
            `❌ Déficit: ${producto.DEFICIT} unidades\n` +
            `📦 Pedir: ${producto.CAJAS_A_PEDIR} cajas / ${producto.UNIDADES_A_PEDIR} unidades\n\n` +
            `💬 Revisa y actúa pronto.`;
    }

    async evaluarYEnviarAlerta(prediction, phone) {
        if (!prediction.success) {
            return { success: false, error: "Predicción inválida." };
        }

        const producto = prediction.data;
        const debeAlertar = producto.alerta_stock || producto.DEFICIT > 0 || producto.STOCK_TOTAL < producto.PUNTO_REORDEN;

        if (!debeAlertar) {
            logger.info(`No se requiere alerta para producto ${producto.CODIGO}`);
            return { success: false, message: "No se requiere alerta." };
        }

        const mensaje = this.generarMensaje(producto);
        return await this.sendWhatsAppMessage(phone, mensaje);
    }
}

export default new AlertService();
