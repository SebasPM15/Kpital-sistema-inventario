import { Router } from 'express';
import { 
    getPredictions,
    getPredictionByCode,
    refreshPredictions,
    applyTransitUnits // Importamos el nuevo controlador
} from '../controllers/predictions.controller.js';
import { uploadMiddleware } from '../middlewares/upload.middleware.js';

const router = Router();

// Rutas existentes
router.get('/', getPredictions);
router.get('/:code', getPredictionByCode);
router.post('/refresh', uploadMiddleware.single('excel'), refreshPredictions);
// Ruta para aplicar unidades en tránsito a un producto específico
router.post('/:code/transit', applyTransitUnits);
export default router;