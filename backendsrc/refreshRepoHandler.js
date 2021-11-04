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
        this.maxUpdatedTime = null;
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
        if (!this.isFinished) {
            this.isFinished = true;
            this.repoDocument.lastUpdatedAt = this.maxUpdatedTime;
            await this.repoDocument.save();
        }
    }

    async getNewRepoPage(inBulkWriteList, inPageNum) {

        if (this.repoDocument == null) {
            return true;
        }

        if (this.isFinished) {
            return true;
        }

        let pageNum = inPageNum;

        if (inPageNum == null) {
            pageNum = this.pageNum;
        }

        console.log("Making " + this.shortRepoUrl + " page num: ", this.pageNum);
        this.pageNum = this.pageNum + 1;
        var response = await this.makeRequest(pageNum);

        if (response.status == 200) {
            // If no issues are reported then we are done
            if (response.data.length == 0) {
                console.log("Update Request Complete - " + this.shortRepoUrl + " - No more issues");
                return true;
            } else {
                var dbSaveResult = await this.storeInArray(response.data, inBulkWriteList);
                // If up to date after saving we are done
                if (dbSaveResult == 'uptodate') {
                    console.log("Update Request Complete -  " + this.shortRepoUrl + " - Up to date");
                    return true;
                } else {
                    // Return false, need to keep going
                    return false;
                }
            }
        } else if (response.status == 403) {
            var responseUnixTime = response.headers['x-ratelimit-reset'];
            if (!responseUnixTime) {
                responseUnixTime = Math.floor(+new Date() / 1000) + 60;
            }
            var currentTime = Math.floor(+new Date() / 1000);
            var retryTime = new Date(Number(responseUnixTime) * 1000);
            var retryDifference = responseUnixTime - currentTime;
            console.log("Rate limited waiting until: ", retryTime);
            await helperFunctions.PromiseTimeout(retryDifference * 1000);
            return this.getNewRepoPage(inBulkWriteList, pageNum);
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

                if (this.maxUpdatedTime != null) {
                    if (updatedAtDate > this.maxUpdatedTime) {
                        this.maxUpdatedTime = updatedAtDate;
                    }
                } else {
                    this.maxUpdatedTime = updatedAtDate;
                }

                if (this.lastUpdatedTime == null || updatedAtDate > this.lastUpdatedTime) {
                    // console.log("Updating: ", this.shortRepoUrl, " : ", responseItem.number);
                    // Turn the datarepositoryURL to all lower case
                    responseItem.repository_url = responseItem.repository_url.toLowerCase();

                    let mentionsArray = helperFunctions.GetMentions(responseItem.body);

                    let bulkRequestData = null;
                    bulkRequestData = {
                        updateOne: {
                            filter: { 'data.repository_url': this.dataRepositoryUrl, 'data.number': responseItem.number },
                            update: { data: responseItem, repoRef: this.repoDocument._id, '$addToSet': { userCommentsList: responseItem.user.login } },
                            upsert: true,
                        }
                    };

                    bulkRequestData.mentionsArray = mentionsArray;

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
        // this.repoDocument.updating = true;
        // await this.repoDocument.save();
    }

    async endRepoUpdating() {
        if (!this.isFinished) {
            this.isFinished = true;
            this.repoDocument.lastUpdatedCommentsAt = this.maxUpdatedTime;
            this.repoDocument.updating = false;
            await this.repoDocument.save();
        }
    }

    async getNewRepoPage(inBulkWriteList, inPageNum) {

        if (this.repoDocument == null) {
            return true;
        }

        if (this.isFinished) {
            return true;
        }

        let pageNum = inPageNum;

        if (inPageNum == null) {
            pageNum = this.pageNum;
        }

        console.log("Making comments " + this.shortRepoUrl + " page num: ", this.pageNum);
        this.pageNum = this.pageNum + 1;
        var response = await this.makeRequest(pageNum);

        if (response.status == 200) {
            // If no issues are reported then we are done
            if (response.data.length == 0) {
                console.log("Update Request Complete - " + this.shortRepoUrl + " - No more issues");
                return true;
            } else {
                var dbSaveResult = await this.storeInArray(response.data, inBulkWriteList);
                // If up to date after saving we are done
                if (dbSaveResult == 'uptodate') {
                    console.log("Update Request Complete -  " + this.shortRepoUrl + " - Up to date");
                    return true;
                } else {
                    // Return false, need to keep going
                    return false;
                }
            }
        } else if (response.status == 403) {
            var responseUnixTime = response.headers['x-ratelimit-reset'];
            if (!responseUnixTime) {
                responseUnixTime = Math.floor(+new Date() / 1000) + 60;
            }
            var currentTime = Math.floor(+new Date() / 1000);
            var retryTime = new Date(Number(responseUnixTime) * 1000);
            var retryDifference = responseUnixTime - currentTime;
            console.log("Rate limited waiting until: ", retryTime);
            await helperFunctions.PromiseTimeout(retryDifference * 1000);
            return this.getNewRepoPage(inBulkWriteList, pageNum);
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

        await Promise.all(data.map(async (responseItem) => {
            // for (let i = 0; i < data.length; i++) {
            //     let responseItem = data[i];

            if (!responseItem.html_url.includes('/pull/')) {
                var updatedAtDate = new Date(responseItem['updated_at']);
                this.lastSeenItemUpdatedAt = updatedAtDate;

                if (this.maxUpdatedTime != null) {
                    if (updatedAtDate > this.maxUpdatedTime) {
                        this.maxUpdatedTime = updatedAtDate;
                    }
                } else {
                    this.maxUpdatedTime = updatedAtDate;
                }

                if (this.lastUpdatedTime == null || updatedAtDate > this.lastUpdatedTime) {
                    // TODO: Update the comment and store it in the database
                    let issueURLArray = responseItem.issue_url.split('/');
                    let issueNumber = issueURLArray[issueURLArray.length - 1];
                    // console.log("Updating comment for: ", this.shortRepoUrl, " : ", issueNumber);

                    // Get parent issue ID
                    let parentIssueFilter = { 'data.repository_url': this.dataRepositoryUrl, 'data.number': issueNumber };
                    let parentIssue = await this.IssueDetails.findOne(parentIssueFilter, { projection: { _id: 1 } });

                    let mentionsArray = helperFunctions.GetMentions(responseItem.body);

                    let bulkRequestData = {};
                    bulkRequestData.commentUpdate = {
                        updateOne: {
                            filter: { 'repositoryID': this.repoDocument._id.toString(), 'data.id': responseItem.id },
                            update: {
                                data: responseItem, repositoryID: this.repoDocument._id.toString(),
                                issueRef: parentIssue._id, repoRef: this.repoDocument._id, mentionStrings: mentionsArray
                            },
                            upsert: true,
                        }
                    };

                    bulkRequestData.mentionsArray = mentionsArray;
                    bulkRequestData.issueID = parentIssue._id;

                    inBulkWriteList.push(bulkRequestData);
                } else {
                    response = 'uptodate';
                }
            }
            // dangling } reminder if you want to go back to the for statement instead }
        }));

        return response;
    }


}

class RefreshRepoHandler {
    constructor(inRepoDetails, inIssueDetails, inIssueCommentDetails, inUserDetails, inIssueCommentMentionDetails, inGHToken) {
        this.RepoDetails = inRepoDetails;
        this.IssueDetails = inIssueDetails;
        this.IssueCommentDetails = inIssueCommentDetails;
        this.IssueCommentMentionDetails = inIssueCommentMentionDetails;
        this.UserDetails = inUserDetails;
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

        this.simultaneousMessages = 10;
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

        if (inputCommentIndex == -1 && refreshRepoCommentIndex == -1) {
            let newRefreshRepoCommentsTask = new RefreshRepoCommentsTask(inRepo, this.RepoDetails, this.IssueDetails, this.ghToken);
            this.inputRefreshRepoCommentsList.push(newRefreshRepoCommentsTask);
        }

        return true;
    }

    async moveInputReposToProcessing(loopRefreshRepoList, loopRefreshRepoCommentsList) {
        // Add in added repos
        for (let i = 0; i < this.inputRefreshRepoList.length; i++) {
            loopRefreshRepoList.push(this.inputRefreshRepoList[i]);
            this.repoRefreshList.push(this.inputRefreshRepoList[i]);
            await this.inputRefreshRepoList[i].setRepoToUpdating();
        }

        for (let i = 0; i < this.inputRefreshRepoCommentsList.length; i++) {
            loopRefreshRepoCommentsList.push(this.inputRefreshRepoCommentsList[i]);
            this.repoRefreshCommentsList.push(this.inputRefreshRepoCommentsList[i]);
            await this.inputRefreshRepoCommentsList[i].setRepoToUpdating();
        }

        // Clear input list
        this.inputRefreshRepoList = [];
        this.inputRefreshRepoCommentsList = [];

    }

    async startRefreshingRepos() {
        if (!this.refreshingRepos) {
            this.refreshingRepos = true;

            let loopRefreshRepoList = []
            let loopRefreshRepoCommentsList = [];

            await this.moveInputReposToProcessing(loopRefreshRepoList, loopRefreshRepoCommentsList);

            while (loopRefreshRepoList.length > 0 || loopRefreshRepoCommentsList.length > 0) {
                for (let i = 0; i < loopRefreshRepoList.length; i++) {
                    let refreshResultPromiseArray = [];
                    for (let j = 0; j < this.simultaneousMessages; j++) {
                        refreshResultPromiseArray.push(loopRefreshRepoList[i].getNewRepoPage(this.bulkWriteData, null));
                    }
                    let promiseResults = await Promise.all(refreshResultPromiseArray);

                    for (let j = 0; j < this.simultaneousMessages; j++) {
                        if (promiseResults[j]) {
                            await loopRefreshRepoList[i].endRepoUpdating();
                        }
                    }

                    if (this.bulkWriteData.length >= this.maxBulkWriteCount) {
                        await this.bulkWriteDataRequest();
                    }
                }

                if (loopRefreshRepoList.length == 0) {
                    // TODO: Find more efficient way to query this besides checking each time
                    await this.bulkWriteDataRequest();
                    for (let i = 0; i < loopRefreshRepoCommentsList.length; i++) {
                        let refreshResultPromiseArray = [];
                        for (let j = 0; j < this.simultaneousMessages; j++) {
                            refreshResultPromiseArray.push(loopRefreshRepoCommentsList[i].getNewRepoPage(this.bulkWriteCommentData, null));
                        }
                        let promiseResults = await Promise.all(refreshResultPromiseArray);

                        for (let j = 0; j < this.simultaneousMessages; j++) {
                            if (promiseResults[j]) {
                                await loopRefreshRepoCommentsList[i].endRepoUpdating();
                            }
                        }

                        if (this.bulkWriteCommentData.length >= this.maxBulkWriteCount) {
                            await this.bulkWriteDataCommentRequest();
                        }
                    }
                }

                // Remove done repos
                loopRefreshRepoList = loopRefreshRepoList.filter(refreshTask => !refreshTask.isFinished);
                loopRefreshRepoCommentsList = loopRefreshRepoCommentsList.filter(refreshTask => !refreshTask.isFinished);

                this.repoRefreshList = this.repoRefreshList.filter(refreshTask => !refreshTask.isFinished);
                this.repoRefreshCommentsList = this.repoRefreshCommentsList.filter(refreshTask => !refreshTask.isFinished);

                await this.moveInputReposToProcessing(loopRefreshRepoList, loopRefreshRepoCommentsList);
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
            await Promise.all(bulkWriteDataCopy.map(async (bulkWriteDataItem) => {

                let mentionsArray = bulkWriteDataItem.mentionsArray;
                let updateResult = await this.IssueDetails.findOneAndUpdate(bulkWriteDataItem.updateOne.filter, bulkWriteDataItem.updateOne.update, { returnDocument: 'after', upsert: true });

                let issueURL = "https://github.com/" + updateResult.data.url.split("https://api.github.com/repos/").pop();

                if (mentionsArray) {
                    // For each name in the mention array, attempt to create a mention
                    for (let i = 0; i < mentionsArray.length; i++) {
                        let mentionItem = mentionsArray[i];
                        let mentionedUser = await this.UserDetails.findOne({ 'githubUsername': mentionItem });
                        if (mentionedUser) {
                            let mentionResult = await this.IssueCommentMentionDetails.create({
                                'commentRef': null, 'userRef': mentionedUser._id, 'issueRef': updateResult._id,
                                mentionedAt: updateResult.data.updated_at, repoRef: updateResult.repoRef, html_url: issueURL, mentionAuthor: updateResult.data.user.login,
                            });
                        }
                    }
                }
            }));
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
            await Promise.all(bulkWriteDataCopy.map(async (bulkWriteDataItem) => {
                let commentUpdate = bulkWriteDataItem.commentUpdate;
                let issueUpdate = bulkWriteDataItem.issueUpdate;
                let mentionsArray = bulkWriteDataItem.mentionsArray;
                // Update Comment
                let updateResult = await this.IssueCommentDetails.findOneAndUpdate(commentUpdate.updateOne.filter, commentUpdate.updateOne.update, { returnDocument: 'after', upsert: true });

                if (mentionsArray) {
                    // For each name in the mention array, attempt to create a mention
                    for (let i = 0; i < mentionsArray.length; i++) {
                        let mentionItem = mentionsArray[i];
                        let mentionedUser = await this.UserDetails.findOne({ 'githubUsername': mentionItem });
                        if (mentionedUser) {
                            let mentionResult = await this.IssueCommentMentionDetails.create({
                                'commentRef': updateResult._id, 'userRef': mentionedUser._id, 'issueRef': bulkWriteDataItem.issueID,
                                mentionedAt: updateResult.data.updated_at, repoRef: updateResult.repoRef, html_url: updateResult.data.html_url, mentionAuthor: updateResult.data.user.login,
                            });
                        }
                    }
                }
            }));


            result = true;
        }
        return result;
    }
}

module.exports = RefreshRepoHandler;