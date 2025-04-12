import bcrypt from 'bcrypt';
import { getUserByEmail, createUser, readUsers, getUserById } from '../models/user.model.js';
import generateToken from '../utils/generateToken.js';

export const register = async (req, res) => {
    try {
        const { nombre, email, password, celular } = req.body;

        if (!nombre || !email || !password || !celular) {
            return res.status(400).json({ message: 'Todos los campos son requeridos' });
        }

        // Validación básica de email
        if (!email.includes('@')) {
            return res.status(400).json({ message: 'Email inválido' });
        }

        if (!/^\d{10}$/.test(celular)) {
            return res.status(400).json({ message: 'El número de celular debe tener exactamente 10 dígitos' });
        }
        

        const userExists = getUserByEmail(email);
        if (userExists) {
            return res.status(409).json({ message: 'El correo ya está registrado' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Generar ID basado en el último usuario
        const users = readUsers();
        const newId = users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1;

        const newUser = {
            id: newId,
            nombre,
            email,
            password: hashedPassword,
            celular,
        };

        createUser(newUser);

        const token = generateToken(newUser.id, newUser.email);
        res.status(201).json({ 
            message: 'Usuario registrado', 
            user: { id: newUser.id, email: newUser.email, nombre: newUser.nombre, celular: newUser.celular },
            token 
        });
    } catch (error) {
        console.error('Error en registro:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};

export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = getUserByEmail(email);
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Contraseña incorrecta' });
        }

        const token = generateToken(user.id, user.email);
        res.json({ 
            message: 'Login exitoso', 
            user: { id: user.id, email: user.email, nombre: user.nombre },
            token 
        });
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};

export const getUser = async (req, res) => {
    const { id } = req.params;
    const user = await getUserById(Number(id));

    if (!user) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    res.json({
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        celular: user.celular,
    });
};

export const getUserByEmailController = (req, res) => {
    const { email } = req.params;

    try {
        const user = getUserByEmail(email);

        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        res.status(200).json(user);
    } catch (error) {
        console.error('Error al buscar el usuario:', error);
        res.status(500).json({ message: 'Error del servidor' });
    }
};

export const getAllUsers = async (req, res) => {
    try {
        const users = await readUsers();

        // Si no quieres mostrar contraseñas en la respuesta
        const sanitizedUsers = users.map(({ password, ...rest }) => rest);

        res.json(sanitizedUsers);
    } catch (error) {
        console.error('Error al obtener usuarios:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};
