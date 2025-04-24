import Product from '../models/product.model.js';

/**
 * Obtiene todos los productos o filtra por código si se proporciona el parámetro 'code'.
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 * @param {Function} next - Función para pasar al siguiente middleware
 */
export const getProducts = async (req, res, next) => {
    try {
        const { code } = req.query;
        const where = code ? { code } : {};
        const products = await Product.findAll({
            where,
            order: [['createdAt', 'DESC']],
        });
        return res.json({ success: true, data: products });
    } catch (err) {
        next(err);
    }
};

/**
 * Crea un nuevo producto con validación de unicidad para el código.
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 * @param {Function} next - Función para pasar al siguiente middleware
 */
export const createProduct = async (req, res, next) => {
    try {
        const { code, description, totalStock, reorderPoint, unitsToOrder } = req.body;

        // Validar que el código no esté duplicado
        const existingProduct = await Product.findOne({ where: { code } });
        if (existingProduct) {
            return res.status(409).json({
                success: false,
                message: `El código ${code} ya está en uso por otro producto`,
            });
        }

        // Validar campos requeridos
        if (!code || !description || totalStock == null || reorderPoint == null || unitsToOrder == null) {
            return res.status(400).json({
                success: false,
                message: 'Faltan campos requeridos: code, description, totalStock, reorderPoint, unitsToOrder',
            });
        }

        const product = await Product.create({
            code,
            description,
            totalStock: Math.floor(totalStock),
            reorderPoint: Math.floor(reorderPoint),
            unitsToOrder: Math.floor(unitsToOrder),
        });

        return res.status(201).json({ success: true, data: product });
    } catch (err) {
        next(err);
    }
};

/**
 * Actualiza un producto existente por su ID.
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 * @param {Function} next - Función para pasar al siguiente middleware
 */
export const updateProduct = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { code, description, totalStock, reorderPoint, unitsToOrder } = req.body;

        const product = await Product.findByPk(id);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Producto no encontrado' });
        }

        // Validar que el nuevo código no esté en uso por otro producto
        if (code && code !== product.code) {
            const existingProduct = await Product.findOne({ where: { code } });
            if (existingProduct) {
                return res.status(409).json({
                    success: false,
                    message: `El código ${code} ya está en uso por otro producto`,
                });
            }
        }

        await product.update({
            code: code || product.code,
            description: description || product.description,
            totalStock: totalStock != null ? Math.floor(totalStock) : product.totalStock,
            reorderPoint: reorderPoint != null ? Math.floor(reorderPoint) : product.reorderPoint,
            unitsToOrder: unitsToOrder != null ? Math.floor(unitsToOrder) : product.unitsToOrder,
        });

        return res.json({ success: true, data: product });
    } catch (err) {
        next(err);
    }
};

/**
 * Elimina un producto por su ID.
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 * @param {Function} next - Función para pasar al siguiente middleware
 */
export const deleteProduct = async (req, res, next) => {
    try {
        const { id } = req.params;

        const product = await Product.findByPk(id);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Producto no encontrado' });
        }

        await product.destroy();
        return res.json({ success: true, message: 'Producto eliminado correctamente' });
    } catch (err) {
        next(err);
    }
};