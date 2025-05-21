import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';

const verifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ message: 'Token requerido' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!decoded.id) {
            return res.status(403).json({ message: 'Token inválido: ID de usuario no proporcionado' });
        }

        // Verificar que el usuario exista
        const user = await User.findByPk(decoded.id);
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado para el token proporcionado' });
        }

        req.user = decoded;
        next();
    } catch (error) {
        console.error('Error en verifyToken:', error);
        return res.status(403).json({ message: 'Token inválido o expirado' });
    }
};

export default verifyToken;