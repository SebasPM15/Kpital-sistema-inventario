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
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD || !process.env.EMAIL_HOST || !process.env.EMAIL_PORT) {
            logger.error('❌ Configuración de email incompleta');
            throw new Error('Las credenciales de email no están configuradas');
        }

        return nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: parseInt(process.env.EMAIL_PORT, 10),
            secure: process.env.EMAIL_PORT === '465', // true para puerto 465, false para otros
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD,
            },
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
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif; color: #333; max-width: 650px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
            <!-- Encabezado -->
            <div style="background: linear-gradient(90deg, #003087 0%, #0052cc 100%); padding: 20px; color: white;">
            <h2 style="margin: 0; font-size: 24px; font-weight: 600;">⚠️ Alerta de Stock Crítico</h2>
            <p style="margin: 5px 0 0; font-size: 14px; opacity: 0.9;">Sistema Automático de Gestión de Inventarios</p>
            </div>
            
            <!-- Cuerpo -->
            <div style="padding: 25px; background: #ffffff;">
            <h3 style="margin: 0 0 10px; color: #003087; font-size: 20px; font-weight: 600;">${producto.DESCRIPCION}</h3>
            <p style="color: #666; font-size: 14px; margin: 0 0 20px;">
                <strong>Código:</strong> ${producto.CODIGO} | 
                <strong>Periodo:</strong> ${proyeccion.mes}
            </p>

            <!-- Información de Stock -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px;">
                <div style="background: #f8fafc; padding: 15px; border-radius: 6px; border: 1px solid #e0e0e0;">
                <h4 style="margin: 0 0 10px; color: #003087; font-size: 16px; font-weight: 600;">Estado del Stock</h4>
                <p style="margin: 5px 0; font-size: 14px;"><strong>Inicial:</strong> ${proyeccion.stock_inicial.toFixed(2)} unidades</p>
                <p style="margin: 5px 0; font-size: 14px;"><strong>Proyectado:</strong> ${proyeccion.stock_proyectado.toFixed(2)} unidades</p>
                <p style="margin: 5px 0; font-size: 14px;"><strong>Días de cobertura:</strong> ${Math.round(proyeccion.tiempo_cobertura)} días</p>
                </div>
                
                <div style="background: #f8fafc; padding: 15px; border-radius: 6px; border: 1px solid #e0e0e0;">
                <h4 style="margin: 0 0 10px; color: #003087; font-size: 16px; font-weight: 600;">Acción Requerida</h4>
                <p style="margin: 5px 0; font-size: 14px;">
                    <strong>Estado:</strong> 
                    <span style="color: ${proyeccion.deficit > 0 ? '#d32f2f' : '#388e3c'}">
                    ${proyeccion.deficit > 0 ? 'DÉFICIT' : 'Stock suficiente'}
                    </span>
                </p>
                <p style="margin: 5px 0; font-size: 14px;">
                    <strong>Acción:</strong> ${proyeccion.accion_requerida}
                </p>
                <p style="margin: 5px 0; font-size: 14px;">
                    <strong>Unidades a pedir:</strong> ${proyeccion.unidades_a_pedir.toFixed(2)} unidades
                </p>
                <p style="margin: 5px 0; font-size: 14px;">
                    <strong>Cajas a pedir:</strong> ${proyeccion.cajas_a_pedir} cajas
                </p>
                </div>
            </div>

            <!-- Fechas Clave -->
            <div style="background: #e3f2fd; padding: 15px; border-radius: 6px; border: 1px solid #bbdefb; margin-bottom: 20px;">
                <h4 style="margin: 0 0 10px; color: #003087; font-size: 16px; font-weight: 600;">Fechas Clave</h4>
                <p style="margin: 5px 0; font-size: 14px;">
                <strong>Fecha de solicitud:</strong> ${proyeccion.fecha_solicitud}
                </p>
                <p style="margin: 5px 0; font-size: 14px;">
                <strong>Fecha de reposición:</strong> ${proyeccion.fecha_reposicion}
                </p>
                <p style="margin: 5px 0; font-size: 14px;">
                <strong>Fecha estimada de arribo:</strong> ${proyeccion.fecha_arribo}
                </p>
            </div>

            <!-- Advertencia -->
            <div style="background: #fff3cd; padding: 15px; border-radius: 6px; border: 1px solid #ffeeba;">
                <p style="margin: 0; font-size: 14px; color: #856404; font-weight: 500;">
                ⚠️ Se detectó un nivel de stock crítico con ${Math.round(proyeccion.tiempo_cobertura)} días de cobertura. 
                Se recomienda tomar acción inmediata.
                </p>
            </div>
            </div>

            <!-- Pie de página -->
            <div style="background: #f8fafc; padding: 15px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #e0e0e0;">
            <p style="margin: 0;">
                Sistema Automático de Alertas de Stock | ${new Date().toLocaleString('es-ES', {
                dateStyle: 'medium',
                timeStyle: 'short',
                })}
            </p>
            <p style="margin: 5px 0 0;">
                Este es un correo automático, por favor no respondas directamente. 
                Contacta a <a href="mailto:${process.env.EMAIL_USER}" style="color: #0052cc;">${process.env.EMAIL_USER}</a> para soporte.
            </p>
            </div>
        </div>
        `;
    }

    async evaluarYEnviarAlerta(prediction, email, isManual = false) {
        if (!prediction.success || !prediction.data) {
            return { success: false, error: "Predicción inválida." };
        }

        const producto = prediction.data;

        if (!producto.PROYECCIONES || producto.PROYECCIONES.length === 0) {
            return { success: false, error: "No hay proyecciones disponibles." };
        }

        const primeraProyeccion = producto.PROYECCIONES[0];
        const hoy = new Date().toDateString();

        // Verificar condiciones para enviar alerta
        const debeAlertar =
            primeraProyeccion.tiempo_cobertura <= 10 ||
            primeraProyeccion.alerta_stock ||
            primeraProyeccion.deficit > 0;

        if (!debeAlertar) {
            logger.info(`No se requiere alerta para producto ${producto.CODIGO}`);
            return { success: false, message: "No se requiere alerta." };
        }

        // Evitar envío redundante si no es manual
        if (!isManual && this.lastSentDates.get(producto.CODIGO) === hoy) {
            logger.info(`Alerta ya enviada hoy para producto ${producto.CODIGO}`);
            return {
                success: false,
                message: "Alerta ya enviada hoy.",
                alreadySent: true,
            };
        }

        // Generar asunto más específico
        const nivelUrgencia = primeraProyeccion.tiempo_cobertura <= 5 ? 'URGENTE' : 'CRÍTICO';
        const subject = `[${nivelUrgencia}] ${producto.DESCRIPCION} - Stock bajo en ${primeraProyeccion.mes} (${Math.round(primeraProyeccion.tiempo_cobertura)} días)`;

        const html = this.generarMensajeHTML(producto);
        const result = await this.sendEmail(email, subject, html);

        if (result.success && !isManual) {
            this.lastSentDates.set(producto.CODIGO, hoy);
        }

        return {
            ...result,
            urgency: nivelUrgencia.toLowerCase(),
            details: {
                productCode: producto.CODIGO,
                coverageDays: Math.round(primeraProyeccion.tiempo_cobertura),
                deficit: primeraProyeccion.deficit,
                unitsToOrder: primeraProyeccion.unidades_a_pedir,
                boxesToOrder: primeraProyeccion.cajas_a_pedir,
            },
        };
    }
}

export default new AlertService();