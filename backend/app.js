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

// Función mejorada para sincronizar la base de datos
const syncDatabase = async () => {
    try {
        // En producción solo sincroniza sin forzar
        // En desarrollo puedes usar { force: true } para recrear tablas (cuidado con los datos)
        const syncOptions = {
            force: process.env.NODE_ENV === 'development' ? false : false,
            alter: process.env.NODE_ENV === 'development' ? true : false
        };

        await sequelize.sync(syncOptions);
        logger.info('✅ Base de datos sincronizada correctamente');
        
        // Verifica que la tabla Users exista
        await User.findOne({ limit: 1 });
        logger.info('✅ Modelo User verificado correctamente');
        
    } catch (error) {
        logger.error('❌ Error al sincronizar la base de datos:', error);
        // No salimos del proceso para permitir reintentos
    }
};

// Función mejorada para probar la conexión a la base de datos
export const testDBConnection = async () => {
    let retries = 5;
    const delay = 5000; // 5 segundos entre reintentos
    
    while (retries > 0) {
        try {
            await sequelize.authenticate();
            logger.info('✅ Conexión con la base de datos establecida correctamente.');
            await syncDatabase(); // Sincroniza después de conectar
            return true;
        } catch (error) {
            retries--;
            logger.error(`❌ Error de conexión a la base de datos (${retries} reintentos restantes):`, error.message);
            
            if (retries === 0) {
                logger.error('❌ No se pudo conectar a la base de datos después de varios intentos');
                return false;
            }
            
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
};

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/predictions', limiter, predictionsRouter);
app.use('/api/alertas', alertRoutes);

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
app.use((req, res, next) => {
    handleHttpError(res, 'NOT_FOUND', new Error(`Ruta no encontrada: ${req.originalUrl}`), 404);
});

app.use((err, req, res, next) => {
    logger.error(`Error no manejado: ${err.stack}`);
    handleHttpError(res, 'INTERNAL_SERVER_ERROR', err, 500);
});

// Función para iniciar el servidor
export const startServer = async () => {
    try {
        const dbConnected = await testDBConnection();
        
        if (!dbConnected && process.env.NODE_ENV === 'production') {
            throw new Error('No se pudo conectar a la base de datos');
        }
        
        const server = app.listen(PORT, HOST, () => {
            logger.info(`🚀 Servidor corriendo en http://${HOST}:${PORT}`);
            logger.info(`📊 Métricas disponibles en http://${HOST}:${PORT}/metrics`);
            logger.info(`🩺 Health check en http://${HOST}:${PORT}/health`);
        });
        
        return server;
    } catch (error) {
        logger.error('❌ Error al iniciar el servidor:', error);
        process.exit(1);
    }
};

// Iniciar solo si no estamos en entorno de testing
if (process.env.NODE_ENV !== 'test') {
    startServer();
}

export default app;