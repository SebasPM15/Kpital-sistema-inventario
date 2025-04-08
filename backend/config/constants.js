import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

// Cargar variables de entorno desde .env
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Función auxiliar para obtener rutas absolutas de manera segura
const resolvePath = (relativePath) => path.resolve(__dirname, relativePath);

export const PATHS = {
    AI_MODEL_DIR: path.join(process.cwd(), 'ai_model'),
    PREDICTIONS_FILE: path.join(process.cwd(), 'ai_model', 'data', 'predicciones_completas.min.json'),
    UPLOADS_DIR: path.join(process.cwd(), 'uploads'),
    EXCEL_TEMPLATE: resolvePath('../../ai_model/data/PRUEBA PASANTIAS EPN.xlsx'),
    LOGS_DIR: process.env.LOGS_DIR || resolvePath('../logs'), // 📌 Nueva ruta de logs con fallback
    MAX_FILE_SIZE: 10 * 1024 * 1024 // 10MB
};

export const RATE_LIMIT = {
    WINDOW_MS: 15 * 60 * 1000, // 15 minutos
    MAX_REQUESTS: 100
};
