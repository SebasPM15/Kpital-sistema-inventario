import { Router } from 'express';
import { 
    getPredictions,
    getPredictionByCode,
    refreshPredictions // Asegúrate de importar esto también
} from '../controllers/predictions.controller.js';
import { uploadMiddleware } from '../middlewares/upload.middleware.js';


const router = Router();

router.get('/', getPredictions);
router.get('/:code', getPredictionByCode);
router.post('/refresh', uploadMiddleware.single('excel'), refreshPredictions);

export default router;