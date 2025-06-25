FROM node:24.2.0

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

WORKDIR /workspace
RUN chown -R node:node /workspace

RUN corepack enable pnpm
