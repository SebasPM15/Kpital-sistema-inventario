import pythonService from '../services/python.service.js';
import { handleHttpError } from '../utils/errorHandler.js';

export const getPredictions = async (req, res) => {
    try {
        const predictions = await pythonService.getLatestPredictions();
        
        res.json({ 
            success: true, 
            data: predictions,
            metadata: {
                generated_at: new Date().toISOString(),
                count: predictions.length
            }
        });
    } catch (error) {
        handleHttpError(res, 'ERROR_GET_PREDICTIONS', error);
    }
};

export const getPredictionByCode = async (req, res) => {
    try {
        const { code } = req.params;
        const predictions = await pythonService.getLatestPredictions();
        
        const product = predictions.find(p => p.CODIGO === code);
        if (!product) {
            return handleHttpError(res, 'PRODUCT_NOT_FOUND', new Error(`Producto con código ${code} no encontrado`), 404);
        }

        res.json({ 
            success: true, 
            data: product 
        });
    } catch (error) {
        handleHttpError(res, 'ERROR_GET_PREDICTION', error);
    }
};

export const refreshPredictions = async (req, res) => {
    try {
        if (!req.file) {
            return handleHttpError(res, 'NO_FILE_UPLOADED', new Error('Debe proporcionar un archivo Excel'), 400);
        }

        if (!req.file.mimetype.includes('excel') && !req.file.mimetype.includes('spreadsheet')) {
            return handleHttpError(res, 'INVALID_FILE_TYPE', new Error('El archivo debe ser un documento Excel'), 400);
        }

        const updatedData = await pythonService.processExcel(req.file);
        
        res.json({
            success: true,
            message: 'Predicciones actualizadas exitosamente',
            data: {
                archivo: req.file.originalname,
                productos_procesados: updatedData.length,
                fecha_generacion: new Date().toISOString()
            }
        });
    } catch (error) {
        handleHttpError(res, 'ERROR_REFRESH_PREDICTIONS', error);
    }
};

export const applyTransitUnits = async (req, res) => {
    try {
        const { code } = req.params;
        const { units } = req.body;

        // Validaciones básicas
        if (!units || isNaN(units) || units < 0) {
            return handleHttpError(res, 'INVALID_UNITS', 
                new Error('Las unidades en tránsito deben ser un número positivo'), 400);
        }

        // Obtener datos actuales
        const currentData = await pythonService.getLatestPredictions();
        const product = currentData.find(p => p.CODIGO === code);
        
        if (!product) {
            return handleHttpError(res, 'PRODUCT_NOT_FOUND', 
                new Error(`Producto con código ${code} no encontrado`), 404);
        }

        // Eliminar la validación de unidades disponibles
        // Aplicar las unidades directamente
        const updatedData = await pythonService.applyTransitUnits(code, parseFloat(units));
        const updatedProduct = updatedData.find(p => p.CODIGO === code);

        res.json({
            success: true,
            message: `Unidades en tránsito aplicadas al producto ${code}`,
            data: updatedProduct
        });
    } catch (error) {
        handleHttpError(res, 'ERROR_APPLYING_TRANSIT_UNITS', error);
    }
};