# Stage 1: Build the Rust backend
FROM rust:1.95-slim-bookworm AS builder

# Install required build dependencies
RUN apt-get update && apt-get install -y pkg-config libssl-dev build-essential

WORKDIR /usr/src/app

COPY Cargo.toml Cargo.lock ./
RUN mkdir src && echo "fn main() {}" > src/main.rs && echo "" > src/lib.rs
RUN cargo build --release
RUN rm -rf src

COPY src ./src
RUN touch src/main.rs src/lib.rs
RUN cargo build --release

# Stage 2: Create a minimal runtime image
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y ca-certificates wget libvulkan1 mesa-vulkan-drivers libgl1 libegl1 && \
    wget https://github.com/microsoft/onnxruntime/releases/download/v1.22.0/onnxruntime-linux-x64-1.22.0.tgz && \
    tar -xzf onnxruntime-linux-x64-1.22.0.tgz && \
    cp onnxruntime-linux-x64-1.22.0/lib/libonnxruntime.so* /usr/lib/ && \
    rm -rf onnxruntime-linux-x64-1.22.0* && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /usr/src/app/target/release/RapidRAW /usr/local/bin/rapidraw-backend

ENV PORT=8080
EXPOSE $PORT

CMD ["rapidraw-backend"]
