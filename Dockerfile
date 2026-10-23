FROM public.ecr.aws/docker/library/node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY backend/package*.json ./backend/
COPY website/package*.json ./website/
COPY dashboard/package*.json ./dashboard/

RUN npm install --include=dev --include=optional && \
    npm --prefix backend install && \
    npm --prefix website install --include=dev --include=optional && \
    npm --prefix dashboard install --include=dev --include=optional

COPY . .

RUN npm --prefix website run build && npm --prefix dashboard run build

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "backend/src/server.js"]
