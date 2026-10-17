# syntax=docker/dockerfile:1
# The DRAKON API as a small container (for Render, docs/deploy.md).
# Build from the api/ folder:   docker build -t drakon-api .
# Run:                          docker run --rm -p 8080:8080 -e DATABASE_URL=... drakon-api

# 1. Build stage: the Go compiler. Its version matches go.mod.
FROM golang:1.27 AS build
WORKDIR /src
# Download the modules first, so Docker can reuse this layer when only
# our own code changes.
COPY go.mod go.sum ./
RUN go mod download
COPY . .
# CGO_ENABLED=0: a fully static binary that needs no C libraries.
# -trimpath and -ldflags="-s -w": no local paths or debug data inside.
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server

# 2. Final stage: only the binary, on a tiny base image with CA
# certificates (for the TLS connection to Neon), no shell, no package
# manager, and a non-root user.
FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/server /server
USER nonroot:nonroot
# The server listens on $PORT (Render sets it); 8080 when it is not set.
ENV PORT=8080
EXPOSE 8080
ENTRYPOINT ["/server"]
