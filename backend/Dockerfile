# backend/Dockerfile
FROM node:23-slim

# 1. Instalar Python3 y alias 'python' → 'python3'
RUN apt-get update \
    && apt-get install -y python3 python3-pip python-is-python3 \
    && rm -rf /var/lib/apt/lists/*

# 2. Establecer directorio de trabajo
WORKDIR /usr/src/app

# 3. Copiar y resolver dependencias de Node.js
#    - package.json y package-lock.json (si existe)
COPY backend/package*.json ./
RUN npm install --production

# 4. Copiar y resolver dependencias de Python
COPY ai_model/requirements.txt ./ai_model/
RUN pip3 install --no-cache-dir -r ai_model/requirements.txt

# 5. Copiar el código de la aplicación
COPY backend/ ./
COPY ai_model/ ./ai_model/

# 6. Variables de entorno y puerto
ENV PORT=10000
EXPOSE 10000

# 7. Comando de arranque
CMD ["npm", "start"]
