const axios = require('axios');
const helperFunctions = require('./helpers');

class RefreshRepoTask {
    constructor(inRepo, inRepoDetails, inIssueDetails, inGHToken, inRequestThrottler) {
        this.pageNum = 1;
        this.repoUrl = inRepo.url;
        this.repoIssuesUrl = inRepo.url;
        this.shortRepoUrl = inRepo.shortURL;
        this.dataRepositoryUrl = 'https://api.github.com/repos/' + inRepo.shortURL;
        this.perPageResults = 100;
        this.RepoDetails = inRepoDetails;
        this.IssueDetails = inIssueDetails;
        this.lastUpdatedTime = null;
        this.lastSeenItemUpdatedAt = null;
        this.firstSeenUpdatedAt = null;
        this.repoDocument = inRepo;
        this.ghToken = inGHToken;
        this.requestThrottler = inRequestThrottler;

        this.issueDataListMax = 10;
        if (process.env.NODE_ENV == "production") {
            this.issueDataListTimeout = 10000;
        } else {
            this.issueDataListTimeout = 5000;
        }
        this.issueDataListToInsert = [];
        this.bulkInsertIssuesPromise = null;
        this.lastBulkInsertTime = new Date();
    }

    async refreshData() {

        if (this.repoDocument == null) {
            return;
        }

        if (this.repoDocument.updating) {
            return;
        }

        var finishedRequest = false;
        this.lastUpdatedTime = this.repoDocument.lastUpdatedAt;
        this.repoDocument.updating = true;
        await this.repoDocument.save();

        while (!finishedRequest) {
            console.log("Making " + this.shortRepoUrl + " page num: ", this.pageNum);
            var response = await this.makeRequest(this.pageNum);

            if (response.status == 200) {
                // If no issues are reported then we are done
                if (response.data.length == 0) {
                    finishedRequest = true;
                    this.repoDocument.lastUpdatedAt = this.firstSeenUpdatedAt;
                    this.repoDocument.updating = false;
                    await this.repoDocument.save();
                    console.log("Update Request Complete - " + this.shortRepoUrl + " - No more issues");
                } else {
                    var dbSaveResult = await this.storeInDataBase(response.data);
                    if (dbSaveResult == 'uptodate') {
                        finishedRequest = true;
                        this.repoDocument.lastUpdatedAt = this.firstSeenUpdatedAt;
                        this.repoDocument.updating = false;
                        await this.repoDocument.save();
                        console.log("Update Request Complete -  " + this.shortRepoUrl + " - Up to date");
                    }
                }
            } else if (response.status == 403) {
                var responseUnixTime = response.headers['x-ratelimit-reset'];
                var currentTime = Math.floor(+new Date() / 1000);
                var retryTime = new Date(Number(responseUnixTime) * 1000);
                var retryDifference = responseUnixTime - currentTime;
                console.log("Rate limited waiting until: ", retryTime);
                await this.helperFunctions.PromiseTimeout(retryDifference * 1000);
            } else {
                console.log("Saw unexpected response");
                this.repoDocument.updating = false;
                await this.repoDocument.save();
                return;
            }

            this.pageNum = this.pageNum + 1;
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

    async storeInDataBase(data) {
        var response = 'success';

        await Promise.all(data.map(async (responseItem) => {
            if (responseItem.pull_request == null) {
                var updatedAtDate = new Date(responseItem['updated_at']);
                this.lastSeenItemUpdatedAt = updatedAtDate;

                if (this.firstSeenUpdatedAt == null) {
                    this.firstSeenUpdatedAt = updatedAtDate;
                }

                if (updatedAtDate > this.lastUpdatedTime) {
                    await this.requestThrottler.requestToPost();
                    console.log("Updating: ", this.shortRepoUrl, " : ", responseItem.number);
                    var issueToSave = (await this.IssueDetails.updateOne({ 'data.number': responseItem.number, 'data.repository_url': { "$regex": this.dataRepositoryUrl, "$options": "gi" } }, { 'data': responseItem }));
                    if (issueToSave.modifiedCount == 0) {
                        this.addIssueToBulkInsert({ 'data': responseItem });
                    }
                } else {
                    response = 'uptodate';
                }
            }
        }));

        return response;
    }

    async addIssueToBulkInsert(inIssueData) {
        this.issueDataListToInsert.push(inIssueData);

        if (this.issueDataListToInsert.length >= this.issueDataListMax) {
            this.lastBulkInsertTime = new Date();
            return await this.bulkInsertIssues();
        }

        this.bulkInsertIssuesPromise = this.bulkInsertAfterDelay(this.nullifyBulkInsertCheck);
    }

    async bulkInsertAfterDelay(checkObject) {
        await helperFunctions.PromiseTimeout(this.issueDataListTimeout);
        let result = null;
        let timeFromLastInsert = new Date() - this.lastBulkInsertTime;
        if (timeFromLastInsert > this.issueDataListTimeout) {
            result = this.bulkInsertIssues();
        }
        this.bulkInsertIssuesPromise = null;
        return result;
    }

    async bulkInsertIssues() {
        if (this.issueDataListToInsert.length > 0) {
            console.log("Inserting: ", this.issueDataListToInsert.length, " issues into database");
            let inIssueCopy = this.issueDataListToInsert;
            this.issueDataListToInsert = [];
            let result = await this.IssueDetails.insertMany(inIssueCopy, { ordered: false });
            return result;
        } else {
            return null;
        }
    }

}

module.exports = RefreshRepoTask;