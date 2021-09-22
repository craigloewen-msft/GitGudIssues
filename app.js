const axios = require('axios');
const mongoose = require('mongoose');
const fs = require('fs');
// Get config
const config = fs.existsSync('./config.js') ? require('./config') : require('./defaultconfig');

function PromiseTimeout(delayms) {
    return new Promise(function (resolve, reject) {
        setTimeout(resolve, delayms);
    });
}

class RefreshRepoTask {
    constructor(inputUrl) {
        this.pageNum = 1;
        this.repoUrl = inputUrl;
        this.perPageResults = 100;
        this.lastUpdatedTime = null;
        this.lastSeenItemUpdatedAt = null;
        this.firstSeenUpdatedAt = null;
        this.repoDocument = null;
    }

    async refreshData() {
        var finishedRequest = false;

        var repoItems = await RepoDetails.find({ url: this.repoUrl })

        if (repoItems.length == 0) {
            repoItems = [await RepoDetails.create({ url: urlOfInterest, lastUpdatedAt: new Date('1/1/1900') })]
        }

        this.repoDocument = repoItems[0];
        this.lastUpdatedTime = this.repoDocument.lastUpdatedAt;

        while (!finishedRequest) {
            console.log("Making request page num: ", this.pageNum);
            var response = await this.makeRequest(this.pageNum);

            if (response.status == 200) {
                // If no issues are reported then we are done
                if (response.data.length == 0) {
                    finishedRequest = true;
                    this.repoDocument.lastUpdatedAt = this.firstSeenUpdatedAt;
                    await this.repoDocument.save();
                    console.log("Update Request Complete - No more issues");
                } else {
                    var dbSaveResult = await this.storeInDataBase(response.data);
                    if (dbSaveResult == 'uptodate') {
                        finishedRequest = true;
                        this.repoDocument.lastUpdatedAt = this.firstSeenUpdatedAt;
                        await this.repoDocument.save();
                        console.log("Update Request Complete - Up to date");
                    }
                }
            } else if (response.status == 403) {
                var responseUnixTime = response.headers['x-ratelimit-reset'];
                var currentTime = Math.floor(+new Date() / 1000);
                var retryTime = new Date(Number(responseUnixTime) * 1000);
                var retryDifference = responseUnixTime - currentTime;
                console.log("Rate limited waiting until: ", retryTime);
                await PromiseTimeout(retryDifference * 1000);
            }

            this.pageNum = this.pageNum + 1;
        }
    }

    async makeRequest(pageNum) {
        try {
            const response = await axios.get(this.repoUrl, { params: { page: pageNum, per_page: this.perPageResults, sort: 'updated', state: 'all' } });
            return response;
        } catch (error) {
            return error.response;
        }
    }

    async storeInDataBase(data) {
        var response = 'success';

        await Promise.all(data.map(async (responseItem) => {
            var updatedAtDate = new Date(responseItem['updated_at']);
            this.lastSeenItemUpdatedAt = updatedAtDate;

            if (this.firstSeenUpdatedAt == null) {
                this.firstSeenUpdatedAt = updatedAtDate;
            }

            if (updatedAtDate > this.lastUpdatedTime) {
                // TODO: Update the issue and store it in the database
                console.log("Updating: ", responseItem.number);
                var issueToSave = (await IssueDetails.find({ number: responseItem.number, repo: this.repoDocument.url }))[0];
                if (issueToSave == null) {
                    issueToSave = await IssueDetails.create({ number: responseItem.number, repo: this.repoDocument.url });
                }
                issueToSave.data = responseItem;
                await issueToSave.save();
            } else {
                response = 'uptodate';
            }
        }));

        return response;
    }

}

// Set up Dev or Production
let mongooseConnectionString = '';
let hostPort = 3000;

if (process.env.NODE_ENV == 'production') {
    mongooseConnectionString = config.prodMongoDBConnectionString;
    hostPort = 80;
} else {
    mongooseConnectionString = config.devMongoDBConnectionString;
    hostPort = 3000;
}

// Set up Mongoose connection
const Schema = mongoose.Schema;
const RepoInfo = new Schema({
    lastUpdatedAt: Date,
    url: String,
});

const IssueInfo = new Schema({
    data: Object,
    number: Number,
    repo: String,
});

mongoose.connect(mongooseConnectionString, { useNewUrlParser: true, useUnifiedTopology: true });

const RepoDetails = mongoose.model('repoInfo', RepoInfo, 'repoInfo');
const IssueDetails = mongoose.model('issueInfo', IssueInfo, 'issueInfo');

// Main thread

async function main() {
    console.log("Starting program");

    // var urlOfInterest = 'https://api.github.com/repos/craigloewen-msft/WSLTipsAndTricks/issues'
    var urlOfInterest = 'https://api.github.com/repos/MicrosoftDocs/WSL/issues'

    var refreshRequest = new RefreshRepoTask(urlOfInterest);

    // await refreshRequest.refreshData();

    console.log("Done!");
}

main();