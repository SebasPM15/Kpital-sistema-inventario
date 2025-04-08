# backend/Dockerfile
FROM node:23-slim

# 1) Instalar Python3 “completo” + cabeceras + herramientas de compilación
RUN apt-get update \
    && apt-get install -y \
         python3-full \
         python3-pip \
         python3-dev \
         build-essential \
         python-is-python3 \
    && rm -rf /var/lib/apt/lists/*

# 2) Directorio de trabajo
WORKDIR /usr/src/app

# 3) Copiar y resolver dependencias de Python primero (capa cacheable)
COPY ai_model/requirements.txt ./ai_model/
RUN pip3 install --no-cache-dir -r ai_model/requirements.txt

# 4) Copiar y resolver dependencias de Node.js
COPY backend/package*.json ./
RUN npm install --production

# 5) Copiar el resto del código
COPY backend/ ./
COPY ai_model/ ./ai_model/

# 6) Exponer puerto y arrancar
ENV PORT=10000
EXPOSE 10000
CMD ["npm", "start"]
