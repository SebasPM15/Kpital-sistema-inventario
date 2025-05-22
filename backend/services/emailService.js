import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { text } from 'stream/consumers';

dotenv.config();

//Configurar transporter para nodemailer
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    },
});

class EmailService {
    async sendEmail(to, subject, html) {
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to,
            subject,
            html,
        };

        try {
            await transporter.sendMail(mailOptions);
            console.log(`Correo de verificación enviado a ${to}`);
        } catch (error) {
            console.error('Error al enviar el correo de verificación:', error);
            throw new Error('No se pudo enviar el correo de verificación');
        }
    }
    
    async sendVerificationEmail(toEmail, verificationCode) {
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: toEmail,
            subject: 'Código de Verificación - Plannink',
            text: `Tu código de verificación es: ${verificationCode}. Válido por 15 minutos.`,
            html: `
                <h2>Verificación de Cuenta - Plannink</h2>
                <p>Gracias por registrarte en Plannink.</p>
                <p>Tu código de verificación es: <strong>${verificationCode}</strong></p>
                <p>Este código es válido por 15 minutos. Ingresa este código en la página de verificación para completar tu registro.</p>
                <p>Si no solicitaste este código, ignora este mensaje.</p>
            `,
        };

        try {
            await transporter.sendMail(mailOptions);
            console.log(`Correo de verificación enviado a ${toEmail}`);
        } catch (error) {
            console.error('Error al enviar el correo de verificación:', error);
            throw new Error('No se pudo enviar el correo de verificación');
        }
    }
};

export default new EmailService();