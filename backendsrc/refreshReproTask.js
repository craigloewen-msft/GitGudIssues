const axios = require('axios')

class RefreshRepoTask {
    constructor(inputUrl, inRepoDetails, inIssueDetails) {
        this.pageNum = 1;
        this.repoUrl = 'https://api.github.com/repos/' + inputUrl + '/issues';
        this.shortRepoUrl = inputUrl;
        this.longRepoUrl = 'https://api.github.com/repos/' + inputUrl;
        this.perPageResults = 100;
        this.RepoDetails = inRepoDetails;
        this.IssueDetails = inIssueDetails;
        this.lastUpdatedTime = null;
        this.lastSeenItemUpdatedAt = null;
        this.firstSeenUpdatedAt = null;
        this.repoDocument = null;
    }

    PromiseTimeout(delayms) {
        return new Promise(function (resolve, reject) {
            setTimeout(resolve, delayms);
        });
    }

    async refreshData() {
        var finishedRequest = false;

        var repoItems = await this.RepoDetails.find({ url: this.repoUrl })

        if (repoItems.length == 0) {
            repoItems = [await this.RepoDetails.create({ url: this.repoUrl, lastUpdatedAt: new Date('1/1/1900'), updating: true })]
        }

        this.repoDocument = repoItems[0];
        this.lastUpdatedTime = this.repoDocument.lastUpdatedAt;

        this.repoDocument.updating = true;
        await this.repoDocument.save();

        while (!finishedRequest) {
            console.log("Making request page num: ", this.pageNum);
            var response = await this.makeRequest(this.pageNum);

            if (response.status == 200) {
                // If no issues are reported then we are done
                if (response.data.length == 0) {
                    finishedRequest = true;
                    this.repoDocument.lastUpdatedAt = this.firstSeenUpdatedAt;
                    this.repoDocument.updating = false;
                    await this.repoDocument.save();
                    console.log("Update Request Complete - No more issues");
                } else {
                    var dbSaveResult = await this.storeInDataBase(response.data);
                    if (dbSaveResult == 'uptodate') {
                        finishedRequest = true;
                        this.repoDocument.lastUpdatedAt = this.firstSeenUpdatedAt;
                        this.repoDocument.updating = false;
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
                await this.PromiseTimeout(retryDifference * 1000);
            }

            this.pageNum = this.pageNum + 1;
        }
    }

    async makeRequest(pageNum) {
        try {
            const response = await axios.get(this.repoUrl, {
                params: {
                    page: pageNum, per_page: this.perPageResults,
                    sort: 'updated', state: 'all', type: 'issue'
                }
            });
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
                    // TODO: Update the issue and store it in the database
                    console.log("Updating: ", responseItem.number);
                    var issueToSave = (await this.IssueDetails.find({ 'data.number': responseItem.number, 'data.repository_url': this.longRepoUrl }))[0];
                    if (issueToSave == null) {
                        issueToSave = await this.IssueDetails.create({});
                    }
                    issueToSave.data = responseItem;
                    await issueToSave.save();
                } else {
                    response = 'uptodate';
                }
            }
        }));

        return response;
    }

}

module.exports = RefreshRepoTask;