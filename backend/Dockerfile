# Перехід на debian-based образ для стабільного TLS
FROM node:20-bullseye
RUN apt-get update && apt-get install -y ca-certificates curl openssl && update-ca-certificates

WORKDIR /app

# лише package.json – щоби шар кешувався
COPY package.json ./
RUN npm install --production

# далі копіюємо весь код
COPY . .

ENV NODE_ENV=production
EXPOSE 5000

# для надійнішого логування з префіксом часу
CMD ["node", "src/index.js"]
