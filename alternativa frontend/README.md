# Plataforma de Gestión de Inventarios

Este proyecto es una aplicación web para gestionar productos y su consumo mensual. Permite registrar productos con su código, descripción, unidades por caja, stock total y consumos mensuales.

## 📌 Características

- **Gestión de productos**: Permite agregar nuevos productos con validaciones.
- **Validaciones avanzadas**: 
  - El código del producto debe ser único.
  - Se requiere un mínimo de 5 consumos mensuales mayores a 0.
  - No se permiten valores negativos en los consumos.
- **Interfaz amigable** con Tailwind CSS.
- **API REST** desarrollada con Express y Sequelize.

## 🛠️ Tecnologías Utilizadas

- **Frontend:** React, TypeScript, Tailwind CSS.
- **Base de Datos:** PostgreSQL.

## 📂 Estructura del Proyecto

```
│── /frontend
│   ├── /components
│   │   ├── ProductForm.tsx # Formulario de productos
│   │   ├── ProductList.tsx # Listado de productos
│   ├── /pages
│   ├── /styles
│── package.json
│── README.md
```

## ⚡ Instalación y Ejecución

### 1️⃣ Clonar el Repositorio

```bash
git clone https://github.com/tu-usuario/tu-repositorio.git
cd tu-repositorio
```

### 2️⃣ Configurar el Backend

1. Instalar dependencias:

   ```bash
   cd backend
   npm install
   ```

2. Configurar la base de datos en `.env`:

   ```
   DB_USER=tu_usuario
   DB_PASSWORD=tu_contraseña
   DB_NAME=tu_base_de_datos
   DB_HOST=localhost
   DB_PORT=5432
   ```

3. Ejecutar migraciones:

   ```bash
   npx sequelize-cli db:migrate
   ```

4. Iniciar el servidor:

   ```bash
   npm start
   ```

### 3️⃣ Configurar el Frontend

1. Instalar dependencias:

   ```bash
   cd frontend
   npm install
   ```

2. Iniciar el servidor:

   ```bash
   npm run dev
   ```

## 📝 Notas

- La API se ejecuta en `http://localhost:3500`.
- El frontend se ejecuta en `http://localhost:3000`.

## 📄 Licencia

Este proyecto está bajo la licencia **MIT**.
