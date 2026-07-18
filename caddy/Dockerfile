# Caddy custom — binaire rebâti avec le bouncer CrowdSec.
#
# L'application des décisions CrowdSec dans Caddy est un MODULE Caddy : l'image
# stock `caddy:2-alpine` ne l'embarque pas. On recompile Caddy via xcaddy avec le
# handler HTTP du bouncer, puis on copie le binaire dans l'image runtime standard.
#
# Le handler `crowdsec` interroge la LAPI CrowdSec à chaque requête et bloque les
# IP sous décision. La détection (qui CRÉE les décisions) est faite par l'agent
# CrowdSec en parsant les access logs JSON de Caddy — cf. docker-compose.yml.
ARG CADDY_VERSION=2

FROM caddy:${CADDY_VERSION}-builder-alpine AS builder
# Tag épinglé (pas @main) pour un build reproductible — exigence jury.
RUN xcaddy build \
    --with github.com/hslatman/caddy-crowdsec-bouncer/http@v0.13.1

FROM caddy:${CADDY_VERSION}-alpine
COPY --from=builder /usr/bin/caddy /usr/bin/caddy
