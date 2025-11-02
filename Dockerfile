# Etapa base: usar Node 20 LTS
FROM node:20-alpine

# Crear directorio de trabajo
WORKDIR /app

# Copiar package.json e instalar dependencias
COPY package*.json ./
RUN npm install --production

# Copiar el resto del código
COPY . .

# Exponer el puerto definido en .env (por defecto 3000)
EXPOSE 3000

# Comando de arranque
CMD ["npm", "start"]
