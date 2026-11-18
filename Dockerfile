# PSI-256 #10: PresensIKu API container (Docker host 192.168.1.201).
# Env comes from docker-compose / the runtime environment - .env is
# dockerignored and never baked into the image.
FROM node:22-alpine

WORKDIR /app

# Production dependencies only (jest/nodemon stay out).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY index.js ./
COPY config controllers middleware routes utils ./

# Selfie uploads live on a volume, not in the image layer.
RUN mkdir -p uploads/selfie && chown -R node:node /app
USER node

ENV NODE_ENV=production PORT=3000
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/ > /dev/null || exit 1

CMD ["node", "index.js"]
