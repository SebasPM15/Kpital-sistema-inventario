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
            const pythonProcess = spawn('python', [
                '-u',
                this.scriptPath,
                '--excel', inputPath
            ]);

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
}

export default new PythonService();
