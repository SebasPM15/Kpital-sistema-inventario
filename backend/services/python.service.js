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
        // Constants from the Python function
        this.leadTimeDays = 20;
        this.alarmaStockDays = 22;
        this.diasPuntoReorden = 44;
        this.maxDiasReposicion = 22;
        this.diasConsumoMensual = 20;


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
                persistChanges = true,
                poNumber = null,
                expectedArrival = null
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
            
            // 4. Sumar nuevas unidades en tránsito a las existentes
            const newUnits = parseFloat(units) || 0;
            productToUpdate.UNIDADES_TRANSITO = (productToUpdate.UNIDADES_TRANSITO || 0) + newUnits;
            productToUpdate.STOCK_TOTAL = productToUpdate.STOCK_FISICO + productToUpdate.UNIDADES_TRANSITO;

            // 5. Actualizar PEDIDOS_PENDIENTES si se proporciona poNumber
            if (poNumber && newUnits > 0) {
                productToUpdate.PEDIDOS_PENDIENTES = productToUpdate.PEDIDOS_PENDIENTES || {};
                productToUpdate.PEDIDOS_PENDIENTES[poNumber] = {
                    unidades: newUnits,
                    columna: `A PEDIR UNID PO-${poNumber}`,
                    expectedArrival: expectedArrival || new Date().toISOString().split('T')[0]
                };
            }

            // 6. Recalcular valores inmediatos
            this._recalculateProductValues(productToUpdate);

            // 7. Recalcular proyecciones si se solicita
            if (recalculateProjections) {
                this._recalculateProjections(productToUpdate);
            }

            // 8. Actualizar frecuencia de reposición si se solicita
            if (updateFrequency && productToUpdate.CONSUMO_DIARIO > 0) {
                productToUpdate.FRECUENCIA_REPOSICION = 
                    Math.min(
                        productToUpdate.PUNTO_REORDEN / productToUpdate.CONSUMO_DIARIO,
                        productToUpdate.CONFIGURACION.DIAS_MAX_REPOSICION
                    );
            }

            // 9. Actualizar y guardar si se solicita
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
        // 1. Calcular el punto de reorden efectivo
        const puntoReordenEfectivo = product.PUNTO_REORDEN;
        
        // 2. Calcular stock disponible (físico + en tránsito)
        const stockDisponible = product.STOCK_FISICO + product.UNIDADES_TRANSITO;
        
        // 3. Calcular déficit CORREGIDO (solo si el stock disponible es menor al punto de reorden)
        product.DEFICIT = Math.max(puntoReordenEfectivo - stockDisponible, 0);
        
        // 4. Calcular cajas a pedir
        if (product.UNIDADES_POR_CAJA > 0) {
            product.CAJAS_A_PEDIR = Math.ceil(product.DEFICIT / product.UNIDADES_POR_CAJA);
            product.UNIDADES_A_PEDIR = product.CAJAS_A_PEDIR * product.UNIDADES_POR_CAJA;
        } else {
            product.CAJAS_A_PEDIR = 0;
            product.UNIDADES_A_PEDIR = 0;
        }
    
        // 5. Calcular días de cobertura
        if (product.CONSUMO_DIARIO > 0) {
            product.DIAS_COBERTURA = Math.min(
                stockDisponible / product.CONSUMO_DIARIO,
                this.maxDiasReposicion
            );
            
            // Calcular fecha de reposición
            const diasHastaReorden = product.DEFICIT > 0 ? 
                (product.DEFICIT / product.CONSUMO_DIARIO) : 0;
            
            const fechaReposicion = new Date();
            fechaReposicion.setDate(
                fechaReposicion.getDate() + 
                Math.max(diasHastaReorden - this.leadTimeDays, 0)
            );
            
            product.FECHA_REPOSICION = fechaReposicion.toISOString().split('T')[0];
        } else {
            product.DIAS_COBERTURA = 0;
            product.FECHA_REPOSICION = "No aplica";
        }
    }

    _recalculateProjections(product) {
        const monthNames = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
        const diasConsumoMensual = 20; // Días de consumo por mes
        
        // 1. Configuración inicial
        const fechaInicioProyeccion = new Date(product.PROYECCIONES[0]?.fecha_inicio_proyeccion || '2025-02-21');
        const consumoDiarioBase = product.CONSUMO_DIARIO > 0 ? product.CONSUMO_DIARIO : 
                                (product.PROM_CONS_PROYEC || product.CONSUMO_PROMEDIO) / product.CONFIGURACION.DIAS_LABORALES_MES;
        
        // 2. Función para calcular consumo mensual dinámico
        const calcularConsumoMensual = (month, year) => {
            // A. Obtener histórico para este mes específico
            const mesHistorico = monthNames[month].substring(0, 3);
            let historicos = [];
            
            // Buscar consumos históricos para este mes en años anteriores
            for (const [key, value] of Object.entries(product.HISTORICO_CONSUMOS || {})) {
                if (key.includes(mesHistorico)) {
                    historicos.push(parseFloat(value));
                }
            }
            
            // B. Calcular promedio histórico para este mes
            const historicoPromedio = historicos.length > 0 ? 
                historicos.reduce((sum, val) => sum + val, 0) / historicos.length : 
                consumoDiarioBase * diasConsumoMensual;
            
            // C. Calcular tendencia reciente (últimos 3 meses)
            let factorTendencia = 1.0;
            const historicoKeys = Object.keys(product.HISTORICO_CONSUMOS || {});
            if (historicoKeys.length >= 3) {
                const ultimos3 = historicoKeys.slice(-3).map(k => parseFloat(product.HISTORICO_CONSUMOS[k]));
                if (ultimos3.length >= 2) {
                    const diff = ultimos3[1] - ultimos3[0];
                    const crecimiento = ultimos3[0] !== 0 ? diff / ultimos3[0] : 0;
                    factorTendencia = Math.min(1.5, Math.max(0.5, 1 + crecimiento));
                }
            }
            
            // D. Combinación inteligente (60% histórico, 40% base con tendencia)
            const consumoBaseConTendencia = consumoDiarioBase * diasConsumoMensual * factorTendencia;
            const consumoMensual = (0.6 * historicoPromedio) + (0.4 * consumoBaseConTendencia);
            
            // E. Asegurar mínimo razonable (no menos del 50% del base)
            return Math.max(consumoMensual, consumoDiarioBase * diasConsumoMensual * 0.5);
        };
        
        // 3. Cálculos básicos (dinámicos por mes)
        const stockSeguridadBase = consumoDiarioBase * product.CONFIGURACION.DIAS_STOCK_SEGURIDAD;
        const puntoReordenBase = consumoDiarioBase * product.CONFIGURACION.DIAS_PUNTO_REORDEN;
        
        // 4. Inicialización de estado
        let currentStock = product.STOCK_TOTAL;
        let transitUnits = 0;
        let pendingOrders = {};
        
        // 5. Generar proyecciones para 6 meses
        product.PROYECCIONES = Array(6).fill().map((_, index) => {
            const projectionDate = new Date(fechaInicioProyeccion);
            projectionDate.setMonth(fechaInicioProyeccion.getMonth() + index);
            
            const month = projectionDate.getMonth();
            const year = projectionDate.getFullYear();
            const monthStr = monthNames[month];
            const mesKey = `${monthStr}-${year}`;
            
            // A. Calcular consumo dinámico para este mes
            const consumoMensual = calcularConsumoMensual(month, year);
            const consumoDiario = consumoMensual / diasConsumoMensual;
            const stockSeguridad = consumoDiario * product.CONFIGURACION.DIAS_STOCK_SEGURIDAD;
            const puntoReorden = consumoDiario * product.CONFIGURACION.DIAS_PUNTO_REORDEN;
            
            // B. Calcular stock inicial para este mes
            let stockInicialMes = currentStock;
            let pedidosRecibidos = 0;
            
            // C. Aplicar pedidos pendientes programados
            const pedidosEsteMes = pendingOrders[mesKey] || 0;
            pedidosRecibidos += pedidosEsteMes;
            currentStock += pedidosEsteMes;
            delete pendingOrders[mesKey];
            
            // D. Calcular consumo y stock resultante
            const stockAfterConsumption = Math.max(currentStock - consumoMensual, 0);
            
            // E. Calcular déficit
            const stockDisponible = stockAfterConsumption + transitUnits;
            const deficit = Math.max(puntoReorden - stockDisponible, 0);
            
            // F. Determinar necesidad de pedido
            let unidadesAPedir = 0;
            let fechaReposicion = "No aplica";
            let fechaSolicitud = "No aplica";
            let fechaArribo = "No aplica";
            
            if (deficit > 0 && consumoDiario > 0) {
                unidadesAPedir = Math.ceil(deficit / product.UNIDADES_POR_CAJA) * product.UNIDADES_POR_CAJA;
                
                const diasHastaReposicion = Math.max(
                    (puntoReorden - stockDisponible) / consumoDiario - product.CONFIGURACION.LEAD_TIME_REPOSICION, 
                    0
                );
                
                fechaReposicion = new Date(projectionDate);
                fechaReposicion.setDate(projectionDate.getDate() + Math.ceil(diasHastaReposicion));
                fechaReposicion = fechaReposicion.toISOString().split('T')[0];
                
                fechaSolicitud = new Date(projectionDate);
                fechaSolicitud.setDate(1);
                fechaArribo = new Date(fechaSolicitud);
                fechaArribo.setDate(fechaSolicitud.getDate() + product.CONFIGURACION.LEAD_TIME_REPOSICION);
                
                fechaSolicitud = fechaSolicitud.toISOString().split('T')[0];
                fechaArribo = fechaArribo.toISOString().split('T')[0];
                
                // Programar llegada para el mes siguiente
                const nextMonth = new Date(projectionDate);
                nextMonth.setMonth(projectionDate.getMonth() + 1);
                const nextMonthKey = `${monthNames[nextMonth.getMonth()]}-${nextMonth.getFullYear()}`;
                
                pendingOrders[nextMonthKey] = (pendingOrders[nextMonthKey] || 0) + unidadesAPedir;
            }
            
            // G. Preparar siguiente mes
            currentStock = stockAfterConsumption;
            
            return {
                mes: mesKey,
                stock_inicial: stockInicialMes,
                stock_proyectado: stockAfterConsumption,
                consumo_mensual: consumoMensual,
                consumo_diario: consumoDiario,
                stock_seguridad: stockSeguridad,
                stock_minimo: consumoMensual + stockSeguridad,
                punto_reorden: puntoReorden,
                deficit: deficit,
                cajas_a_pedir: Math.ceil(unidadesAPedir / product.UNIDADES_POR_CAJA),
                unidades_a_pedir: unidadesAPedir,
                unidades_en_transito: transitUnits,
                pedidos_pendientes: {...pendingOrders},
                accion_requerida: unidadesAPedir > 0 ? 
                    `Pedir ${Math.ceil(unidadesAPedir / product.UNIDADES_POR_CAJA)} cajas` : 
                    "Stock suficiente",
                pedidos_recibidos: pedidosRecibidos,
                fecha_reposicion: fechaReposicion,
                fecha_solicitud: fechaSolicitud,
                fecha_arribo: fechaArribo,
                tiempo_cobertura: consumoDiario > 0 ? 
                    Math.min(stockDisponible / consumoDiario, product.CONFIGURACION.DIAS_MAX_REPOSICION) : 0,
                alerta_stock: stockAfterConsumption < (consumoDiario * product.CONFIGURACION.DIAS_ALARMA_STOCK)
            };
        });
        
        // 6. Actualizar métricas
        product.metricas = {
            roturasStock: product.PROYECCIONES.filter(p => p.stock_proyectado <= 0).length,
            totalPedidos: product.PROYECCIONES.reduce((sum, p) => sum + p.unidades_a_pedir, 0),
            promedioCobertura: product.PROYECCIONES.reduce((sum, p) => sum + (p.tiempo_cobertura || 0), 0) / 
                             product.PROYECCIONES.length,
            variabilidadConsumo: this._calcularVariabilidadConsumo(product.PROYECCIONES)
        };
    }
    
    // Función auxiliar para calcular variabilidad de consumos
    _calcularVariabilidadConsumo(proyecciones) {
        const consumos = proyecciones.map(p => p.consumo_mensual);
        if (consumos.length < 2) return 0;
        
        const mean = consumos.reduce((sum, val) => sum + val, 0) / consumos.length;
        const variance = consumos.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / consumos.length;
        return Math.sqrt(variance) / mean; // Coeficiente de variación
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
                STOCK_TOTAL: predictions[productIndex].STOCK_FISICO + (updates.UNIDADES_TRANSITO || predictions[productIndex].UNIDADES_TRANSITO || 0)
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