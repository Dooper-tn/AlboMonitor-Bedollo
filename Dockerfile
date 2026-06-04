FROM node:20-alpine AS base

# 1. Installa le dipendenze solo quando necessario
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# 2. Compila il codice sorgente
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

# Variabili placeholder per evitare crash di compilazione (verranno sovrascritte a runtime da Cloud Run)
ENV SUPABASE_URL="https://placeholder.supabase.co"
ENV SUPABASE_SERVICE_ROLE_KEY="placeholder"
ENV GMAIL_USER="placeholder"
ENV GMAIL_APP_PASSWORD="placeholder"

RUN npm run build

# 3. Immagine finale di produzione
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Configura i permessi corretti per la cache di prerendering
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Copia l'output standalone compilato da Next.js
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
