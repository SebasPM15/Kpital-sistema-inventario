# backend/Dockerfile
FROM node:20-slim

# 1. Instalar dependencias del sistema
RUN apt-get update && apt-get install -y \
    python3 python3-pip python-is-python3 \
    build-essential \
    libpython3-dev \
    libatlas-base-dev \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    && rm -rf /var/lib/apt/lists/*

# 2. Crear estructura de directorios
WORKDIR /usr/src/app
RUN mkdir -p ai_model/data ai_model/models

# 3. Instalar dependencias de Node
COPY backend/package*.json ./
RUN npm install --production

# 4. Instalar dependencias de Python
COPY ai_model/requirements.txt ./ai_model/
RUN pip3 install --no-cache-dir --break-system-packages -r ai_model/requirements.txt

# 5. Copiar archivos necesarios
COPY ai_model/src/ ./ai_model/src/
COPY ai_model/models/ ./ai_model/models/
COPY ai_model/data/ ./ai_model/data/
COPY backend/ ./

# 6. Permisos y preparación
RUN chmod +x ai_model/src/predict.py

# 7. Variables de entorno
ENV PORT=10000
EXPOSE 10000

# 8. Comando de inicio
CMD ["npm", "start"]