# backend/Dockerfile
FROM node:23-slim

# 1. Instalar Python y librerías necesarias para Prophet y Tensorflow
RUN apt-get update && apt-get install -y \
    python3 python3-pip python-is-python3 \
    build-essential \
    software-properties-common \
    libpython3-dev \
    libatlas-base-dev \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libstdc++6 \
    git \
    && rm -rf /var/lib/apt/lists/*

# 2. Crear y usar directorio de trabajo
WORKDIR /usr/src/app

# 3. Copiar y resolver dependencias de Node.js
COPY backend/package*.json ./
RUN npm install --production

# 4. Copiar e instalar dependencias de Python
COPY ai_model/requirements.txt ./ai_model/
RUN pip3 install --no-cache-dir --break-system-packages -r ai_model/requirements.txt

# 5. Copiar el resto del código de la aplicación
COPY backend/ ./
COPY ai_model/ ./ai_model/

# 6. Variables de entorno y puerto
ENV PORT=10000
EXPOSE 10000

# 7. Comando de inicio
CMD ["npm", "start"]
