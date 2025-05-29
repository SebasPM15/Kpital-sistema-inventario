// src/config/db.js
import { Sequelize } from 'sequelize';
import dotenv from "dotenv";

// Cargar variables de entorno desde .env
dotenv.config();

const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        dialect: 'postgres',
        port: parseInt(process.env.DB_PORT, 10),
        logging: console.log,
        dialectOptions: {
            ssl: {
                require: true,
                rejectUnauthorized: false  // ¡Clave para Render!
            }
        },
        pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
        }
    }
);

export default sequelize;
