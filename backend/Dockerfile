# backend/Dockerfile
FROM node:20-slim 

# 1. Instalar Python y librerías necesarias
RUN apt-get update && apt-get install -y \
    python3 python3-pip python-is-python3 \
    build-essential \
    libpython3-dev \
    && rm -rf /var/lib/apt/lists/*

# 2. Crear y usar directorio de trabajo
WORKDIR /usr/src/app

# 3. Copiar solo lo necesario para instalar dependencias
COPY backend/package*.json ./
RUN npm install --production

# 4. Copiar e instalar dependencias de Python
COPY ai_model/requirements.txt ./ai_model/
RUN pip3 install --no-cache-dir --upgrade pip && \
    pip3 install --no-cache-dir -r ai_model/requirements.txt

# 5. Copiar el resto del código
COPY backend/ ./
COPY ai_model/ ./ai_model/

# 6. Variables de entorno
ENV PORT=10000
EXPOSE 10000

# 7. Comando de inicio
CMD ["npm", "start"]