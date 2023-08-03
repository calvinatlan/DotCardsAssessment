FROM node:lts
LABEL authors="Calvin"
WORKDIR /usr/app
COPY package.json .
RUN npm install --quiet
COPY . .
