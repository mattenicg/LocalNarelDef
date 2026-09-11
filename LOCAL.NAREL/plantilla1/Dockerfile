FROM node:20-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN mkdir -p /app/uploads /app/logs
ENV NODE_ENV=production
ENV PUERTO=3000
EXPOSE 3000
CMD ["node", "src/server.js"]
