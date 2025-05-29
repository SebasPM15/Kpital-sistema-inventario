// src/routes/alert.routes.js
import express from 'express';
import { evaluarAlertaYNotificar } from '../controllers/alert.controller.js';

const router = express.Router();

router.post('/stock', evaluarAlertaYNotificar);

export default router;
