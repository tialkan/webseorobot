FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY bin ./bin
COPY public ./public
COPY server ./server
COPY src ./src
USER node
ENV NODE_ENV=production PORT=3000
EXPOSE 3000
CMD ["node", "server/index.js"]
