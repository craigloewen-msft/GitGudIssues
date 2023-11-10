# [Choice] Node.js version (use -bullseye variants on local arm64/Apple Silicon): 18, 16, 14, 18-bullseye, 16-bullseye, 14-bullseye, 18-buster, 16-buster, 14-buster
FROM python:3.10

# Install Node
RUN apt-get update && apt-get install -y ca-certificates curl gnupg
RUN mkdir -p /etc/apt/keyrings
RUN curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg

ENV NODE_MAJOR=18
RUN echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_$NODE_MAJOR.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list
RUN apt-get update && apt-get install nodejs -y

# Install Python dependencies
# RUN mkdir -p ./pythonWorker/
COPY ./pythonWorker/requirements.txt ./pythonWorker/requirements.txt
RUN pip install -r ./pythonWorker/requirements.txt

WORKDIR /usr/src/app

# Install Node packages
COPY ./package*.json ./app.js ./
RUN npm install

COPY ./webinterface/package*.json ./webinterface/
RUN cd webinterface && npm install && cd ..

# Build the project and install dependencies
RUN npm run build

# Bring files over
COPY . . 

CMD ["node", "app.js"]