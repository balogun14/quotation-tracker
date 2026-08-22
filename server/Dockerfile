# syntax=docker/dockerfile:1

FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json /app/package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
# tsc only emits compiled JS; copy the SQL migrations so runMigrations() works.
COPY --from=build /app/src/db/migrations /app/dist/db/migrations
COPY docker-entrypoint.sh /usr/local/bin/quotely-entrypoint
RUN chmod +x /usr/local/bin/quotely-entrypoint
EXPOSE 3000
ENTRYPOINT ["quotely-entrypoint"]
CMD ["api"]
