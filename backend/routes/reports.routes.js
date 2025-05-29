import { Router } from 'express';
import { getReports, createReport, getReportById } from '../controllers/reports.controller.js';
import verifyToken from '../middlewares/auth.middleware.js'; // Ajusta según tu middleware

const router = Router();

router.get('/', verifyToken, getReports);
router.post('/', verifyToken, createReport);
router.get('/:id', verifyToken, getReportById);

export default router;