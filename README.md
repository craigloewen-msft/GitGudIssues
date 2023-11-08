This repository's goal is to make a web interface to more easily triage, manage and respond to Github Issues.

## Use codespaces 

This project is set up with codespaces. If you launch the project with codespaces and then run `npm run dev` in the root directory you will get set up immediately. 

## Set up locally

1. Have a MongoDB running. The easiest way to do this is in WSL.
  * `sudo apt install docker` to make sure you have docker.
  * `sudo service docker start` will start Docker as a service
  * `sudo docker run -d -p 27017:27017 --name mongo mongo:latest` will start a docker container running mongodb.
    - if you've already created the container once, then just `sudo docker run -d -p 27017:27017 mongo` will suffice.
2. Run `npm install` to get the right packages
  * make sure that you have an up to date `node`. See [NodeSource Node.js Binary Distributions](https://github.com/nodesource/distributions/blob/master/README.md)
  * First do an `npm install` in the root`
  * `cd webinterface/ ; npm install` in that directory too.
3. Change `devMongoDBConnectionString` in `defaultconfig.js` to `mongodb://localhost/GithubIssueManagement` so it points to your local instance rather than the docker-compose ready version
3. Run the webserver:
  * in the project root, `node app.js` will start the backend
  * in `webinterface/`, `npm run serve` will start the frontend.
4. Navigate to `http://localhost:8080/#/` to view the website.

The frontend will hot reload, but the backend won't.

### Further set up
* You can replace `defaultconfig.js` with your actual one once you want to go live.
* You will probably want to generate a github API token. Copy `defaultconfig.js` to `config.js`, and stick that in `ghToken` in `config.js`, so that you don't instantly run into the rate limit.
