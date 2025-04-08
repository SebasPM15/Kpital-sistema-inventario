import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { PATHS } from './config/constants.js';
import predictionsRouter from './routes/predictions.routes.js';
import { handleHttpError } from './utils/errorHandler.js';
import { logger } from './utils/logger.js';

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

// 2. Limitador de tasa (100 requests por 15 minutos)
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

// 4. Servir archivos estáticos
app.use('/uploads', express.static(PATHS.UPLOADS_DIR, {
    maxAge: '1d',
    setHeaders: (res, path) => {
        if (path.endsWith('.xlsx')) {
            res.set('Content-Disposition', 'attachment');
        }
    }
}));

// 5. Rutas principales
app.use('/api/predictions', limiter, predictionsRouter);

// 6. Ruta de salud (mejorada y disponible en ambas rutas)
const healthResponse = (req, res) => {
    res.status(200).json({
        status: "OK",
        timestamp: new Date().toISOString(),
        service: "Inventory Prediction API",
        version: process.env.npm_package_version,
        environment: process.env.NODE_ENV || 'development',
        port: PORT
    });
};

app.get('/health', healthResponse);
app.get('/api/health', healthResponse); // Agregando el endpoint en la ruta documentada

// 7. Manejo de rutas no encontradas
app.use((req, res, next) => {
    handleHttpError(res, 'NOT_FOUND', new Error(`Ruta no encontrada: ${req.originalUrl}`), 404);
});

// 8. Manejador global de errores
app.use((err, req, res, next) => {
    logger.error(`Error no manejado: ${err.stack}`);
    handleHttpError(res, 'INTERNAL_SERVER_ERROR', err, 500);
});

// Función para iniciar el servidor (exportada para testing)
export const startServer = () => {
    return app.listen(PORT, HOST, () => {
        logger.info(`🚀 Servidor corriendo en http://${HOST}:${PORT}`);
        logger.info(`📊 Métricas disponibles en http://${HOST}:${PORT}/metrics`);
        logger.info(`🩺 Health check en http://${HOST}:${PORT}/health`);
    });
};

// Iniciar solo si no estamos en entorno de testing
if (process.env.NODE_ENV !== 'test') {
    startServer();
}

export default app;