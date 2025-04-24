import Report from '../models/report.model.js';
import User from '../models/user.model.js';
import Product from '../models/product.model.js';

export const getReports = async (req, res, next) => {
  try {
    const reports = await Report.findAll({
      include: [
        { model: User, attributes: ['id', 'nombre', 'email', 'celular'] },
        { model: Product, attributes: ['code', 'description', 'totalStock', 'reorderPoint', 'unitsToOrder'] },
      ],
      order: [['createdAt', 'DESC']],
    });
    return res.json({ success: true, data: reports });
  } catch (err) {
    next(err);
  }
};

export const createReport = async (req, res, next) => {
  try {
    const { filename, url, productId } = req.body;
    const userId = req.user.id; // Ajusta según tu middleware de auth

    // Verificar que el producto exista
    const product = await Product.findByPk(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Producto no encontrado' });
    }

    // Obtener información del usuario
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    // Crear el reporte
    const report = await Report.create({ filename, url, userId, productId });

    // Formatear el contenido del reporte
    const currentDate = new Date();
    const formattedDate = currentDate.toLocaleDateString('es-ES');
    const formattedTime = currentDate.toLocaleTimeString('es-ES');

    const reportContent = `
Reporte de Análisis
Fecha: ${formattedDate}
Hora: ${formattedTime}
Generado por:
- ID: ${user.id}
- Nombre: ${user.nombre}
- Correo: ${user.email}
- Celular: ${user.celular}
Producto Analizado:
- Código: ${product.code}
- Descripción: ${product.description}
- Stock Total: ${product.totalStock}
- Punto de Reorden: ${product.reorderPoint}
- Unidades A Pedir: ${product.unitsToOrder}
    `;

    return res.status(201).json({ success: true, data: { report, content: reportContent } });
  } catch (err) {
    next(err);
  }
};

// Agrega este nuevo método al controlador
export const getReportById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const report = await Report.findByPk(id, {
      include: [
        { model: User, attributes: ['id', 'nombre', 'email', 'celular'] },
        { model: Product, attributes: ['code', 'description', 'totalStock', 'reorderPoint', 'unitsToOrder'] },
      ],
    });

    if (!report) {
      return res.status(404).json({ success: false, message: 'Reporte no encontrado' });
    }

    // Generar el contenido del reporte (similar a createReport)
    const createdAt = new Date(report.createdAt);
    const formattedDate = createdAt.toLocaleDateString('es-ES');
    const formattedTime = createdAt.toLocaleTimeString('es-ES');

    const content = `
Reporte de Análisis
Fecha: ${formattedDate}
Hora: ${formattedTime}
Generado por:
- ID: ${report.User.id}
- Nombre: ${report.User.nombre}
- Correo: ${report.User.email}
- Celular: ${report.User.celular}
Producto Analizado:
- Código: ${report.Product.code}
- Descripción: ${report.Product.description}
- Stock Total: ${report.Product.totalStock}
- Punto de Reorden: ${report.Product.reorderPoint}
- Unidades A Pedir: ${report.Product.unitsToOrder}
    `;

    return res.json({ 
      success: true, 
      data: {
        ...report.toJSON(),
        content
      }
    });
  } catch (err) {
    next(err);
  }
};