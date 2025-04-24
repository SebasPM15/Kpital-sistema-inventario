import { Router } from 'express';
import {
    getProducts,
    createProduct,
    updateProduct,
    deleteProduct,
} from '../controllers/products.controller.js';
import verifyToken from '../middlewares/auth.middleware.js'; // Ajusta según tu middleware

const router = Router();

router.get('/', verifyToken, getProducts);
router.post('/', verifyToken, createProduct);
router.put('/:id', verifyToken, updateProduct);
router.delete('/:id', verifyToken, deleteProduct);

export default router;