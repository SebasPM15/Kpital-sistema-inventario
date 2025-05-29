import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { PATHS } from './config/constants.js';
import predictionsRouter from './routes/predictions.routes.js';
import { handleHttpError } from './utils/errorHandler.js';
import { logger } from './utils/logger.js';
import alertRoutes from './routes/alert.routes.js';
import authRoutes from './routes/auth.routes.js';
import verifyToken from './middlewares/auth.middleware.js';
import sequelize from './config/db.js';
import User from './models/user.model.js'; // Importa tus modelos
import reportsRouter from './routes/reports.routes.js';
import productsRouter from './routes/products.routes.js';

// Configuración del puerto
const PORT = process.env.PORT || 3500;
const HOST = process.env.HOST || '0.0.0.0'; // Para compatibilidad con Docker

const app = express();

// 1. Configuración de Seguridad
app.use(helmet());
app.use(cors({
    origin: 'https://kpital-sistema-inventario-frontend.onrender.com', // Aceptar peticiones de cualquier origen
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'], // Permitir todos los métodos HTTP comunes
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'] // Ampliar encabezados permitidos
}));

// 2. Limitador de tasa
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        handleHttpError(res, 'TOO_MANY_REQUESTS', new Error('Límite de solicitudes excedido'), 429);
    }
});

// 3. Middlewares básicos
app.use(morgan('combined', { stream: logger.stream }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Conexión a la base de datos
sequelize.sync({ alter: true })
    .then(() => console.log('✅ Base de datos conectada y sincronizada'))
    .catch(err => console.error('❌ Error de conexión a la DB:', err));

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/predictions', limiter, predictionsRouter);
app.use('/api/alertas', alertRoutes);
app.use('/api/reports', reportsRouter);
app.use('/api/products', productsRouter);

app.get('/api/protected', verifyToken, (req, res) => {
    res.json({ message: 'Ruta protegida', user: req.user });
});

// Health check mejorado
const healthResponse = async (req, res) => {
    const dbStatus = await sequelize.authenticate()
        .then(() => 'connected')
        .catch(() => 'disconnected');
    
    res.status(200).json({
        status: "OK",
        dbStatus,
        timestamp: new Date().toISOString(),
        service: "Inventory Prediction API",
        version: process.env.npm_package_version,
        environment: process.env.NODE_ENV || 'development',
        port: PORT
    });
};

app.get('/health', healthResponse);
app.get('/api/health', healthResponse);

// Manejo de errores
app.use((req, res) => {
    handleHttpError(res, 'NOT_FOUND', new Error(`Ruta no encontrada: ${req.originalUrl}`), 404);
});

app.use((err, req, res, next) => {
    logger.error(`Error no manejado: ${err.stack}`);
    handleHttpError(res, 'INTERNAL_SERVER_ERROR', err, 500);
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});

export default app;