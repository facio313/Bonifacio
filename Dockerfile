FROM authelia/authelia:4.39.20@sha256:68277b28658a69bb3f512c2c23c41c7df7d9311d0e506e64e26c96dcd75d0539 AS authelia

# ---- Build Stage ----
FROM node:22-bookworm-slim@sha256:d649c27dae7ba0137b3cef5dd75baa422c08dc3d9e3fc0c23dfb172dc3cc6436 AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Production Stage ----
FROM node:22-bookworm-slim@sha256:d649c27dae7ba0137b3cef5dd75baa422c08dc3d9e3fc0c23dfb172dc3cc6436
ENV NODE_ENV=production

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=builder /app/dist ./dist
COPY --from=authelia /app/authelia /usr/local/bin/authelia
COPY ops/sso/admin ./ops/sso/admin

RUN chown -R node:node /app
USER node

EXPOSE 80 9092
CMD ["node", "ops/sso/admin/landing.mjs"]
