# Render production API image: install, build, migrate, start.
FROM public.ecr.aws/docker/library/node:20-slim

WORKDIR /app

# Government-network compatibility for package installs.
RUN npm config set strict-ssl false
RUN npm install -g pnpm@10.27.0 && pnpm config set strict-ssl false

# Copy workspace manifests first for efficient caching.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY api/package.json ./api/
COPY shared/package.json ./shared/

# Install full workspace deps needed to compile TypeScript.
RUN pnpm install --frozen-lockfile --ignore-scripts

# Copy source and build runtime artifacts.
COPY shared/ ./shared/
COPY api/ ./api/
RUN pnpm build:shared && pnpm --filter @ship/api build

ENV NODE_ENV=production
ENV PORT=10000

EXPOSE 10000

WORKDIR /app/api
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/index.js"]
