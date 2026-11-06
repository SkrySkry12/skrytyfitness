FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
# The repository does not include package-lock.json, so npm ci cannot run.
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY server ./server
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["npm", "start"]
