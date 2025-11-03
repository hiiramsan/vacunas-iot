# Node 20 ya trae corepack (compatibilidad con pnpm e yarn)
# Builder, trae todas los node modules
FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json nx.json tsconfig.base.json ./

COPY apps ./apps
COPY libs ./libs

RUN pnpm install --frozen-lockfile
RUN pnpm nx build cargamento-service

# Runtime trae los modulos que ocupa
FROM node:20-alpine AS runner
WORKDIR /app

RUN corepack enable

# build generado por Nx
COPY --from=builder /app/dist/apps/api/cargamento-service ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

EXPOSE 3000

CMD ["node", "dist/src/main.js"]