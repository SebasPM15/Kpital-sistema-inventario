import { Router } from 'express';
import { register, login, getUser, getAllUsers, getUserByEmailController } from '../controllers/auth.controller.js';
const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/:id', getUser); // Buscar por ID
router.get('/email/:email', getUserByEmailController);
router.get('/', getAllUsers); // GET /api/auth

export default router;
