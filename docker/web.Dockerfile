FROM node:20-alpine

WORKDIR /app

COPY web/package.json web/package-lock.json* /app/
RUN npm install

COPY web /app

EXPOSE 3000
CMD ["npm", "run", "dev", "--", "-H", "0.0.0.0", "-p", "3000"]
