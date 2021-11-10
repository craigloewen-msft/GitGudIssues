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

        this.maxUpdatedTime = new Date('1/1/1900');
        this.minUpdatedTime = new Date();
        this.repoDocument = inRepo;

        this.isFinished = false;
        this.isUpdating = false;

        this.hasSavedStartDate = false;

        this.ghToken = inGHToken;
    }

    async setRepoToUpdating() {
        if (!this.isUpdating) {
            this.isUpdating = true;
            if (!this.repoDocument.issuesUpdating) {
                this.repoDocument.lastIssuesUpdateStart = new Date();
                this.repoDocument.lastIssuesUpdateProgress = new Date();
                this.repoDocument.issuesUpdating = true;
                await this.repoDocument.save();
            }
        }
    }

    async endRepoUpdating() {
        if (!this.isFinished) {
            this.isUpdating = false;
            this.isFinished = true;
            this.repoDocument.issuesUpdating = false;
            let newCompleteDate = null;
            if (this.maxUpdatedTime > this.repoDocument.lastIssuesUpdateStart) {
                newCompleteDate = this.maxUpdatedTime;
            } else {
                newCompleteDate = this.repoDocument.lastIssuesUpdateStart;
            }
            this.repoDocument.lastIssuesCompleteUpdate = newCompleteDate;
            await this.repoDocument.save();
        }
    }

    async saveProgress() {
        // Detect when crossed over and already updating issues and then save progress

        if (!this.hasSavedStartDate) {
            if (this.minUpdatedTime < this.repoDocument.lastIssuesUpdateStart) {
                this.hasSavedStartDate = true;
                this.repoDocument.lastIssuesUpdateStart = this.maxUpdatedTime;
                await this.repoDocument.save();
            }
        }

        if (this.minUpdatedTime < this.repoDocument.lastIssuesUpdateProgress) {
            this.repoDocument.lastIssuesUpdateProgress = this.minUpdatedTime;
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
            pageNum = Number(this.pageNum);
            this.pageNum = this.pageNum + 1;
        }

        console.log("Making " + this.shortRepoUrl + " page num: ", pageNum);
        var response = await this.makeRequest(pageNum);

        if (response == null) {
            return this.getNewRepoPage(inBulkWriteList, pageNum);
        } else if (response.status == 200) {
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
        } else if (response.status == 502) {
            return this.getNewRepoPage(inBulkWriteList, pageNum);
        } else if (response.status == 422) {
            console.log("Update request completed through pagination limit - " + this.shortRepoUrl);
            return true;
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

                if (updatedAtDate > this.maxUpdatedTime) {
                    this.maxUpdatedTime = updatedAtDate;
                }

                if (updatedAtDate < this.minUpdatedTime) {
                    this.minUpdatedTime = updatedAtDate;
                }

                let updateIssueCheck = false;

                if (updatedAtDate > this.repoDocument.lastIssuesUpdateStart) {
                    updateIssueCheck = true;
                }

                if (updatedAtDate < this.repoDocument.lastIssuesUpdateProgress && updatedAtDate > this.repoDocument.lastIssuesCompleteUpdate) {
                    updateIssueCheck = true;
                }

                if (updateIssueCheck) {
                    // console.log("Updating: ", this.shortRepoUrl, " : ", responseItem.number);
                    // Turn the datarepositoryURL to all lower case
                    responseItem.repository_url = responseItem.repository_url.toLowerCase();

                    let mentionsArray = helperFunctions.GetMentions(responseItem.body);

                    let updateObject = { repoRef: this.repoDocument._id, '$addToSet': { userCommentsList: responseItem.user.login } };

                    helperFunctions.CopyAllKeys(updateObject, responseItem);

                    let bulkRequestData = null;
                    bulkRequestData = {
                        updateOne: {
                            filter: { 'repository_url': this.dataRepositoryUrl, 'number': responseItem.number },
                            update: updateObject,
                            upsert: true,
                        }
                    };

                    bulkRequestData.mentionsArray = mentionsArray;

                    inBulkWriteList.push(bulkRequestData);
                } else {
                    // Check if we're done
                    if (updatedAtDate < this.repoDocument.lastIssuesCompleteUpdate) {
                        response = 'uptodate';
                    }
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
        if (!this.isUpdating) {
            this.isUpdating = true;
            if (!this.repoDocument.commentsUpdating) {
                this.repoDocument.lastCommentsUpdateStart = new Date();
                this.repoDocument.lastCommentsUpdateProgress = new Date();
                this.repoDocument.commentsUpdating = true;
                await this.repoDocument.save();
            }
        }
    }

    async endRepoUpdating() {
        if (!this.isFinished) {
            this.isUpdating = false;
            this.isFinished = true;
            this.repoDocument.commentsUpdating = false;
            let newCompleteDate = null;
            if (this.maxUpdatedTime > this.repoDocument.lastCommentsUpdateStart) {
                newCompleteDate = this.maxUpdatedTime;
            } else {
                newCompleteDate = this.repoDocument.lastCommentsUpdateStart;
            }
            this.repoDocument.lastCommentsCompleteUpdate = newCompleteDate;
            await this.repoDocument.save();
        }
    }

    async saveProgress() {
        // Detect when crossed over and already updating issues and then save progress

        if (!this.hasSavedStartDate) {
            if (this.minUpdatedTime < this.repoDocument.lastCommentsUpdateStart) {
                this.hasSavedStartDate = true;
                this.repoDocument.lastCommentsUpdateStart = this.maxUpdatedTime;
                await this.repoDocument.save();
            }
        }

        if (this.minUpdatedTime < this.repoDocument.lastCommentsUpdateProgress) {
            this.repoDocument.lastCommentsUpdateProgress = this.minUpdatedTime;
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
            pageNum = Number(this.pageNum);
            this.pageNum = this.pageNum + 1;
        }

        console.log("Making comments " + this.shortRepoUrl + " page num: ", pageNum);
        var response = await this.makeRequest(pageNum);

        if (response == null) {
            return this.getNewRepoPage(inBulkWriteList, pageNum);
        } else if (response.status == 200) {
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
        } else if (response.status == 502) {
            return this.getNewRepoPage(inBulkWriteList, pageNum);
        } else if (response.status == 422) {
            console.log("Update request completed through pagination limit - " + this.shortRepoUrl);
            return true;
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

                if (updatedAtDate < this.minUpdatedTime) {
                    this.minUpdatedTime = updatedAtDate;
                }

                let updateCommentCheck = false;

                if (updatedAtDate > this.repoDocument.lastCommentsUpdateStart) {
                    updateCommentCheck = true;
                }

                if (updatedAtDate < this.repoDocument.lastCommentsUpdateProgress && updatedAtDate > this.repoDocument.lastCommentsCompleteUpdate) {
                    updateCommentCheck = true;
                }

                if (updateCommentCheck) {
                    // TODO: Update the comment and store it in the database
                    let issueURLArray = responseItem.issue_url.split('/');
                    let issueNumber = issueURLArray[issueURLArray.length - 1];
                    // console.log("Updating comment for: ", this.shortRepoUrl, " : ", issueNumber);

                    responseItem.comment_id = responseItem.id;
                    delete responseItem.id;

                    // Get parent issue ID
                    let parentIssueFilter = { 'repository_url': this.dataRepositoryUrl, 'number': issueNumber };
                    let parentIssue = await this.IssueDetails.findOne(parentIssueFilter);
                    if (parentIssue != null) {
                        let mentionsArray = helperFunctions.GetMentions(responseItem.body);

                        let updateObject = {
                            repositoryID: this.repoDocument._id.toString(),
                            issueRef: parentIssue._id, repoRef: this.repoDocument._id, mentionStrings: mentionsArray
                        };

                        helperFunctions.CopyAllKeys(updateObject, responseItem);

                        let bulkRequestData = {};
                        bulkRequestData.commentUpdate = {
                            updateOne: {
                                filter: { 'repositoryID': this.repoDocument._id.toString(), 'comment_id': responseItem.comment_id },
                                update: updateObject,
                                upsert: true,
                            }
                        };

                        bulkRequestData.mentionsArray = mentionsArray;
                        bulkRequestData.issueID = parentIssue._id;

                        inBulkWriteList.push(bulkRequestData);
                    } else {
                        console.log("Comment couldn't find parent issue - " + this.shortRepoUrl + " - number: " + issueNumber);
                    }
                } else {
                    // Check if we're done
                    if (updatedAtDate < this.repoDocument.lastCommentsCompleteUpdate) {
                        response = 'uptodate';
                    }
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

        this.simultaneousMessages = 2;
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
                    let messageAmount = this.simultaneousMessages;

                    if (loopRefreshRepoList[i].pageNum == 1) {
                        messageAmount = 1;
                    }

                    for (let j = 0; j < messageAmount; j++) {
                        refreshResultPromiseArray.push(loopRefreshRepoList[i].getNewRepoPage(this.bulkWriteData, null));
                    }
                    let promiseResults = await Promise.all(refreshResultPromiseArray);

                    for (let j = 0; j < messageAmount; j++) {
                        if (promiseResults[j]) {
                            await loopRefreshRepoList[i].endRepoUpdating();
                        }
                    }

                    if (this.bulkWriteData.length >= this.maxBulkWriteCount) {
                        await this.bulkWriteDataRequest();
                        await loopRefreshRepoList[i].saveProgress();
                    }
                }

                if (loopRefreshRepoList.length == 0) {
                    await this.bulkWriteDataRequest();
                    for (let i = 0; i < loopRefreshRepoCommentsList.length; i++) {
                        let refreshResultPromiseArray = [];
                        let messageAmount = this.simultaneousMessages;

                        if (loopRefreshRepoCommentsList[i].pageNum == 1) {
                            messageAmount = 1;
                        }

                        for (let j = 0; j < messageAmount; j++) {
                            refreshResultPromiseArray.push(loopRefreshRepoCommentsList[i].getNewRepoPage(this.bulkWriteCommentData, null));
                        }
                        let promiseResults = await Promise.all(refreshResultPromiseArray);

                        for (let j = 0; j < messageAmount; j++) {
                            if (promiseResults[j]) {
                                await loopRefreshRepoCommentsList[i].endRepoUpdating();
                            }
                        }

                        if (this.bulkWriteCommentData.length >= this.maxBulkWriteCount) {
                            await this.bulkWriteDataCommentRequest();
                            await loopRefreshRepoCommentsList[i].saveProgress();
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

                // For each name in the mention array, attempt to create a mention
                helperFunctions.CreateMentionsFromIssueList(mentionsArray, this.IssueCommentMentionDetails, this.UserDetails, updateResult);
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

                helperFunctions.CreateMentionsFromCommentList(mentionsArray, this.IssueCommentMentionDetails, this.UserDetails, bulkWriteDataItem.issueID, updateResult);
            }));


            result = true;
        }
        return result;
    }
}

module.exports = RefreshRepoHandler;