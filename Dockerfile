# ---- Build: compile shared, backend, and frontend ----
FROM node:20-alpine AS build
WORKDIR /app

# Install deps first (better layer caching): only the package manifests.
COPY package.json package-lock.json ./
COPY shared/package.json shared/package.json
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci

COPY shared shared
COPY backend backend
COPY frontend frontend
RUN npm run build

# Drop devDependencies (typescript, vitest, vite, etc.) before shipping.
RUN npm prune --omit=dev

# ---- Runtime: a single process serving the API, Socket.IO, and the built frontend ----
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/shared/package.json ./shared/package.json
COPY --from=build /app/shared/dist ./shared/dist
COPY --from=build /app/backend/package.json ./backend/package.json
COPY --from=build /app/backend/dist ./backend/dist
# backend/src/server.ts serves this as static files + SPA fallback (single deployable unit).
COPY --from=build /app/frontend/dist ./backend/public

EXPOSE 4000
CMD ["node", "backend/dist/server.js"]
