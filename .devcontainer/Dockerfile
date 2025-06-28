FROM node:24.2.0

ENV PNPM_HOME="/workspace/pnpm"
ENV PLAYWRIGHT_BROWSERS_PATH="/workspace/playwright"
ENV PATH="$PNPM_HOME:$PATH"

WORKDIR /workspace
RUN chown -R node:node /workspace

RUN corepack enable pnpm

# Install Playwright dependencies and browsers
RUN pnpm add -g playwright
RUN playwright install chromium --with-deps
