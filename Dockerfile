# syntax=docker/dockerfile:1
# ScrollStop w jednym kontenerze (§21.1): aplikacja (tryb serwerowy, ten sam adres) + API + SQLite.
#   docker build -t scrollstop .
#   docker run -p 8787:8787 -v scrollstop-data:/data -e APP_URL=https://twoja-domena.pl/ scrollstop
# Za odwrotnym proxy (TLS): dodaj -e TRUST_PROXY=1. Kopie zapasowe: wolumen /data.
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY scripts ./scripts
# Sieć z inspekcją TLS (proxy firmowe): opcjonalny certyfikat CA jako sekret BuildKit — nie trafia do obrazu.
#   docker build --secret id=extra_ca,src=/ścieżka/ca.crt -t scrollstop .
RUN --mount=type=secret,id=extra_ca,required=false \
    if [ -s /run/secrets/extra_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca; fi && npm ci
COPY . .
# Model Face Landmarker hostowany razem z aplikacją (bez zapytań do zewnętrznych serwerów w trakcie sesji).
RUN --mount=type=secret,id=extra_ca,required=false \
    if [ -s /run/secrets/extra_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca; fi && \
    (npm run fetch-model || echo "Model nie został pobrany — aplikacja użyje zdalnego modelu.")
ENV VITE_API_URL=/
RUN npm run build && npm run server:build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production \
    DATA_DIR=/data \
    STATIC_DIR=/app/dist \
    PORT=8787 \
    HOST=0.0.0.0 \
    NODE_NO_WARNINGS=1
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server
RUN mkdir -p /data && chown node:node /data
VOLUME /data
EXPOSE 8787
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist-server/main.js"]
