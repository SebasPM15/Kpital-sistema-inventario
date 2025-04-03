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