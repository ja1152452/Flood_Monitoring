FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache dumb-init ffmpeg

COPY package*.json ./
RUN npm ci --only=production

COPY src/ ./src/

RUN mkdir -p hls

EXPOSE 5000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/index.js"]