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

    // Utility to validate Date objects
    _isValidDate(date) {
        return date instanceof Date && !isNaN(date.getTime());
    }

    addBusinessDays(fechaInicio, dias) {
        if (!this._isValidDate(fechaInicio)) {
            logger.error(`Invalid fechaInicio in addBusinessDays: ${fechaInicio}`);
            return new Date(); // Fallback to current date
        }

        let fechaActual = new Date(fechaInicio);
        let diasSumados = 0;

        while (diasSumados < dias) {
            fechaActual.setDate(fechaActual.getDate() + 1);
            if (fechaActual.getDay() !== 0 && fechaActual.getDay() !== 6) {
                diasSumados++;
            }
        }

        return fechaActual;
    }

    getBusinessDaysBetween(startDate, endDate) {
        if (!this._isValidDate(startDate) || !this._isValidDate(endDate)) {
            logger.error(`Invalid dates in getBusinessDaysBetween: start=${startDate}, end=${endDate}`);
            return 0;
        }

        let count = 0;
        const date = new Date(startDate);
        const end = new Date(endDate);

        while (date <= end) {
            if (date.getDay() !== 0 && date.getDay() !== 6) {
                count++;
            }
            date.setDate(date.getDate() + 1);
        }

        return count;
    }

    async processExcel(file, transitDays = 0) {
        try {
            await this.runScript(file.path, transitDays);
            await this.validateOutput();
            const predictions = await this.getLatestPredictions();
            predictions.forEach(product => {
                product.CONFIGURACION.DIAS_TRANSITO = transitDays;
            });
            await this._savePredictions(predictions);
            return predictions;
        } catch (error) {
            logger.error(`Python Service Error: ${error.message}`);
            throw error;
        } finally {
            await this.cleanTempFiles(file.path);
        }
    }

    runScript(inputPath, transitDays) {
        return new Promise((resolve, reject) => {
            const args = [
                '-u',
                this.scriptPath,
                '--excel',
                inputPath,
            ];

            if (transitDays > 0) {
                args.push('--dias_transito', transitDays.toString());
            }

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

    async applyTransitDaysToProjection(productCode, projectionIndex, transitDays, options = {}) {
        try {
            const { persistChanges = true } = options;

            if (transitDays === undefined || transitDays === null || isNaN(transitDays) || transitDays < 0) {
                throw new Error('Los días en tránsito deben ser un número positivo');
            }

            // Leer las predicciones actuales
            const predictions = await this.getLatestPredictions();
            const productIndex = predictions.findIndex((p) => p.CODIGO === productCode);
            if (productIndex === -1) {
                throw new Error(`Producto ${productCode} no encontrado`);
            }

            // Hacer una copia profunda del producto
            const product = JSON.parse(JSON.stringify(predictions[productIndex]));

            // Validar índice de proyección
            if (projectionIndex < 0 || projectionIndex >= product.PROYECCIONES.length) {
                throw new Error('Índice de proyección inválido');
            }

            // Actualizar la proyección específica
            const projectionToUpdate = product.PROYECCIONES[projectionIndex];
            let fechaInicio = new Date(projectionToUpdate.fecha_inicio_proyeccion || product.FECHA_INICIO || new Date());
            if (!this._isValidDate(fechaInicio)) {
                logger.warning(`Fecha de inicio inválida, usando fecha actual`);
                fechaInicio = new Date();
            }

            const fechaFin = this.addBusinessDays(fechaInicio, transitDays);
            projectionToUpdate.dias_transito = transitDays;
            projectionToUpdate.fecha_fin = fechaFin.toISOString().split('T')[0];
            projectionToUpdate.consumo_mensual = product.CONSUMO_DIARIO * transitDays;
            projectionToUpdate.stock_proyectado = Math.max(
                projectionToUpdate.stock_inicial - projectionToUpdate.consumo_mensual,
                0
            );

            // Recalcular acciones para la proyección actualizada
            this._updateProjectionActions(product, projectionToUpdate);

            // Recalcular todas las proyecciones, preservando dias_transito de otras proyecciones
            this._recalculateProjections(product);

            // Actualizar métricas
            this._updateProductMetrics(product);

            if (persistChanges) {
                const updatedPredictions = [...predictions];
                updatedPredictions[productIndex] = product;
                await this._savePredictions(updatedPredictions);
            }

            return product;
        } catch (error) {
            logger.error(`Error aplicando días de tránsito: ${error.message}`, {
                productCode,
                projectionIndex,
                transitDays,
                stack: error.stack
            });
            throw error;
        }
    }

    _updateProjectionActions(product, projection) {
        // Calcular stock objetivo (promedio entre stock_seguridad y stock_minimo)
        const stockObjetivo = (product.STOCK_SEGURIDAD + product.STOCK_MINIMO) / 2;
        let deficit = Math.max(stockObjetivo - projection.stock_proyectado, 0);

        // Ajuste para evitar quiebres de stock
        if (projection.stock_proyectado < product.STOCK_SEGURIDAD) {
            deficit = Math.max(product.STOCK_SEGURIDAD - projection.stock_proyectado, deficit);
        }

        // Initialize default values
        projection.cajas_a_pedir = 0;
        projection.unidades_a_pedir = 0;
        projection.accion_requerida = "Stock suficiente";
        projection.fecha_reposicion = "No aplica";
        projection.fecha_solicitud = "No aplica";

        if (deficit > 0 && product.UNIDADES_POR_CAJA > 0) {
            projection.cajas_a_pedir = Math.ceil(deficit / product.UNIDADES_POR_CAJA);
            projection.unidades_a_pedir = projection.cajas_a_pedir * product.UNIDADES_POR_CAJA;
            projection.accion_requerida = `Pedir ${projection.cajas_a_pedir} cajas`;

            // Calcular fechas relacionadas con el pedido
            let fechaInicio = new Date(projection.fecha_inicio_proyeccion);
            if (!this._isValidDate(fechaInicio)) {
                logger.warning(`Invalid fecha_inicio_proyeccion in _updateProjectionActions: ${projection.fecha_inicio_proyeccion}, using current date`);
                fechaInicio = new Date();
            }

            const tiempoCobertura = product.CONSUMO_DIARIO > 0
                ? Math.min(projection.stock_proyectado / product.CONSUMO_DIARIO, product.CONFIGURACION.DIAS_MAX_REPOSICION)
                : 0;

            const fechaReposicion = this.addBusinessDays(fechaInicio, Math.max(tiempoCobertura - product.CONFIGURACION.LEAD_TIME_REPOSICION, 0));
            projection.fecha_reposicion = this._isValidDate(fechaReposicion)
                ? fechaReposicion.toISOString().split('T')[0]
                : "No aplica";

            const fechaSolicitud = this.addBusinessDays(fechaInicio, Math.max(tiempoCobertura - product.CONFIGURACION.LEAD_TIME_REPOSICION - 5, 0));
            projection.fecha_solicitud = this._isValidDate(fechaSolicitud)
                ? fechaSolicitud.toISOString().split('T')[0]
                : "No aplica";

            const fechaArribo = this.addBusinessDays(fechaInicio, Math.max(tiempoCobertura - 5, 0));
            projection.fecha_arribo = this._isValidDate(fechaArribo)
                ? fechaArribo.toISOString().split('T')[0]
                : "No aplica";
        }

        // Set alerta_stock
        projection.alerta_stock = projection.stock_proyectado < (product.CONSUMO_DIARIO * product.CONFIGURACION.DIAS_ALARMA_STOCK);
    }

    _recalculateSubsequentProjections(product, startIndex) {
        let currentStock = product.PROYECCIONES[startIndex].stock_proyectado;

        for (let i = startIndex + 1; i < product.PROYECCIONES.length; i++) {
            const currentProj = product.PROYECCIONES[i];
            const prevProj = product.PROYECCIONES[i - 1];

            // Validar fecha_fin de la proyección anterior
            let fechaInicio = new Date(prevProj.fecha_fin);
            if (!this._isValidDate(fechaInicio)) {
                logger.warning(`Invalid fecha_fin in previous projection for index ${i-1}, using current date`);
                fechaInicio = new Date();
            }

            // Actualizar fecha inicio basada en fecha fin de la proyección anterior
            currentProj.fecha_inicio_proyeccion = fechaInicio.toISOString().split('T')[0];

            // Calcular días hábiles hasta fin de mes
            const fechaFinMes = new Date(fechaInicio.getFullYear(), fechaInicio.getMonth() + 1, 0);
            currentProj.dias_transito = this.getBusinessDaysBetween(fechaInicio, fechaFinMes);

            // Actualizar fecha_fin
            const fechaFin = this.addBusinessDays(fechaInicio, currentProj.dias_transito);
            currentProj.fecha_fin = this._isValidDate(fechaFin)
                ? fechaFin.toISOString().split('T')[0]
                : new Date().toISOString().split('T')[0];

            // Actualizar consumo y stock
            currentProj.consumo_mensual = product.CONSUMO_DIARIO * currentProj.dias_transito;
            currentProj.stock_inicial = currentStock;
            currentProj.stock_proyectado = Math.max(currentStock - currentProj.consumo_mensual, 0);

            // Recalcular acciones
            this._updateProjectionActions(product, currentProj);

            // Actualizar stock para la siguiente proyección
            currentStock = currentProj.stock_proyectado + (currentProj.unidades_a_pedir || 0);
        }
    }

    _updateProductMetrics(product) {
        product.metricas = {
            roturasStock: product.PROYECCIONES.filter(p => p.stock_proyectado <= 0).length,
            totalPedidos: product.PROYECCIONES.reduce((sum, p) => sum + p.unidades_a_pedir, 0),
            promedioCobertura: product.PROYECCIONES.reduce((sum, p) => sum + (p.tiempo_cobertura || 0), 0) /
                product.PROYECCIONES.length,
            variabilidadConsumo: this._calculateConsumptionVariability(product.PROYECCIONES)
        };

        // Actualizar stock total considerando pedidos pendientes
        product.STOCK_TOTAL = product.STOCK_FISICO +
            (product.UNIDADES_TRANSITO || 0) +
            product.PROYECCIONES.reduce((sum, p) => sum + (p.unidades_a_pedir || 0), 0);
    }

    _calculateConsumptionVariability(projections) {
        const consumos = projections.map(p => p.consumo_mensual);
        if (consumos.length < 2) return 0;
        
        const mean = consumos.reduce((a, b) => a + b, 0) / consumos.length;
        const variance = consumos.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / consumos.length;
        return Math.sqrt(variance) / mean;
    }
    
    //Metodos antiguos
    async applyTransitUnits(productCode, units, options = {}) {
        try {
            const {
                recalculateProjections = true,
                updateFrequency = true,
                persistChanges = true,
                poNumber = null,
                expectedArrival = null,
            } = options;

            const predictions = await this.getLatestPredictions();
            const productIndex = predictions.findIndex((p) => p.CODIGO === productCode);
            if (productIndex === -1) {
                throw new Error(`Producto ${productCode} no encontrado`);
            }

            const productToUpdate = JSON.parse(JSON.stringify(predictions[productIndex]));
            const transitDays = productToUpdate.CONFIGURACION.DIAS_TRANSITO || 0;

            let fechaArribo = expectedArrival ? new Date(expectedArrival) : new Date();
            let fechaArriboStr = this._isValidDate(fechaArribo)
                ? fechaArribo.toISOString().split('T')[0]
                : new Date().toISOString().split('T')[0];
            if (transitDays > 0) {
                fechaArribo = this.addBusinessDays(new Date(), transitDays);
                fechaArriboStr = this._isValidDate(fechaArribo)
                    ? fechaArribo.toISOString().split('T')[0]
                    : new Date().toISOString().split('T')[0];
            }

            const newUnits = parseFloat(units) || 0;
            productToUpdate.UNIDADES_TRANSITO = (productToUpdate.UNIDADES_TRANSITO || 0) + newUnits;
            productToUpdate.STOCK_TOTAL = productToUpdate.STOCK_FISICO + productToUpdate.UNIDADES_TRANSITO;

            let consumoProyectado = 0;
            if (transitDays > 0) {
                consumoProyectado = productToUpdate.CONSUMO_DIARIO * transitDays;
                productToUpdate.CONSUMO_PROYECTADO_ARRIBO = consumoProyectado;
                productToUpdate.FECHA_ARRIBO_PEDIDO = fechaArriboStr;
            } else {
                productToUpdate.CONSUMO_PROYECTADO_ARRIBO = 0;
                productToUpdate.FECHA_ARRIBO_PEDIDO = 'No aplica';
            }

            if (poNumber && newUnits > 0) {
                productToUpdate.PEDIDOS_PENDIENTES = productToUpdate.PEDIDOS_PENDIENTES || {};
                productToUpdate.PEDIDOS_PENDIENTES[poNumber] = {
                    unidades: newUnits,
                    columna: `A PEDIR UNID PO-${poNumber}`,
                    expectedArrival: expectedArrival || fechaArriboStr,
                };
            }

            this._recalculateProductValues(productToUpdate);

            if (recalculateProjections) {
                this._recalculateProjections(productToUpdate);
            }

            if (updateFrequency && productToUpdate.CONSUMO_DIARIO > 0) {
                productToUpdate.FRECUENCIA_REPOSICION = Math.min(
                    productToUpdate.PUNTO_REORDEN / productToUpdate.CONSUMO_DIARIO,
                    productToUpdate.CONFIGURACION.DIAS_MAX_REPOSICION
                );
            }

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

    async applyTransitDays(productCode, days, options = {}) {
        try {
            const {
                recalculateProjections = true,
                persistChanges = true,
            } = options;

            if (days === undefined || days === null || isNaN(days) || days < 0) {
                throw new Error('Los días en tránsito deben ser un número positivo');
            }

            const predictions = await this.getLatestPredictions();
            const productIndex = predictions.findIndex((p) => p.CODIGO === productCode);
            if (productIndex === -1) {
                throw new Error(`Producto ${productCode} no encontrado`);
            }

            const productToUpdate = JSON.parse(JSON.stringify(predictions[productIndex]));
            productToUpdate.CONFIGURACION.DIAS_TRANSITO = parseInt(days, 10);

            if (recalculateProjections) {
                this._recalculateProjections(productToUpdate, productToUpdate.CONFIGURACION.DIAS_TRANSITO);
            }

            if (persistChanges) {
                const updatedPredictions = [...predictions];
                updatedPredictions[productIndex] = productToUpdate;
                await this._savePredictions(updatedPredictions);
            }

            return productToUpdate;
        } catch (error) {
            logger.error(`Error aplicando días en tránsito: ${error.message}`);
            throw error;
        }
    }

    _recalculateProductValues(product) {
        const stockObjetivo = (product.STOCK_SEGURIDAD + product.STOCK_MINIMO) / 2;
        const stockDisponible = product.STOCK_FISICO + (product.UNIDADES_TRANSITO || 0);
        let deficit = Math.max(stockObjetivo - stockDisponible, 0);
        if (stockDisponible < product.STOCK_SEGURIDAD) {
            deficit = Math.max(product.STOCK_SEGURIDAD - stockDisponible, deficit);
        }

        if (product.UNIDADES_POR_CAJA > 0) {
            product.CAJAS_A_PEDIR = Math.ceil(deficit / product.UNIDADES_POR_CAJA);
            product.UNIDADES_A_PEDIR = product.CAJAS_A_PEDIR * product.UNIDADES_POR_CAJA;
        } else {
            product.CAJAS_A_PEDIR = 0;
            product.UNIDADES_A_PEDIR = 0;
        }

        if (product.CONSUMO_DIARIO > 0) {
            product.DIAS_COBERTURA = Math.min(
                stockDisponible / product.CONSUMO_DIARIO,
                this.maxDiasReposicion
            );

            const diasHastaReorden = deficit > 0 ? deficit / product.CONSUMO_DIARIO : 0;
            const fechaReposicion = this.addBusinessDays(new Date(), Math.max(diasHastaReorden - this.leadTimeDays, 0));
            fechaReposicion.setDate(fechaReposicion.getDate() + Math.max(diasHastaReorden - this.leadTimeDays, 0));
            product.FECHA_REPOSICION = this._isValidDate(fechaReposicion)
                ? fechaReposicion.toISOString().split('T')[0]
                : "No aplica";
        } else {
            product.DIAS_COBERTURA = 0;
            product.FECHA_REPOSICION = 'No aplica';
        }
    }

    _recalculateProjections(product) {
        const monthNames = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
        const diasConsumoMensual = this.diasConsumoMensual;

        // 1. Configuración inicial
        let fechaInicioProyeccion = product.FECHA_INICIO
            ? new Date(product.FECHA_INICIO)
            : new Date();
        if (!this._isValidDate(fechaInicioProyeccion)) {
            logger.warning(`Invalid fecha_inicio_proyeccion in _recalculateProjections, using current date`);
            fechaInicioProyeccion = new Date();
        }

        // 2. Calcular valores fijos
        const consumoDiario = product.CONSUMO_DIARIO || 0;
        const stockSeguridad = product.STOCK_SEGURIDAD || (consumoDiario * product.CONFIGURACION.DIAS_STOCK_SEGURIDAD);
        const stockMinimo = product.STOCK_MINIMO || (consumoDiario * product.CONFIGURACION.DIAS_LABORALES_MES + stockSeguridad);
        const puntoReorden = product.PUNTO_REORDEN || (consumoDiario * product.CONFIGURACION.DIAS_PUNTO_REORDEN);

        // 3. Inicialización de estado
        let currentStock = product.STOCK_FISICO;
        const transitUnits = product.UNIDADES_TRANSITO || 0;
        let pendingOrders = { ...product.PEDIDOS_PENDIENTES } || {};
        let currentDate = new Date(fechaInicioProyeccion);
        const proyecciones = [];
        let projectionIndex = 0;
        const maxProjections = 6; // Limitar a 6 proyecciones
        const endDate = new Date(currentDate);
        endDate.setMonth(endDate.getMonth() + 6); // Cubrir 6 meses

        // 4. Generar proyecciones dinámicas
        while (currentDate < endDate && projectionIndex < maxProjections) {
            const month = currentDate.getMonth();
            const year = currentDate.getFullYear();
            const monthStr = `${monthNames[month]}-${year}`;

            // Usar dias_transito existente o diasConsumoMensual como predeterminado
            const existingProjection = product.PROYECCIONES && product.PROYECCIONES[projectionIndex];
            const diasTransito = existingProjection?.dias_transito || diasConsumoMensual;

            // A. Calcular fechas
            const fechaFin = this.addBusinessDays(currentDate, diasTransito);
            const consumoMensual = consumoDiario * diasTransito;

            // B. Calcular stock inicial
            let stockInicialMes = currentStock;
            let pedidosRecibidos = 0;
            if (projectionIndex > 0) {
                // Usar stock proyectado + unidades pedidas de la proyección anterior
                stockInicialMes = proyecciones[projectionIndex - 1].stock_proyectado + (proyecciones[projectionIndex - 1].unidades_a_pedir || 0);
                currentStock = stockInicialMes;
            }            
            if (pendingOrders[monthStr]) {
                pedidosRecibidos = pendingOrders[monthStr];
                delete pendingOrders[monthStr];
                currentStock += pedidosRecibidos;
            }

            // C. Calcular stock proyectado
            const stockProyectado = Math.max(stockInicialMes - consumoMensual, 0);

            // D. Determinar necesidad de pedido con lógica optimizada
            const stockObjetivo = (stockSeguridad + stockMinimo) / 2;
            let deficit = Math.max(stockObjetivo - stockProyectado, 0);
            if (stockProyectado < stockSeguridad) {
                deficit = Math.max(stockSeguridad - stockProyectado, deficit);
            }

            // D. Determinar necesidad de pedido
            let unidadesAPedir = 0;
            let cajasAPedir = 0;
            let fechaReposicion = "No aplica";
            let fechaSolicitud = "No aplica";
            let fechaArriboPedido = "No aplica";
            let accionRequerida = "Stock suficiente";

            if (deficit > 0 && product.UNIDADES_POR_CAJA > 0) {
                cajasAPedir = Math.ceil(deficit / product.UNIDADES_POR_CAJA);
                unidadesAPedir = cajasAPedir * product.UNIDADES_POR_CAJA;
                accionRequerida = `Pedir ${cajasAPedir} cajas`;

                const tiempoCobertura = consumoDiario > 0
                    ? Math.min(stockProyectado / consumoDiario, product.CONFIGURACION.DIAS_MAX_REPOSICION)
                    : 0;

                fechaReposicion = this.addBusinessDays(currentDate, Math.max(tiempoCobertura - product.CONFIGURACION.LEAD_TIME_REPOSICION, 0))
                    .toISOString()
                    .split('T')[0];
                fechaSolicitud = this.addBusinessDays(currentDate, Math.max(tiempoCobertura - product.CONFIGURACION.LEAD_TIME_REPOSICION - 5, 0))
                    .toISOString()
                    .split('T')[0];
                fechaArriboPedido = this.addBusinessDays(currentDate, Math.max(tiempoCobertura - 5, 0))
                    .toISOString()
                    .split('T')[0];

                // Programar llegada
                const arrivalDate = this.addBusinessDays(currentDate, diasTransito);
                const arrivalMonthStr = `${monthNames[arrivalDate.getMonth()]}-${arrivalDate.getFullYear()}`;
                pendingOrders[arrivalMonthStr] = (pendingOrders[arrivalMonthStr] || 0) + unidadesAPedir;
            }

            // E. Crear proyección
            proyecciones.push({
                mes: `${monthStr}${diasTransito < diasConsumoMensual ? ` (${diasTransito} días)` : ''}`,
                stock_inicial: parseFloat(stockInicialMes.toFixed(2)),
                stock_proyectado: parseFloat(stockProyectado.toFixed(2)),
                consumo_mensual: parseFloat(consumoMensual.toFixed(2)),
                consumo_diario: parseFloat(consumoDiario.toFixed(2)),
                stock_seguridad: parseFloat(stockSeguridad.toFixed(2)),
                stock_minimo: parseFloat(stockMinimo.toFixed(2)),
                punto_reorden: parseFloat(puntoReorden.toFixed(2)),
                deficit: parseFloat(deficit.toFixed(2)),
                cajas_a_pedir: cajasAPedir,
                unidades_a_pedir: parseFloat(unidadesAPedir.toFixed(2)),
                unidades_en_transito: projectionIndex === 0 ? 0 : parseFloat(transitUnits.toFixed(2)),
                pedidos_pendientes: { ...pendingOrders },
                accion_requerida: accionRequerida,
                pedidos_recibidos: parseFloat(pedidosRecibidos.toFixed(2)),
                fecha_reposicion: fechaReposicion,
                fecha_solicitud: fechaSolicitud,
                fecha_arribo: fechaArriboPedido,
                tiempo_cobertura: consumoDiario > 0
                    ? parseFloat(Math.min(stockProyectado / consumoDiario, product.CONFIGURACION.DIAS_MAX_REPOSICION).toFixed(2))
                    : 0,
                alerta_stock: stockProyectado < (consumoDiario * product.CONFIGURACION.DIAS_ALARMA_STOCK),
                fecha_inicio_proyeccion: currentDate.toISOString().split('T')[0],
                consumo_inicial_transito: parseFloat((consumoDiario * diasTransito).toFixed(2)),
                dias_transito: diasTransito,
                stock_total: parseFloat((stockInicialMes + pedidosRecibidos).toFixed(2)),
                fecha_fin: fechaFin.toISOString().split('T')[0]
            });

            // F. Preparar siguiente proyección
            currentStock = stockProyectado;
            currentDate = new Date(fechaFin);
            projectionIndex++;
        }

        // 5. Actualizar proyecciones
        product.PROYECCIONES = proyecciones;
        product.FECHA_INICIO = fechaInicioProyeccion.toISOString().split('T')[0];
        product.CONSUMO_PROYECTADO_ARRIBO = consumoDiario * (proyecciones[0]?.dias_transito || diasConsumoMensual);

        // 6. Actualizar métricas
        this._updateProductMetrics(product);
    }

    _calcularVariabilidadConsumo(proyecciones) {
        const consumos = proyecciones.map((p) => p.consumo_mensual);
        if (consumos.length < 2) return 0;

        const mean = consumos.reduce((sum, val) => sum + val, 0) / consumos.length;
        const variance = consumos.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / consumos.length;
        return Math.sqrt(variance) / mean;
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
            const product = predictions.find((p) => p.CODIGO === productCode);

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
            const predictions = await this.getLatestPredictions();
            const productIndex = predictions.findIndex((p) => p.CODIGO === productCode);
            if (productIndex === -1) {
                throw new Error(`Producto ${productCode} no encontrado`);
            }

            const updatedProduct = {
                ...predictions[productIndex],
                ...updates,
                STOCK_TOTAL:
                    predictions[productIndex].STOCK_FISICO +
                    (updates.UNIDADES_TRANSITO || predictions[productIndex].UNIDADES_TRANSITO || 0),
            };

            this._recalculateProductValues(updatedProduct);
            this._recalculateProjections(updatedProduct, updatedProduct.CONFIGURACION.DIAS_TRANSITO || 0);

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