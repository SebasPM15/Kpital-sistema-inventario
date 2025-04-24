import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';
import User from './user.model.js';
import Product from './product.model.js';

const Report = sequelize.define('Report', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  filename: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  url: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id',
    },
  },
  productId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Product,
      key: 'id',
    },
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: true
  },
}, {
  tableName: 'reports',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: false,
});

// Definir relaciones
Report.belongsTo(User, { foreignKey: 'userId' });
Report.belongsTo(Product, { foreignKey: 'productId' });
User.hasMany(Report, { foreignKey: 'userId' });
Product.hasMany(Report, { foreignKey: 'productId' });

export default Report;