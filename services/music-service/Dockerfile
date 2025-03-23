FROM node:18-alpine
WORKDIR /app
COPY package.json .
RUN npm install
COPY tsconfig.json .
COPY src/ .
EXPOSE 3001
CMD ["npm", "start"]