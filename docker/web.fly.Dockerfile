FROM node:20-alpine

WORKDIR /app

COPY web/package.json web/package-lock.json* /app/
RUN npm ci

COPY web /app

ARG NEXT_PUBLIC_API_BASE
ENV NEXT_PUBLIC_API_BASE=$NEXT_PUBLIC_API_BASE
RUN npm run build

EXPOSE 3000
CMD ["npm", "run", "start", "--", "--hostname", "0.0.0.0", "--port", "3000"]
