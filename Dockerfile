# syntax=docker/dockerfile:1
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# npm's download cache stays between builds (on the server), so new packages are the only ones fetched
RUN --mount=type=cache,target=/root/.npm npm ci

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN date -u +"%Y-%m-%dT%H:%M:%SZ" > BUILD_TIME
# Next.js's build cache stays between builds, so a deploy only rebuilds what changed instead of the whole app
RUN --mount=type=cache,target=/app/.next/cache NEXT_PUBLIC_BUILD_TIME="$(cat BUILD_TIME)" npm run build

FROM node:20-alpine AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=build /app/package.json /app/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/next.config.mjs ./
COPY --from=build /app/BUILD_TIME ./BUILD_TIME
USER node
EXPOSE 3000
CMD ["npm", "start", "--", "-H", "0.0.0.0"]
