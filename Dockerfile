# [Choice] Node.js version (use -bullseye variants on local arm64/Apple Silicon): 18, 16, 14, 18-bullseye, 16-bullseye, 14-bullseye, 18-buster, 16-buster, 14-buster
FROM node:18

WORKDIR /usr/src/app

# Install Node packages
COPY ./package*.json ./app.js ./
RUN npm install

COPY ./webinterface/package*.json ./webinterface/
RUN cd webinterface && npm install && cd ..

# Bring files over
COPY . . 

# Build the project and install dependencies
RUN npm run build

EXPOSE 8080

CMD ["node", "app.js"]