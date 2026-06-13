FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/peopleclaw-vercel/package.json packages/peopleclaw-vercel/package.json
RUN pnpm install --filter @peopleclaw/vercel-broker... --frozen-lockfile
COPY packages/peopleclaw-vercel packages/peopleclaw-vercel
RUN pnpm --filter @peopleclaw/vercel-broker build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production PCV_HOST=0.0.0.0 PCV_PORT=8787 PCV_DATA_DIR=/data
RUN corepack enable && addgroup -S pcv && adduser -S pcv -G pcv && mkdir -p /data && chown -R pcv:pcv /data
COPY --from=build /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=build /app/packages/peopleclaw-vercel/package.json packages/peopleclaw-vercel/package.json
RUN pnpm install --filter @peopleclaw/vercel-broker --prod --frozen-lockfile
COPY --from=build /app/packages/peopleclaw-vercel/dist packages/peopleclaw-vercel/dist
COPY --from=build /app/packages/peopleclaw-vercel/.env.example packages/peopleclaw-vercel/.env.example
USER pcv
EXPOSE 8787
CMD ["node", "packages/peopleclaw-vercel/dist/server.js"]
