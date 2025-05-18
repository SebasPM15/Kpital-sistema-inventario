import { Router } from 'express';
import { 
    getPredictions,
    getPredictionByCode,
    refreshPredictions,
    applyTransitUnits,
    applyTransitDays,
    applyTransitDaysToProjection, // Nuevo controlador importado
    updateProduct
} from '../controllers/predictions.controller.js';
import { uploadMiddleware } from '../middlewares/upload.middleware.js';
import PythonService from '../services/python.service.js'
const router = Router();

// Rutas existentes
router.get('/', getPredictions);
router.get('/:code', getPredictionByCode);
router.post('/refresh', uploadMiddleware.single('excel'), refreshPredictions);

// Rutas para gestión de tránsito
router.post('/:code/transit', applyTransitUnits); // Unidades en tránsito
router.post('/:code/transit/days', applyTransitDays); // Días en tránsito globales

// Nueva ruta para días de tránsito por proyección específica
router.patch('/:code/projections/:index/transit-days', async (req, res) => {
    try {
        const { code, index } = req.params;
        const { days } = req.body;

        if (!days || isNaN(days) || days < 0) {
            return res.status(400).json({ message: 'Los días en tránsito deben ser un número positivo' });
        }

        const updatedProduct = await PythonService.applyTransitDaysToProjection(code, parseInt(index), parseInt(days));
        res.json(updatedProduct);
    } catch (error) {
        console.error('Error in PATCH /predictions/:code/projections/:index/transit-days:', error);
        res.status(500).json({ message: error.message || 'Error al aplicar días de tránsito' });
    }
});

// Ruta para actualización general de productos
router.patch('/:code', updateProduct);

export default router;