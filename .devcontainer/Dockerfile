# [Choice] Node.js version (use -bullseye variants on local arm64/Apple Silicon): 18, 16, 14, 18-bullseye, 16-bullseye, 14-bullseye, 18-buster, 16-buster, 14-buster
FROM python:3.10

RUN pip3 install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu

# Install Node
RUN apt-get update && apt-get install -y ca-certificates curl gnupg
RUN mkdir -p /etc/apt/keyrings
RUN curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg

ENV NODE_MAJOR=18
RUN curl -fsSL https://deb.nodesource.com/setup_$NODE_MAJOR.x | bash -
RUN apt-get update && apt-get install nodejs -y
RUN echo "Node: " && node -v
RUN echo "NPM: " && npm -v

#=== Devcontainer ONLY code ====

# Add a new user 'devContainer'
RUN adduser --disabled-password --gecos '' dev

# Switch to 'devContainer' user
USER dev
