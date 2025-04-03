import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { PATHS } from '../config/constants.js';
import { logger } from '../utils/logger.js';

class PythonService {
    constructor() {
        this.scriptPath = path.join(PATHS.AI_MODEL_DIR, '../../ai_model/src/predict.py');
        this.timeout = 300000; // 5 minutos
    }

    async processExcel(file) {
        try {
            // Ejecutar script Python
            await this.runScript(file.path);
            
            // Validar generación de archivo
            await this.validateOutput();
            
            return this.getLatestPredictions();
        } catch (error) {
            logger.error(`Python Service Error: ${error.message}`);
            throw error;
        } finally {
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
                if (code === 0) {
                    resolve(output);
                } else {
                    reject(new Error(`Script falló con código ${code}`));
                }
            });
        });
    }

    async validateOutput() {
        try {
            await fs.access(PATHS.PREDICTIONS_FILE, fs.constants.F_OK);
            const stats = await fs.stat(PATHS.PREDICTIONS_FILE);
            if (stats.size === 0) throw new Error('Archivo de predicciones vacío');
        } catch (error) {
            throw new Error(`Error validando output: ${error.message}`);
        }
    }

    async getLatestPredictions() {
        try {
            const data = await fs.readFile(PATHS.PREDICTIONS_FILE, 'utf-8');
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