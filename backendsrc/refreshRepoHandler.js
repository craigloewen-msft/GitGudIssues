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

        this.ghToken = inGHToken;
    }

    async setRepoToUpdating() {
        this.lastUpdatedTime = this.repoDocument.lastUpdatedAt;
        this.repoDocument.updating = true;
        await this.repoDocument.save();
    }

    async endRepoUpdating() {
        this.isFinished = true;
        this.repoDocument.lastUpdatedAt = this.firstSeenUpdatedAt;
        this.repoDocument.updating = false;
        await this.repoDocument.save();
    }

    async getNewRepoPage(inBulkWriteList) {

        if (this.repoDocument == null) {
            return true;
        }

        if (this.isFinished) {
            return true;
        }

        if (this.pageNum == 1) {
            await this.setRepoToUpdating();
        }

        console.log("Making " + this.shortRepoUrl + " page num: ", this.pageNum);
        var response = await this.makeRequest(this.pageNum);

        if (response.status == 200) {
            this.pageNum = this.pageNum + 1;
            // If no issues are reported then we are done
            if (response.data.length == 0) {
                await this.endRepoUpdating();
                console.log("Update Request Complete - " + this.shortRepoUrl + " - No more issues");
                return true;
            } else {
                var dbSaveResult = await this.storeInArray(response.data, inBulkWriteList);
                // If up to date after saving we are done
                if (dbSaveResult == 'uptodate') {
                    await this.endRepoUpdating();
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

                if (this.lastUpdatedTime == null || updatedAtDate > this.lastUpdatedTime) {
                    console.log("Updating: ", this.shortRepoUrl, " : ", responseItem.number);
                    // Turn the datarepositoryURL to all lower case
                    responseItem.repository_url = responseItem.repository_url.toLowerCase();

                    let mentionsArray = helperFunctions.GetMentions(responseItem.body);

                    let bulkRequestData = null;
                    bulkRequestData = {
                        updateOne: {
                            filter: { 'data.repository_url': this.dataRepositoryUrl, 'data.number': responseItem.number },
                            update: { data: responseItem, '$addToSet': { userCommentsList: responseItem.user.login } },
                            upsert: true,
                        }
                    };

                    if (mentionsArray != null) {
                        bulkRequestData.updateOne.update['$addToSet'].userMentionsList = { '$each': mentionsArray };
                    }

                    inBulkWriteList.push(bulkRequestData);
                } else {
                    response = 'uptodate';
                }
            }
        }

        return response;
    }

}

class RefreshRepoCommentsTask extends RefreshRepoTask {
    constructor(inRepo, inRepoDetails, inIssueDetails, inGHToken) {
        super(inRepo, inRepoDetails, inIssueDetails, inGHToken);
        this.repoIssueCommentsUrl = inRepo.url + '/comments';
    }

    async setRepoToUpdating() {
        this.lastUpdatedTime = this.repoDocument.lastUpdatedCommentsAt;
        this.repoDocument.updating = true;
        await this.repoDocument.save();
    }

    async endRepoUpdating() {
        this.isFinished = true;
        this.repoDocument.lastUpdatedCommentsAt = this.firstSeenUpdatedAt;
        this.repoDocument.updating = false;
        await this.repoDocument.save();
    }

