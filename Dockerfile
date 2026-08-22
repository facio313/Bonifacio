# check=skip=SecretsUsedInArgOrEnv
# PORTFOLIO_AUTH_MODE is a public branch contract, not a credential.
FROM authelia/authelia:4.39.20@sha256:68277b28658a69bb3f512c2c23c41c7df7d9311d0e506e64e26c96dcd75d0539 AS authelia

# ---- Build Stage ----
FROM node:22-bookworm-slim@sha256:d649c27dae7ba0137b3cef5dd75baa422c08dc3d9e3fc0c23dfb172dc3cc6436 AS builder
ARG PORTFOLIO_BRANCH
ARG PORTFOLIO_AUTH_MODE
ENV PORTFOLIO_BRANCH=${PORTFOLIO_BRANCH} \
    PORTFOLIO_AUTH_MODE=${PORTFOLIO_AUTH_MODE}
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN ./scripts/portfolio-auth-mode.sh check \
    && npm run test:portfolio-auth \
    && npm run build

# ---- Production Stage ----
FROM node:22-bookworm-slim@sha256:d649c27dae7ba0137b3cef5dd75baa422c08dc3d9e3fc0c23dfb172dc3cc6436
ARG PORTFOLIO_BRANCH
ARG PORTFOLIO_AUTH_MODE
ENV NODE_ENV=production \
    PORTFOLIO_BRANCH=${PORTFOLIO_BRANCH} \
    PORTFOLIO_AUTH_MODE=${PORTFOLIO_AUTH_MODE}
LABEL work.bonifacio.portfolio.branch=${PORTFOLIO_BRANCH} \
      work.bonifacio.portfolio.auth-mode=${PORTFOLIO_AUTH_MODE}

RUN printf '%s\n%s\n' "$PORTFOLIO_BRANCH" "$PORTFOLIO_AUTH_MODE" \
      > /etc/portfolio-auth-build \
    && chmod 0444 /etc/portfolio-auth-build

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=builder /app/dist ./dist
COPY --from=authelia /app/authelia /usr/local/bin/authelia
COPY ops/sso/admin ./ops/sso/admin
COPY ops/sso/role-contract.json ./ops/sso/role-contract.json
COPY scripts/portfolio-auth-mode.sh ./scripts/portfolio-auth-mode.sh

RUN test -x /usr/bin/script
RUN chown -R node:node /app
USER node

EXPOSE 80 9092
ENTRYPOINT ["./scripts/portfolio-auth-mode.sh", "exec", "--"]
CMD ["node", "ops/sso/admin/landing.mjs"]
