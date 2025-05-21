import { Router } from 'express';
import { register, resendVerificationCode, verifyRegistration, login, logout } from '../controllers/auth.controller.js';

const router = Router();

router.post('/register', register);
router.post('/resend-verification', resendVerificationCode);
router.post('/verify', verifyRegistration);
router.post('/login', login);
router.post('/logout', logout);

export default router;