import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';
import Session from '../models/Session.js';
import generateToken from '../utils/generateToken.js';
import { generateVerificationCode } from '../utils/generateVerificationCode.js';
import emailService from './emailService.js';

class AuthService {
    async register(nombre, email, password, celular) {
        // Verificar si el usuario existe
        const existingUser = await User.findOne({ where: { email } });

        // Si el usuario existe y no está verificado, sobrescribir el registro
        if (existingUser) {
            if (existingUser.is_verified) {
                throw new Error('El correo ya está registrado y verificado');
            }
            // Sobreescribir datos del usuario no verificado
            const passwordHash = await bcrypt.hash(password, 10);
            const verificationCode = generateVerificationCode();
            const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos de validez

            await existingUser.update({
                password_hash: passwordHash,
                nombre,
                celular,
                verification_code: verificationCode,
                verification_code_expires: expiresAt,
                updated_at: new Date(),
            });

            // Enviar el correo con el código de verificación
            await emailService.sendVerificationEmail(email, verificationCode);

            // Devolver confirmación sin código
            return { user: existingUser, message: 'Se ha enviado un nuevo código de verificación a tu correo' };
        }

        // Crear nuevo usuario
        const passwordHash = await bcrypt.hash(password, 10);
        const verificationCode = generateVerificationCode();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos de validez

        const user = await User.create({
            nombre,
            email,
            password_hash: passwordHash,
            celular,
            verification_code: verificationCode,
            verification_code_expires: expiresAt,
            is_verified: false
        });

        // Enviar el correo con el código de verificación
        await emailService.sendVerificationEmail(email, verificationCode);

        // Devolver confirmación sin código
        return { user, message: 'Se ha enviado un código de verificación a tu correo' };
    }

    async resendVerificationCode(email) {
        // Buscar el usuario por email
        const user = await User.findOne({ where: { email } });
        if (!user) throw new Error('Usuario no encontrado');

        // Verificar que el usuario no esté verificado
        if (user.is_verified) throw new Error('El usuario ya está verificado');

        // Generar un nuevo código de verificación y actualizar tiempo de expiración
        const newVerificationCode = generateVerificationCode();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos de validez

        // Actualizar el usuario con el nuevo código y tiempo de expiración
        await user.update({
            verification_code: newVerificationCode,
            verification_code_expires: expiresAt,
        });

        // Enviar correo con el nuevo código de verificación
        await emailService.sendVerificationEmail(email, newVerificationCode);

        // Devolver confirmación sin el código
        return { message: 'Se ha reenviado un nuevo código de verificación a tu correo' };
    }

    async verifyRegistration(email, verificationCode) {
        // Verificar si el usuario existe
        const user = await User.findOne({ where: { email } });
        if (!user) throw new Error('Usuario no encontrado');

        // Validar el código de verificación
        if (user.verification_code !== verificationCode) throw new Error('Código de verificación incorrecto');
        if (user.is_verified) throw new Error('El usuario ya está verificado');

        // Validar si el código ha expirado
        const now = new Date();
        if (user.verification_code_expires < now) {
            // Limpiar el código expirado
            await user.update({
                verification_code: null,
                verification_code_expires: null,
            });
            throw new Error('El código de verificación ha expirado. Por favor, solicita uno nuevo.');
        }

        // Marcar como verificado y limpiar el código y tiempo de expiración
        await user.update({
            is_verified: true,
            verification_code: null,
            verification_code_expires: null,
        });

        // Generar Token JWT y guardar sesión
        const token = generateToken(user.id, user.email, user.nombre);
        await Session.create({
            user_id: user.id,
            token,
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 día
        });

        return { user, token };
    }

    async login(email, password) {
        // Buscar usuario por email
        const user = await User.findOne({ where: { email } });
        if (!user) throw new Error('Usuario no encontrado');

        // Validar contraseña
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) throw new Error('Contraseña incorrecta');

        // Verificar que el usuario esté verificado
        if (!user.is_verified) throw new Error('Por favor, verifica tu cuenta primero');

        // Generar token JWT y actualizar sesión
        const token = generateToken(user.id, user.email, user.nombre);
        await Session.create({
            user_id: user.id,
            token,
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // 1 día
        });

        return { user, token };
    }

    async logout(token) {
        const session = await Session.findOne({ where: { token } });
        if (!session) throw new Error('Sesión no encontrada');

        await session.destroy();
        return { message: 'Sesión cerrada exitosamente' };
    }
}

export default new AuthService();