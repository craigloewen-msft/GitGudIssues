const axios = require('axios');
const helperFunctions = require('./helpers');

class RefreshRepoTask {
    constructor(inRepo, inRepoDetails, inIssueDetails, inGHToken) {
        this.pageNum = 1;
        this.repoUrl = inRepo.url;
        this.repoIssuesUrl = inRepo.url;
        this.shortRepoUrl = inRepo.shortURL;
        this.dataRepositoryUrl = 'https://api.github.com/repos/' + inRepo.shortURL.toLowerCase();
        this.perPageResults = 100;
        this.RepoDetails = inRepoDetails;
        this.IssueDetails = inIssueDetails;
        this.lastUpdatedTime = null;
        this.lastSeenItemUpdatedAt = null;
        this.firstSeenUpdatedAt = null;
        this.repoDocument = inRepo;

        this.isFinished = false;
    }

    async getNewRepoPage(inBulkWriteList) {

        if (this.repoDocument == null) {
            return true;
        }

        if (this.isFinished) {
            return true;
        }

        if (this.pageNum == 1) {
            this.lastUpdatedTime = this.repoDocument.lastUpdatedAt;
            this.repoDocument.updating = true;
            await this.repoDocument.save();
        }

        console.log("Making " + this.shortRepoUrl + " page num: ", this.pageNum);
        var response = await this.makeRequest(this.pageNum);

        if (response.status == 200) {
            this.pageNum = this.pageNum + 1;
            // If no issues are reported then we are done
            if (response.data.length == 0) {
                this.isFinished = true;
                this.repoDocument.lastUpdatedAt = this.firstSeenUpdatedAt;
                this.repoDocument.updating = false;
                await this.repoDocument.save();
                console.log("Update Request Complete - " + this.shortRepoUrl + " - No more issues");
                return true;
            } else {
                var dbSaveResult = await this.storeInArray(response.data, inBulkWriteList);
                // If up to date after saving we are done
                if (dbSaveResult == 'uptodate') {
                    this.isFinished = true;
                    this.repoDocument.lastUpdatedAt = this.firstSeenUpdatedAt;
                    this.repoDocument.updating = false;
                    await this.repoDocument.save();
                    console.log("Update Request Complete -  " + this.shortRepoUrl + " - Up to date");
                    return true;
                } else {
                    // Return false, need to keep going
                    return false;
                }
            }
        } else if (response.status == 403) {
            var responseUnixTime = response.headers['x-ratelimit-reset'];
            var currentTime = Math.floor(+new Date() / 1000);
            var retryTime = new Date(Number(responseUnixTime) * 1000);
            var retryDifference = responseUnixTime - currentTime;
            console.log("Rate limited waiting until: ", retryTime);
            await helperFunctions.PromiseTimeout(retryDifference * 1000);
            return this.getNewRepoPage(inBulkWriteList);
        } else {
            console.log("Saw unexpected response");
            this.repoDocument.updating = false;
            await this.repoDocument.save();
            return true;
        }
    }

    async makeRequest(pageNum) {
        try {
            let response = null;
            if (this.ghToken) {
                response = await axios.get(this.repoIssuesUrl, {
                    headers: {
                        "Authorization": "token " + this.ghToken,
                    },
                    params: {
                        page: pageNum, per_page: this.perPageResults,
                        sort: 'updated', state: 'all', type: 'issue'
                    }
                });
            } else {
                response = await axios.get(this.repoIssuesUrl, {
                    params: {
                        page: pageNum, per_page: this.perPageResults,
                        sort: 'updated', state: 'all', type: 'issue'
                    }
                });
            }
            return response;
        } catch (error) {
            return error.response;
        }
    }

