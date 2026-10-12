# ---------- build stage ----------
FROM node:20-alpine AS build-stage
WORKDIR /app

COPY package*.json ./
# Ensure devDependencies are installed for build tools like vite
ENV NODE_ENV=development
# Use npm ci if lockfile exists; fallback to npm install
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY . .
RUN npm ci
RUN npm run build 

# ---------- production stage ----------
FROM nginx:stable-alpine
COPY --from=build-stage /app/dist /usr/share/nginx/html
COPY ./nginx-vue-app.conf /etc/nginx/conf.d/default.conf