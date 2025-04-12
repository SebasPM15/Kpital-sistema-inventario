import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { PATHS } from '../config/constants.js';
import { logger } from '../utils/logger.js';

class PythonService {
    constructor() {
        this.scriptPath = path.join(process.cwd(), 'ai_model', 'src', 'predict.py');
        this.dataDir = path.join(process.cwd(), 'ai_model', 'data');
        this.predictionsFile = path.join(this.dataDir, 'predicciones_completas.min.json');
        this.timeout = 300000; // 5 minutos
        
        // Asegurar que el directorio data existe
        fs.mkdir(this.dataDir, { recursive: true }).catch(err => {
            logger.error(`Error creating data directory: ${err}`);
        });
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

    async applyTransitUnits(productCode, units, options = {}) {
        try {
            const { 
                recalculateProjections = true,
                updateFrequency = true,
                persistChanges = true
            } = options;

            // 1. Obtener predicciones actuales
            const predictions = await this.getLatestPredictions();
            
            // 2. Encontrar el producto
            const productIndex = predictions.findIndex(p => p.CODIGO === productCode);
            if (productIndex === -1) {
                throw new Error(`Producto ${productCode} no encontrado`);
            }
            
            // 3. Clonar profundamente el producto
            const productToUpdate = JSON.parse(JSON.stringify(predictions[productIndex]));
            
            // 4. Aplicar unidades en tránsito
            productToUpdate.UNIDADES_TRANSITO = parseFloat(units) || 0;
            productToUpdate.STOCK_TOTAL = productToUpdate.STOCK_FISICO + productToUpdate.UNIDADES_TRANSITO;

            // 5. Recalcular valores inmediatos
            this._recalculateProductValues(productToUpdate);

            // 6. Recalcular proyecciones si se solicita
            if (recalculateProjections) {
                this._recalculateProjections(productToUpdate);
            }

            // 7. Actualizar frecuencia de reposición si se solicita
            if (updateFrequency && productToUpdate.CONSUMO_DIARIO > 0) {
                productToUpdate.FRECUENCIA_REPOSICION = 
                    Math.min(
                        productToUpdate.PUNTO_REORDEN / productToUpdate.CONSUMO_DIARIO,
                        productToUpdate.CONFIGURACION.DIAS_MAX_REPOSICION
                    );
            }

            // 8. Actualizar y guardar si se solicita
            if (persistChanges) {
                const updatedPredictions = [...predictions];
                updatedPredictions[productIndex] = productToUpdate;
                await this._savePredictions(updatedPredictions);
            }
            
            return productToUpdate;
        } catch (error) {
            logger.error(`Error aplicando unidades en tránsito: ${error.message}`);
            throw error;
        }
    }

    _recalculateProductValues(product) {
        // 1. Calcular punto de reorden efectivo (considerando unidades en tránsito)
        const effectivePuntoReorden = Math.max(
            product.PUNTO_REORDEN - product.UNIDADES_TRANSITO,
            product.STOCK_SEGURIDAD // Nunca pedir por debajo del stock de seguridad
        );
        
        // 2. Recalcular déficit y pedidos
        product.DEFICIT = Math.max(effectivePuntoReorden - product.STOCK_FISICO, 0);
        
        if (product.UNIDADES_POR_CAJA > 0) {
            product.CAJAS_A_PEDIR = Math.ceil(
                product.DEFICIT / product.UNIDADES_POR_CAJA
            );
            product.UNIDADES_A_PEDIR = product.CAJAS_A_PEDIR * product.UNIDADES_POR_CAJA;
        } else {
            product.CAJAS_A_PEDIR = 0;
            product.UNIDADES_A_PEDIR = 0;
        }
    
        // 3. Recalcular tiempos de cobertura
        if (product.CONSUMO_DIARIO > 0) {
            product.DIAS_COBERTURA = Math.min(
                product.STOCK_TOTAL / product.CONSUMO_DIARIO,
                product.CONFIGURACION.DIAS_MAX_REPOSICION
            );
            
            // Recalcular fecha de reposición considerando lead time
            const diasHastaReorden = Math.max(
                (effectivePuntoReorden - product.STOCK_FISICO) / product.CONSUMO_DIARIO,
                0
            );
            
            const fechaReposicion = new Date();
            fechaReposicion.setDate(
                fechaReposicion.getDate() + 
                Math.max(diasHastaReorden - product.CONFIGURACION.LEAD_TIME_REPOSICION, 0)
            );
            
            product.FECHA_REPOSICION = fechaReposicion.toISOString().split('T')[0];
        } else {
            product.DIAS_COBERTURA = 0;
            product.FECHA_REPOSICION = "No aplica";
        }
    }

    _recalculateProjections(product) {
        const leadTime = product.CONFIGURACION.LEAD_TIME_REPOSICION;
        
        // Variables de seguimiento
        let currentStock = product.STOCK_FISICO;
        let transitUnits = product.UNIDADES_TRANSITO;
        let pendingOrders = {};
        
        product.PROYECCIONES.forEach((proj, index) => {
            try {
                const monthNumber = index + 1; // 1=Marzo, 2=Abril, etc.
                
                // 1. Aplicar unidades en tránsito al primer mes
                if (monthNumber === 1) {
                    currentStock += transitUnits;
                    transitUnits = 0;
                }
                
                // 2. Parsear el mes de la proyección
                const [monthStr, yearStr] = proj.mes.split('-');
                const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
                const monthIndex = monthNames.findIndex(m => m === monthStr);
                
                if (monthIndex === -1) throw new Error(`Nombre de mes inválido: ${monthStr}`);
                
                const year = parseInt(yearStr, 10);
                if (isNaN(year)) throw new Error(`Año inválido: ${yearStr}`);
                
                // 3. Aplicar pedidos pendientes que llegan este mes
                const arrivalMonthKey = `${monthStr}-${yearStr}`;
                if (pendingOrders[arrivalMonthKey]) {
                    currentStock += pendingOrders[arrivalMonthKey];
                    delete pendingOrders[arrivalMonthKey];
                }
                
                // 4. Calcular nuevo stock después del consumo
                const stockAfterConsumption = Math.max(currentStock - proj.consumo_mensual, 0);
                
                // 5. Calcular nuevo déficit (considerando unidades en tránsito)
                const effectivePuntoReorden = Math.max(
                    proj.punto_reorden - transitUnits,
                    proj.stock_seguridad
                );
                const newDeficit = Math.max(effectivePuntoReorden - stockAfterConsumption, 0);
                const newUnitsToOrder = Math.ceil(newDeficit / product.UNIDADES_POR_CAJA) * product.UNIDADES_POR_CAJA;
                
                // 6. Programar llegada del pedido (60 días después = 2 meses)
                if (newUnitsToOrder > 0) {
                    const arrivalMonthNum = monthNumber + 2;
                    if (arrivalMonthNum <= 8) { // Solo hasta agosto 2025
                        const arrivalMonthIndex = (monthIndex + 2) % 12;
                        const arrivalYear = year + Math.floor((monthIndex + 2) / 12);
                        const arrivalMonthKey = `${monthNames[arrivalMonthIndex]}-${arrivalYear}`;
                        pendingOrders[arrivalMonthKey] = (pendingOrders[arrivalMonthKey] || 0) + newUnitsToOrder;
                    }
                }
                
                // 7. Actualizar valores de la proyección
                proj.stock_proyectado = stockAfterConsumption;
                proj.deficit = newDeficit;
                proj.unidades_a_pedir = newUnitsToOrder;
                proj.cajas_a_pedir = Math.ceil(newDeficit / product.UNIDADES_POR_CAJA);
                proj.alerta_stock = stockAfterConsumption < effectivePuntoReorden;
                proj.unidades_en_transito = transitUnits;
                proj.pedidos_pendientes = { ...pendingOrders };
                
                // 8. Calcular tiempo de cobertura para este mes
                if (proj.consumo_diario > 0) {
                    proj.tiempo_cobertura = Math.min(
                        Math.max(stockAfterConsumption - proj.stock_seguridad, 0) / proj.consumo_diario,
                        product.CONFIGURACION.DIAS_MAX_REPOSICION
                    );
                    
                    // Calcular próxima fecha de reposición
                    const diasHastaReposicion = Math.max(
                        product.FRECUENCIA_REPOSICION - leadTime,
                        0
                    );
                    
                    const fechaReposicion = new Date(year, monthIndex, 15);
                    fechaReposicion.setDate(fechaReposicion.getDate() + diasHastaReposicion);
                    proj.fecha_reposicion = fechaReposicion.toISOString().split('T')[0];
                } else {
                    proj.tiempo_cobertura = 0;
                    proj.fecha_reposicion = "No aplica";
                }
                
                // 9. Preparar para siguiente mes
                currentStock = stockAfterConsumption;
            } catch (error) {
                logger.error(`Error procesando proyección para ${proj.mes}: ${error.message}`);
                throw error;
            }
        });
    }

    async _savePredictions(predictions) {
        try {
            await fs.writeFile(
                this.predictionsFile,
                JSON.stringify(predictions, null, 2),
                'utf-8'
            );
            logger.info('Predicciones actualizadas correctamente');
        } catch (error) {
            logger.error(`Error guardando predicciones: ${error.message}`);
            throw error;
        }
    }

    async getProductByCode(productCode) {
        try {
            const predictions = await this.getLatestPredictions();
            const product = predictions.find(p => p.CODIGO === productCode);
            
            if (!product) {
                throw new Error(`Producto ${productCode} no encontrado`);
            }
            
            return product;
        } catch (error) {
            logger.error(`Error obteniendo producto: ${error.message}`);
            throw error;
        }
    }

    async updateProduct(productCode, updates) {
        try {
            // 1. Obtener predicciones actuales
            const predictions = await this.getLatestPredictions();
            
            // 2. Encontrar el producto
            const productIndex = predictions.findIndex(p => p.CODIGO === productCode);
            if (productIndex === -1) {
                throw new Error(`Producto ${productCode} no encontrado`);
            }
            
            // 3. Aplicar actualizaciones
            const updatedProduct = { 
                ...predictions[productIndex], 
                ...updates,
                STOCK_TOTAL: predictions[productIndex].STOCK_FISICO + (updates.UNIDADES_TRANSITO || 0)
            };
            
            // 4. Recalcular valores
            this._recalculateProductValues(updatedProduct);
            this._recalculateProjections(updatedProduct);
            
            // 5. Actualizar y guardar
            const updatedPredictions = [...predictions];
            updatedPredictions[productIndex] = updatedProduct;
            await this._savePredictions(updatedPredictions);
            
            return updatedProduct;
        } catch (error) {
            logger.error(`Error actualizando producto: ${error.message}`);
            throw error;
        }
    }
}

export default new PythonService();