    async storeInArray(data, inBulkWriteList) {
        var response = 'success';

        // await Promise.all(data.map(async (responseItem) => {
        for (let i = 0; i < data.length; i++) {
            let responseItem = data[i];
            if (responseItem.pull_request == null) {
                var updatedAtDate = new Date(responseItem['updated_at']);
                this.lastSeenItemUpdatedAt = updatedAtDate;

                if (this.firstSeenUpdatedAt == null) {
                    this.firstSeenUpdatedAt = updatedAtDate;
                }

                if (updatedAtDate > this.lastUpdatedTime) {
                    // TODO: Update the issue and store it in the database
                    console.log("Updating: ", this.shortRepoUrl, " : ", responseItem.number);
                    // Turn the datarepositoryURL to all lower case
                    responseItem.repository_url = responseItem.repository_url.toLowerCase();
                    let bulkRequestData = null;
                    bulkRequestData = {
                        updateOne: {
                            filter: { 'data.repository_url': this.dataRepositoryUrl, 'data.number': responseItem.number },
                            update: { data: responseItem },
                            upsert: true,
                        }
                    };
                    inBulkWriteList.push(bulkRequestData);
                } else {
                    response = 'uptodate';
                }
            }
        }

        return response;
    }

}

class RefreshRepoHandler {
    constructor(inRepoDetails, inIssueDetails, inGHToken) {
        this.RepoDetails = inRepoDetails;
        this.IssueDetails = inIssueDetails;
        this.ghToken = inGHToken;

        this.maxBulkWriteCount = 100; // This is trigger limit, absolute limit is maxBulkWriteCount + perPageResults
        this.bulkWriteDelayTimeout = 5000;
        this.lastBulkModifyTime = new Date();
        this.bulkWriteData = [];

        this.inputRefreshRepoList = [];
        this.repoRefreshList = [];
        this.refreshingRepos = false;
    }

    addRepoForRefresh(inRepo) {
        let inputIndex = this.inputRefreshRepoList.findIndex((element, index) => { if (element.repoDocument._id.toString() == inRepo._id.toString()) { return true } });
        let refreshRepoIndex = this.repoRefreshList.findIndex((element, index) => { if (element.repoDocument._id.toString() == inRepo._id.toString()) { return true } });

        if (inputIndex != -1 || refreshRepoIndex != -1) {
            return true;
        }

        let newRefreshRepoTask = new RefreshRepoTask(inRepo, this.RepoDetails, this.IssueDetails, this.ghToken);
        this.inputRefreshRepoList.push(newRefreshRepoTask);
        return true;
    }

    async startRefreshingRepos() {
        if (!this.refreshingRepos) {
            this.refreshingRepos = true;
            this.repoRefreshList = this.inputRefreshRepoList;
            let loopRefreshRepoList = this.repoRefreshList;
            this.inputRefreshRepoList = [];

            while (loopRefreshRepoList.length > 0) {
                for (let i = 0; i < loopRefreshRepoList.length; i++) {
                    let result = await loopRefreshRepoList[i].getNewRepoPage(this.bulkWriteData);
                    if (this.bulkWriteData.length >= this.maxBulkWriteCount) {
                        await this.bulkWriteDataRequest();
                    }
                }

                // Remove done repos
                loopRefreshRepoList = loopRefreshRepoList.filter(refreshTask => !refreshTask.isFinished);

                // Add in added repos
                for (let i = 0; i < this.inputRefreshRepoList.length; i++) {
                    loopRefreshRepoList.push(this.inputRefreshRepoList[i]);
                    this.repoRefreshList.push(this.inputRefreshRepoList[i]);
                }
                // Clear input list
                this.inputRefreshRepoList = [];
            }

            // Push any buffer remaining
            await this.bulkWriteDataRequest();

            this.refreshingRepos = false;
        }
    }

    async bulkWriteDataRequest() {
        let result = null;
        if (this.bulkWriteData.length > 0) {
            let bulkWriteDataCopy = this.bulkWriteData;
            this.bulkWriteData = [];
            console.log("Starting bulk Write request insert request");
            for (let i = 0; i < bulkWriteDataCopy.length; i++) {
                let updateResult = await this.IssueDetails.updateOne(bulkWriteDataCopy[i].updateOne.filter, bulkWriteDataCopy[i].updateOne.update, { upsert: true });
            }
            result = true;
        }
        return result;
    }
}

module.exports = RefreshRepoHandler;