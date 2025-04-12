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
                count: predictions.length,
                version: predictions[0]?.CONFIGURACION?.VERSION_MODELO || '1.0'
            }
        });
    } catch (error) {
        handleHttpError(res, 'ERROR_GET_PREDICTIONS', error);
    }
};

export const getPredictionByCode = async (req, res) => {
    try {
        const { code } = req.params;
        const product = await pythonService.getProductByCode(code);
        
        res.json({ 
            success: true, 
            data: product,
            metadata: {
                last_updated: new Date().toISOString()
            }
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
                fecha_generacion: new Date().toISOString(),
                version_modelo: updatedData[0]?.CONFIGURACION?.VERSION_MODELO || '2.2-dynamic-transit'
            }
        });
    } catch (error) {
        handleHttpError(res, 'ERROR_REFRESH_PREDICTIONS', error);
    }
};

export const applyTransitUnits = async (req, res) => {
    try {
        const { code } = req.params;
        const { units, recalculateProjections = true, updateFrequency = true } = req.body;

        // Validaciones básicas
        if (units === undefined || units === null || isNaN(units) || units < 0) {
            return handleHttpError(res, 'INVALID_UNITS', 
                new Error('Las unidades en tránsito deben ser un número positivo'), 400);
        }

        const updatedProduct = await pythonService.applyTransitUnits(
            code, 
            parseFloat(units), 
            { 
                recalculateProjections, 
                updateFrequency 
            }
        );

        res.json({
            success: true,
            message: `Unidades en tránsito aplicadas al producto ${code}`,
            data: updatedProduct,
            metadata: {
                recalculated_projections: recalculateProjections,
                updated_frequency: updateFrequency,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        handleHttpError(res, 'ERROR_APPLYING_TRANSIT_UNITS', error);
    }
};

export const updateProduct = async (req, res) => {
    try {
        const { code } = req.params;
        const updates = req.body;

        if (!updates || typeof updates !== 'object' || Object.keys(updates).length === 0) {
            return handleHttpError(res, 'INVALID_UPDATES', 
                new Error('Debe proporcionar datos válidos para actualizar'), 400);
        }

        // Validar que no se intenten actualizar campos protegidos
        const protectedFields = ['CODIGO', 'STOCK_FISICO', 'CONFIGURACION'];
        const invalidUpdates = Object.keys(updates).filter(field => protectedFields.includes(field));
        
        if (invalidUpdates.length > 0) {
            return handleHttpError(res, 'PROTECTED_FIELD', 
                new Error(`No se pueden actualizar los campos protegidos: ${invalidUpdates.join(', ')}`), 400);
        }

        const updatedProduct = await pythonService.updateProduct(code, updates);

        res.json({
            success: true,
            message: `Producto ${code} actualizado exitosamente`,
            data: updatedProduct,
            metadata: {
                updated_fields: Object.keys(updates),
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        handleHttpError(res, 'ERROR_UPDATING_PRODUCT', error);
    }
};