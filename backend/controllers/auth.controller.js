import bcrypt from 'bcrypt';
import User from '../models/user.model.js'; // asegúrate que esté correctamente exportado
import generateToken from '../utils/generateToken.js';
import { handleHttpError } from '../utils/errorHandler.js';

// Registro
export const register = async (req, res) => {
    try {
        const { nombre, email, password, celular } = req.body;

        if (!nombre || !email || !password || !celular) {
            return handleHttpError(res, 'BAD_REQUEST', new Error('Todos los campos son requeridos'), 400);
        }

        if (!email.includes('@')) {
            return handleHttpError(res, 'INVALID_EMAIL', new Error('Email inválido'), 400);
        }

        if (!/^\d{10}$/.test(celular)) {
            return handleHttpError(res, 'INVALID_PHONE', new Error('El número de celular debe tener 10 dígitos'), 400);
        }

        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
            return handleHttpError(res, 'EMAIL_EXISTS', new Error('El correo ya está registrado'), 409);
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await User.create({
            nombre,
            email,
            password: hashedPassword,
            celular
        });

        const token = generateToken(newUser.id, newUser.email);

        res.status(201).json({
            message: 'Usuario registrado exitosamente',
            user: {
                id: newUser.id,
                nombre: newUser.nombre,
                email: newUser.email,
                celular: newUser.celular
            },
            token
        });
    } catch (error) {
        handleHttpError(res, 'REGISTER_ERROR', error, 500);
    }
};

// Login
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return handleHttpError(res, 'BAD_REQUEST', new Error('Email y contraseña requeridos'), 400);
        }

        const user = await User.findOne({ where: { email } });

        if (!user) {
            return handleHttpError(res, 'USER_NOT_FOUND', new Error('Usuario no encontrado'), 404);
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return handleHttpError(res, 'INVALID_CREDENTIALS', new Error('Contraseña incorrecta'), 401);
        }

        const token = generateToken(user.id, user.email);

        res.status(200).json({
            message: 'Login exitoso',
            user: {
                id: user.id,
                nombre: user.nombre,
                email: user.email
            },
            token
        });
    } catch (error) {
        handleHttpError(res, 'LOGIN_ERROR', error, 500);
    }
};

// Obtener usuario por ID
export const getUser = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findByPk(id, {
            attributes: { exclude: ['password'] }
        });

        if (!user) {
            return handleHttpError(res, 'USER_NOT_FOUND', new Error('Usuario no encontrado'), 404);
        }

        res.status(200).json(user);
    } catch (error) {
        handleHttpError(res, 'GET_USER_ERROR', error, 500);
    }
};

// Obtener usuario por Email
export const getUserByEmailController = async (req, res) => {
    try {
        const { email } = req.params;
        const user = await User.findOne({
            where: { email },
            attributes: { exclude: ['password'] }
        });

        if (!user) {
            return handleHttpError(res, 'USER_NOT_FOUND', new Error('Usuario no encontrado'), 404);
        }

        res.status(200).json(user);
    } catch (error) {
        handleHttpError(res, 'GET_USER_BY_EMAIL_ERROR', error, 500);
    }
};

// Obtener todos los usuarios
export const getAllUsers = async (req, res) => {
    try {
        const users = await User.findAll({
            attributes: { exclude: ['password'] }
        });

        res.status(200).json(users);
    } catch (error) {
        handleHttpError(res, 'GET_ALL_USERS_ERROR', error, 500);
    }
};
