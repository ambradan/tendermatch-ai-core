# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copia package files
COPY package*.json ./

# Installa dipendenze (builder)
RUN npm install

# Copia sorgenti TypeScript
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copia solo i file necessari per produzione
COPY package*.json ./

# Installa solo dipendenze di produzione
# (--omit=dev è l'equivalente moderno di --only=production)
RUN npm install --omit=dev && npm cache clean --force

# Copia build compilata dallo stage di build
COPY --from=builder /app/dist ./dist

# Imposta ambiente
ENV NODE_ENV=production

# Esponi porta
EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Avvia server
CMD ["node", "dist/server.js"]

