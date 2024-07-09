FROM python:3.10
# Install Node
RUN apt-get update && apt-get install -y ca-certificates curl gnupg
RUN mkdir -p /etc/apt/keyrings
RUN curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
ENV NODE_MAJOR=18
RUN curl -fsSL https://deb.nodesource.com/setup_$NODE_MAJOR.x | bash -
RUN apt-get update && apt-get install nodejs -y
RUN echo "Node: " && node -v
RUN echo "NPM: " && npm -v

WORKDIR /usr/src/app

# Install Python dependencies
# RUN mkdir -p ./pythonWorker/
# Install CPU only version of torch
COPY ./pythonWorker/requirements.txt ./pythonWorker/requirements.txt
RUN pip install -r ./pythonWorker/requirements.txt

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