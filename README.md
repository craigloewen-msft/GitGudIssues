This repository's goal is to make a web interface to more easily triage, manage and respond to Github Issues.

## Set up

1. Have a MongoDB running. The easiest way to do this is in WSL.
  * `sudo apt install docker` to make sure you have docker.
  * I'm sure there's a way to start dockerd as a service, but a quick `sudo dockerd` will also manually run the docker service.
  * `sudo docker run -d -p 27017:27017 --name mongo mongo:latest` will start a docker container running mongodb.
2. Run `npm install` to get the right packages
  * make sure that you have an up to date `node`. See [NodeSource Node.js Binary Distributions](https://github.com/nodesource/distributions/blob/master/README.md)
  * First do an `npm install` in the root`
  * `cd webinterface/ ; npm install` in that directory too.
3. Run the webserver:
  * in the project root, `node app.js` will start the backend
  * in `webinterface/`, `npm run serve` will start the frontend.
4. Navigate to `http://localhost:8080/#/` to view the website.

### Further set up
You can replace `defaultconfig.js` with your actual one once you want to go live.
