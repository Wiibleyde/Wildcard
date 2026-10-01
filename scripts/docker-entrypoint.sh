#!/usr/bin/env sh
# Container entrypoint: migrate the schema, then hand over to the server.
set -e

if [ "${WILDCARD_MIGRATE:-run}" = "skip" ]; then
	echo "entrypoint: WILDCARD_MIGRATE=skip — not touching the schema"
else
	# Deliberately fatal: a server running against a schema it does not match
	# serves errors that look like app bugs. Refusing to start is louder, and the
	# previous container keeps serving on a `docker compose up -d`.
	/app/scripts/migrate.sh
fi

# The migration DSN is a superuser credential: it is needed by migrate.sh only
# and must not leak into the long-running Next server (its env is readable from
# any RCE / debug dump / child process). Drop it before handing over.
unset WILDCARD_DATABASE_URL

# exec: the server becomes PID 1 and receives SIGTERM from `docker stop`.
exec "$@"
