// src/services/alert.service.js
import nodemailer from 'nodemailer';
import { logger } from '../utils/logger.js';
import dotenv from 'dotenv';
dotenv.config();

class AlertService {
    constructor() {
        this.lastSentDates = new Map(); // Almacena las últimas fechas de envío por producto
    }

    // Configuración del transporter para enviar emails
    createTransporter() {
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
            logger.error('❌ Configuración de email incompleta');
            throw new Error('Las credenciales de email no están configuradas');
        }  
        
        return nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD,
            },
            tls: {
                rejectUnauthorized: false // Solo para desarrollo
            }
        });
    }

    async sendEmail(to, subject, html) {
        try {
            if (!to || !subject || !html) {
                throw new Error('Faltan parámetros para enviar el email');
            }
            
            const transporter = this.createTransporter();

            const mailOptions = {
                from: `"Sistema de Alertas" <${process.env.EMAIL_USER}>`,
                to: to,
                subject: subject,
                html: html,
            };

            const info = await transporter.sendMail(mailOptions);
            logger.info(`✅ Email enviado a ${to}`, info.messageId);
            return {
                success: true,
                message: 'Correo enviado correctamente.',
                messageId: info.messageId
            };
        } catch (error) {
            logger.error(`❌ Error al enviar email: ${error.message}`);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    generarMensajeHTML(producto) {
        const proyeccion = producto.PROYECCIONES[0];

        return `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px;">
        <div style="background-color: #d9534f; padding: 15px; border-radius: 5px 5px 0 0;">
          <h2 style="color: white; margin: 0;">⚠️ ALERTA DE STOCK CRÍTICO ⚠️</h2>
        </div>
        
        <div style="padding: 20px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 5px 5px;">
          <h3 style="margin-top: 0; color: #d9534f;">${producto.DESCRIPCION}</h3>
          <p style="color: #6c757d; margin-top: -10px; font-size: 0.9em;">
            <strong>Periodo:</strong> ${proyeccion.mes} | 
            <strong>Código:</strong> ${producto.CODIGO}
          </p>
          
          <div style="display: flex; margin: 15px 0; gap: 10px;">
            <div style="flex: 1; background-color: #f8f9fa; padding: 10px; border-radius: 5px;">
              <h4 style="margin-top: 0; color: #d9534f;">Stock</h4>
              <p><strong>Inicial:</strong> ${proyeccion.stock_inicial} unidades</p>
              <p><strong>Proyectado:</strong> ${proyeccion.stock_proyectado} unidades</p>
              <p><strong>Días cobertura:</strong> ${Math.round(proyeccion.tiempo_cobertura)} días</p>
            </div>
            
            <div style="flex: 1; background-color: #f8f9fa; padding: 10px; border-radius: 5px;">
              <h4 style="margin-top: 0; color: #d9534f;">Acción requerida</h4>
              <p><strong>${proyeccion.deficit > 0 ? 'DÉFICIT' : 'Stock suficiente'}</strong></p>
              <p>${proyeccion.accion_requerida}</p>
              <p><strong>Fecha reposición:</strong> ${proyeccion.fecha_reposicion}</p>
            </div>
          </div>
          
          <div style="margin-top: 20px; padding: 10px; background-color: #fff3cd; border-radius: 5px;">
            <p style="margin: 0; font-weight: bold;">⚠️ Atención: Stock crítico detectado con 10 días de anticipación</p>
          </div>
        </div>
        
        <p style="font-size: 0.8em; color: #6c757d; text-align: center; margin-top: 20px;">
          Sistema Automático de Alertas de Stock | ${new Date().toLocaleDateString()}
        </p>
      </div>
    `;
    }

    async evaluarYEnviarAlerta(prediction, email, isManual = false) {
        if (!prediction.success) {
            return { success: false, error: "Predicción inválida." };
        }

        const producto = prediction.data;

        if (!producto.PROYECCIONES || producto.PROYECCIONES.length === 0) {
            return { success: false, error: "No hay proyecciones disponibles." };
        }

        const primeraProyeccion = producto.PROYECCIONES[0];
        const hoy = new Date().toDateString();

        // Verificar si hay alerta
        const debeAlertar = primeraProyeccion.tiempo_cobertura <= 10 ||
            primeraProyeccion.alerta_stock ||
            primeraProyeccion.deficit > 0;

        if (!debeAlertar) {
            logger.info(`No se requiere alerta para producto ${producto.CODIGO}`);
            return { success: false, message: "No se requiere alerta." };
        }

        // Verificar si ya se envió hoy (solo para envíos automáticos)
        if (!isManual && this.lastSentDates.get(producto.CODIGO) === hoy) {
            logger.info(`Alerta ya enviada hoy para producto ${producto.CODIGO}`);
            return { 
                success: false, 
                message: "Alerta ya enviada hoy.",
                alreadySent: true
            };
        }

        const subject = `[ALERTA] ${producto.DESCRIPCION} - Stock crítico en ${primeraProyeccion.mes}`;
        const html = this.generarMensajeHTML(producto);

        const result = await this.sendEmail(email, subject, html);

        if (result.success && !isManual) {
            this.lastSentDates.set(producto.CODIGO, hoy);
        }

        return result;
    }
}

export default new AlertService();