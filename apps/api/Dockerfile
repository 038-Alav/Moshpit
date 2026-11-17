FROM node:24-alpine

WORKDIR /workspace

RUN npm install --global pnpm@10.34.9

# Copy workspace manifests first to make dependency installation cacheable.
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/contracts/package.json ./packages/contracts/package.json

RUN pnpm install --filter @moshpit/api... --no-frozen-lockfile

COPY apps/api ./apps/api
COPY packages/contracts ./packages/contracts

RUN pnpm --filter @moshpit/api build

ENV NODE_ENV=production
USER node
EXPOSE 3000

# The API is compiled from the monorepo rootDir, so the emitted entrypoint
# retains the apps/api/src path below apps/api/dist.
CMD ["node", "apps/api/dist/apps/api/src/server.js"]
