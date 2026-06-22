# Stage 1: build
FROM node:22-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Vite inlines VITE_* env at build time, so the Google client ID must be present here.
ARG VITE_GOOGLE_CLIENT_ID=""
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
RUN npm run build

# Stage 2: run
FROM node:22-slim AS runner
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/drizzle.config.ts ./
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
CMD ["node", "dist/index.mjs"]