    async getNewRepoPage(inBulkWriteList) {

        if (this.repoDocument == null) {
            return true;
        }

        if (this.isFinished) {
            return true;
        }

        if (this.pageNum == 1) {
            await this.setRepoToUpdating();
        }

        console.log("Making comments " + this.shortRepoUrl + " page num: ", this.pageNum);
        var response = await this.makeRequest(this.pageNum);

        if (response.status == 200) {
            this.pageNum = this.pageNum + 1;
            // If no issues are reported then we are done
            if (response.data.length == 0) {
                await this.endRepoUpdating();
                console.log("Update Request Complete - " + this.shortRepoUrl + " - No more issues");
                return true;
            } else {
                var dbSaveResult = await this.storeInArray(response.data, inBulkWriteList);
                // If up to date after saving we are done
                if (dbSaveResult == 'uptodate') {
                    await this.endRepoUpdating();
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

            const inputParams = {
                page: pageNum, per_page: this.perPageResults,
                sort: 'updated', direction: 'desc'
            };

            if (this.ghToken) {
                response = await axios.get(this.repoIssueCommentsUrl, {
                    headers: {
                        "Authorization": "token " + this.ghToken,
                    },
                    params: inputParams,
                });
            } else {
                response = await axios.get(this.repoIssueCommentsUrl, {
                    params: inputParams,
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

            if (!responseItem.html_url.includes('/pull/')) {
                var updatedAtDate = new Date(responseItem['updated_at']);
                this.lastSeenItemUpdatedAt = updatedAtDate;

                if (this.firstSeenUpdatedAt == null) {
                    this.firstSeenUpdatedAt = updatedAtDate;
                }

                if (this.lastUpdatedTime == null || updatedAtDate > this.lastUpdatedTime) {
                    // TODO: Update the comment and store it in the database
                    let issueURLArray = responseItem.issue_url.split('/');
                    let issueNumber = issueURLArray[issueURLArray.length - 1];
                    console.log("Updating comment for: ", this.shortRepoUrl, " : ", issueNumber);
                    // Turn the datarepositoryURL to all lower case
                    let bulkRequestData = {};
                    bulkRequestData.commentUpdate = {
                        updateOne: {
                            filter: { 'repositoryID': this.repoDocument._id.toString(), 'data.id': responseItem.id },
                            update: { data: responseItem, repositoryID: this.repoDocument._id.toString() },
                            upsert: true,
                        }
                    };

                    let mentionsArray = helperFunctions.GetMentions(responseItem.body);

                    // Add in issue update request
                    bulkRequestData.issueUpdate = {
                        updateOne: {
                            filter: { 'data.repository_url': this.dataRepositoryUrl, 'data.number': issueNumber },
                            update: { '$addToSet': { userCommentsList: responseItem.user.login } },
                        }
                    }

                    if (mentionsArray != null) {
                        bulkRequestData.issueUpdate.updateOne.update['$addToSet'].userMentionsList = { '$each': mentionsArray };
                    }

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
    constructor(inRepoDetails, inIssueDetails, inIssueCommentDetails, inGHToken) {
        this.RepoDetails = inRepoDetails;
        this.IssueDetails = inIssueDetails;
        this.IssueCommentDetails = inIssueCommentDetails;
        this.ghToken = inGHToken;

        this.maxBulkWriteCount = 100; // This is trigger limit, absolute limit is maxBulkWriteCount + perPageResults
        this.bulkWriteDelayTimeout = 5000;
        this.lastBulkModifyTime = new Date();
        this.bulkWriteData = [];
        this.bulkWriteCommentData = [];

        this.inputRefreshRepoList = [];
        this.repoRefreshList = [];

        this.inputRefreshRepoCommentsList = [];
        this.repoRefreshCommentsList = [];

        this.refreshingRepos = false;
    }

    addRepoForRefresh(inRepo) {
        // Two checks - first is if it's already in our input list, second is if it is already being processed
        let inputIndex = this.inputRefreshRepoList.findIndex((element, index) => { if (element.repoDocument._id.toString() == inRepo._id.toString()) { return true } });
        let refreshRepoIndex = this.repoRefreshList.findIndex((element, index) => { if (element.repoDocument._id.toString() == inRepo._id.toString()) { return true } });

        // Do the same two checks for comments
        let inputCommentIndex = this.inputRefreshRepoCommentsList.findIndex((element, index) => { if (element.repoDocument._id.toString() == inRepo._id.toString()) { return true } });
        let refreshRepoCommentIndex = this.repoRefreshCommentsList.findIndex((element, index) => { if (element.repoDocument._id.toString() == inRepo._id.toString()) { return true } });

        if (inputIndex == -1 && refreshRepoIndex == -1) {
            let newRefreshRepoTask = new RefreshRepoTask(inRepo, this.RepoDetails, this.IssueDetails, this.ghToken);
            this.inputRefreshRepoList.push(newRefreshRepoTask);
        }

        if (inputCommentIndex == -1 && refreshRepoIndex == -1) {
            let newRefreshRepoCommentsTask = new RefreshRepoCommentsTask(inRepo, this.RepoDetails, this.IssueDetails, this.ghToken);
            this.inputRefreshRepoCommentsList.push(newRefreshRepoCommentsTask);
        }

        return true;
    }

    async startRefreshingRepos() {
        if (!this.refreshingRepos) {
            this.refreshingRepos = true;
            this.repoRefreshList = this.inputRefreshRepoList;
            let loopRefreshRepoList = this.repoRefreshList;
            this.inputRefreshRepoList = [];

            this.repoRefreshCommentsList = this.inputRefreshRepoCommentsList;
            let loopRefreshRepoCommentsList = this.repoRefreshCommentsList;
            this.inputRefreshRepoCommentsList = [];

            while (loopRefreshRepoList.length > 0 || loopRefreshRepoCommentsList.length > 0) {
                for (let i = 0; i < loopRefreshRepoList.length; i++) {
                    let result = await loopRefreshRepoList[i].getNewRepoPage(this.bulkWriteData);
                    if (this.bulkWriteData.length >= this.maxBulkWriteCount) {
                        await this.bulkWriteDataRequest();
                    }
                }

                if (loopRefreshRepoList.length == 0) {
                    // TODO: Find more efficient way to query this besides checking each time
                    await this.bulkWriteDataRequest();
                    for (let i = 0; i < loopRefreshRepoCommentsList.length; i++) {
                        let result = await loopRefreshRepoCommentsList[i].getNewRepoPage(this.bulkWriteCommentData);
                        if (this.bulkWriteCommentData.length >= this.maxBulkWriteCount) {
                            await this.bulkWriteDataCommentRequest();
                        }
                    }
                }

                // Remove done repos
                loopRefreshRepoList = loopRefreshRepoList.filter(refreshTask => !refreshTask.isFinished);
                loopRefreshRepoCommentsList = loopRefreshRepoCommentsList.filter(refreshTask => !refreshTask.isFinished);

                // Add in added repos
                for (let i = 0; i < this.inputRefreshRepoList.length; i++) {
                    loopRefreshRepoList.push(this.inputRefreshRepoList[i]);
                    this.repoRefreshList.push(this.inputRefreshRepoList[i]);
                }

                for (let i = 0; i < this.inputRefreshRepoCommentsList.length; i++) {
                    loopRefreshRepoCommentsList.push(this.inputRefreshRepoCommentsList[i]);
                    this.repoRefreshCommentsList.push(this.inputRefreshRepoCommentsList[i]);
                }

                // Clear input list
                this.inputRefreshRepoList = [];
                this.inputRefreshRepoCommentsList = [];
            }

            // Push any buffer remaining
            await this.bulkWriteDataCommentRequest();
            await this.bulkWriteDataRequest();

            this.refreshingRepos = false;
            console.log("Finished refreshing repos!");
        }
    }

    async bulkWriteDataRequest() {
        let result = null;
        if (this.bulkWriteData.length > 0) {
            let bulkWriteDataCopy = this.bulkWriteData;
            this.bulkWriteData = [];
            console.log("Starting bulk Write request insert request - ", bulkWriteDataCopy.length);
            for (let i = 0; i < bulkWriteDataCopy.length; i++) {
                let updateResult = await this.IssueDetails.updateOne(bulkWriteDataCopy[i].updateOne.filter, bulkWriteDataCopy[i].updateOne.update, { upsert: true });
            }
            result = true;
        }
        return result;
    }

    async bulkWriteDataCommentRequest() {
        let result = null;
        if (this.bulkWriteCommentData.length > 0) {
            let bulkWriteDataCopy = this.bulkWriteCommentData;
            this.bulkWriteCommentData = [];
            console.log("Starting bulk Write comment request insert request - ", bulkWriteDataCopy.length);
            for (let i = 0; i < bulkWriteDataCopy.length; i++) {
                let commentUpdate = bulkWriteDataCopy[i].commentUpdate;
                let issueUpdate = bulkWriteDataCopy[i].issueUpdate;
                let updateResult = await this.IssueCommentDetails.updateOne(commentUpdate.updateOne.filter, commentUpdate.updateOne.update, { upsert: true });

                // If we inserted a new comment, then make sure to add it to the issues' comment list!
                if (updateResult.upsertedId != null) {
                    let inCommentID = updateResult.upsertedId._id.toString();
                    issueUpdate.updateOne.update['$addToSet'].issueCommentsArray = inCommentID;
                }

                // Update issue with comment details
                let issueUpdateResult = await this.IssueDetails.updateOne(issueUpdate.updateOne.filter, issueUpdate.updateOne.update);
                if (issueUpdateResult.matchedCount == 0 && issueUpdateResult.modifiedCount == 0) {
                    console.log("Didn't update the parent issue from comment");
                }
            }
            result = true;
        }
        return result;
    }
}

module.exports = RefreshRepoHandler;