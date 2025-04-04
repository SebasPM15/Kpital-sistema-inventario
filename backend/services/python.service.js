import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { PATHS } from '../config/constants.js';
import { logger } from '../utils/logger.js';

class PythonService {
    constructor() {
        // Se usa la ruta definida en las constantes, similar a AIService
        this.scriptPath = path.join(PATHS.AI_MODEL_DIR, 'src/predict.py');
        this.dataDir = path.dirname(PATHS.PREDICTIONS_FILE);
        this.predictionsFile = PATHS.PREDICTIONS_FILE;
        this.timeout = 300000; // 5 minutos
    }

    async processExcel(file) {
        try {
            // 1. Ejecutar el script Python pasando el archivo de entrada y directorio de salida
            await this.runScript(file.path);

            // 2. Validar que se generó correctamente el archivo de predicciones
            await this.validateOutput();

            // 3. Retornar las predicciones más recientes
            return await this.getLatestPredictions();
        } catch (error) {
            logger.error(`Python Service Error: ${error.message}`);
            throw error;
        } finally {
            // 4. Limpiar el archivo temporal, tanto en éxito como en error
            await this.cleanTempFiles(file.path);
        }
    }

    runScript(inputPath) {
        return new Promise((resolve, reject) => {
            const args = [
                '-u',
                this.scriptPath,
                '--excel', inputPath
            ];

            const pythonProcess = spawn('python', args);

            const timeoutId = setTimeout(() => {
                pythonProcess.kill();
                reject(new Error('Tiempo de ejecución excedido'));
            }, this.timeout);

            let output = '';

            pythonProcess.stdout.on('data', (data) => {
                output += data.toString();
                logger.info(`Python Output: ${data}`);
            });

            pythonProcess.stderr.on('data', (data) => {
                logger.error(`Python Error: ${data}`);
            });

            pythonProcess.on('close', (code) => {
                clearTimeout(timeoutId);
                code === 0
                    ? resolve(output)
                    : reject(new Error(`Script falló con código ${code}`));
            });
        });
    }

    async validateOutput() {
        try {
            await fs.access(this.predictionsFile, fs.constants.F_OK);
            const stats = await fs.stat(this.predictionsFile);
            if (stats.size === 0) {
                throw new Error('Archivo de predicciones vacío');
            }
        } catch (error) {
            throw new Error(`Error validando output: ${error.message}`);
        }
    }

    async getLatestPredictions() {
        try {
            const data = await fs.readFile(this.predictionsFile, 'utf-8');
            return JSON.parse(data);
        } catch (error) {
            throw new Error(`Error leyendo predicciones: ${error.message}`);
        }
    }

    async cleanTempFiles(filePath) {
        try {
            await fs.unlink(filePath);
            logger.info(`Archivo temporal eliminado: ${filePath}`);
        } catch (error) {
            logger.warning(`Error limpiando archivos: ${error.message}`);
        }
    }

    _recalculateProductValues(product) {
        // 1. Recalcular déficit y pedidos
        product.DEFICIT = Math.max(product.PUNTO_REORDEN - product.STOCK_TOTAL, 0);
        
        if (product.UNIDADES_POR_CAJA > 0) {
            product.CAJAS_A_PEDIR = Math.ceil(product.DEFICIT / product.UNIDADES_POR_CAJA);
            // Actualizar el valor existente de UNIDADES_A_PEDIR en lugar de crear uno nuevo
            if (product.hasOwnProperty('UNIDADES_A_PEDIR')) {
                product.UNIDADES_A_PEDIR = product.CAJAS_A_PEDIR * product.UNIDADES_POR_CAJA;
            }
        }
    
        // 2. Recalcular tiempos de cobertura
        if (product.CONSUMO_DIARIO > 0) {
            product.DIAS_COBERTURA = Math.min(
                product.STOCK_TOTAL / product.CONSUMO_DIARIO,
                product.CONFIGURACION.DIAS_MAX_REPOSICION
            );
            
            // Recalcular fecha de reposición
            const diasHastaReorden = Math.max(
                (product.PUNTO_REORDEN - product.STOCK_TOTAL) / product.CONSUMO_DIARIO,
                0
            );
            
            const fechaReposicion = new Date();
            fechaReposicion.setDate(fechaReposicion.getDate() + 
                Math.max(diasHastaReorden - product.CONFIGURACION.LEAD_TIME_REPOSICION, 0));
            
            product.FECHA_REPOSICION = fechaReposicion.toISOString().split('T')[0];
        }
    }

    async applyTransitUnits(productCode, units) {
        try {
            // 1. Obtener las predicciones actuales
            const predictions = await this.getLatestPredictions();
            
            // 2. Encontrar y actualizar el producto específico
            const productIndex = predictions.findIndex(p => p.CODIGO === productCode);
            if (productIndex === -1) {
                throw new Error(`Producto ${productCode} no encontrado`);
            }
    
            // 3. Clonar el producto para evitar mutaciones
            const productToUpdate = JSON.parse(JSON.stringify(predictions[productIndex]));
            
            // 4. Aplicar unidades en tránsito (sin validar disponibilidad)
            productToUpdate.UNIDADES_TRANSITO_DISPONIBLES = units;
            productToUpdate.STOCK_TOTAL = productToUpdate.STOCK_FISICO + units;

            // 5. Recalcular valores dependientes
            this._recalculateProductValues(productToUpdate);
    
            // 6. Actualizar el array de predicciones
            const updatedPredictions = [...predictions];
            updatedPredictions[productIndex] = productToUpdate;
    
            // 7. Guardar los cambios
            await fs.writeFile(this.predictionsFile, JSON.stringify(updatedPredictions, null, 2));
            
            return updatedPredictions;
        } catch (error) {
            logger.error(`Error aplicando unidades en tránsito: ${error.message}`);
            throw error;
        }
    }
}

export default new PythonService();
