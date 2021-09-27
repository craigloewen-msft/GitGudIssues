const RefreshRepoTask = require('./refreshReproTask')

class WebDataHandler {
    constructor(inRepoDetails, inIssueDetails, inIssueReadDetails, inUserDetails) {
        this.RepoDetails = inRepoDetails;
        this.IssueDetails = inIssueDetails;
        this.IssueReadDetails = inIssueReadDetails;
        this.UserDetails = inUserDetails;
    }

    async refreshData(inUrl) {
        var refreshTask = new RefreshRepoTask(inUrl, this.RepoDetails, this.IssueDetails);
        await refreshTask.refreshData();
    }

    async getIssues(queryData) {

        // Get User Data
        var inUser = (await this.UserDetails.find({ username: queryData.username }))[0];
        const userIssueLabelList = JSON.parse(JSON.stringify(inUser.issueLabels));

        if (inUser == null) {
            throw "User can't be found";
        }

        var userID = inUser.id.toString();

        // Start getting issue data
        var findQuery = {};
        var sortQuery = { "data.created_at": -1 };
        var limitNum = 30;
        var skipNum = 0;

        findQuery.repo = queryData.repo;

        if (queryData.per_page) {
            limitNum = queryData.per_page;
        }

        if (queryData.sort) {
            if (queryData.sort == 'updated') {
                sortQuery = { "data.updated_at": -1 }
            }
        }

        if (queryData.state) {
            if (queryData.state != "all") {
                findQuery['data.state'] = queryData.state;
            }
        }

        if (queryData.limit) {
            if (queryData.limit < 30) {
                limitNum = queryData.limit
            }
        }

        if (queryData.page_num) {
            skipNum = (parseInt(queryData.page_num) - 1) * limitNum;
        }

        if (queryData.creator) {
            findQuery['data.user.login'] = { "$regex": queryData.creator, "$options": "gi" }
        }

        if (queryData.assignee) {
            findQuery['data.assignee.login'] = { "$regex": queryData.assignee, "$options": "gi" }
        }

        if (queryData.labels) {
            var labelList = queryData.labels.split(',');
            var bugMatchObject = { 'name': { '$in': labelList } }
            findQuery['data.labels'] = { "$elemMatch": bugMatchObject };
        }

        var queryResults = await Promise.all([this.IssueDetails.count(findQuery).exec(), this.IssueDetails.find(findQuery).sort(sortQuery).skip(skipNum).limit(limitNum).exec()]);

        // Get a return array
        var returnIssueResultsArray = JSON.parse(JSON.stringify(queryResults[1]));

        // For each issue get whether it's read or unread
        var getIssueReadPromise = Promise.all(returnIssueResultsArray.map(async (issueItem) => {
            var issueReadItem = (await this.IssueReadDetails.find({ issueRef: issueItem._id, userRef: userID }))[0];
            if (issueReadItem == null) {
                issueItem.readByUser = false;
            } else if (issueReadItem.readAt >= new Date(issueItem.data.updated_at)) {
                issueItem.readByUser = true;
            } else {
                issueItem.readByUser = false;
            }
        }));

        // Get what issues have what labels for this user (can be done in parallel with above)
        var getIssueSiteLabelsPromise = Promise.all(returnIssueResultsArray.map(async (issueItem) => {
            var siteLabelsToReturn = [];

            for (const iterIssueLabel of userIssueLabelList) {
                if (iterIssueLabel.issueList.indexOf(issueItem._id) != -1) {
                    siteLabelsToReturn.push(iterIssueLabel.name);
                }
            }

            issueItem.siteLabels = siteLabelsToReturn;

        }));

        var [readResult, siteLabelResult] = await Promise.all([getIssueReadPromise, getIssueSiteLabelsPromise]);

        // Return the values
        var returnResult = { count: queryResults[0], issueData: returnIssueResultsArray };
        return returnResult;
    }

    async setIssueRead(queryData) {
        var inIssue = await this.IssueDetails.findById(queryData.issueID);
        var inUser = (await this.UserDetails.find({ username: queryData.username }))[0];

        if (inUser == null || inIssue == null) {
            return false;
        }

        var returnIssueRead = (await this.IssueReadDetails.find({ issueRef: inIssue, userRef: inUser }))[0];
        if (returnIssueRead == null) {
            returnIssueRead = await this.IssueReadDetails.create({ readAt: new Date(), issueRef: inIssue, userRef: inUser });
        } else {
            returnIssueRead.readAt = new Date();
            await returnIssueRead.save();
        }

        return true;
    }

    async setIssueUnread(queryData) {
        var inIssue = await this.IssueDetails.findById(queryData.issueID);
        var inUser = (await this.UserDetails.find({ username: queryData.username }))[0];

        if (inUser == null || inIssue == null) {
            return false;
        }

        var returnIssueRead = (await this.IssueReadDetails.find({ issueRef: inIssue, userRef: inUser }))[0];
        if (returnIssueRead == null) {
            return false;
        } else {
            await this.IssueReadDetails.deleteOne({ id: returnIssueRead.id });
        }

        return true;
    }

    async setIssueLabel(queryData) {
        var inIssue = await this.IssueDetails.findById(queryData.issueID);
        var inUser = (await this.UserDetails.find({ username: queryData.username }))[0];

        if (inUser == null || inIssue == null) {
            return false;
        }

        var issueLabel = inUser.issueLabels.find(object => object.name == queryData.inLabel);

        if (issueLabel == null) {
            issueLabel = { name: queryData.inLabel, issueList: [] };
            inUser.issueLabels.push(issueLabel);
        }

        var containsThisIssue = issueLabel.issueList.indexOf(inIssue._id);

        if (containsThisIssue == -1) {
            issueLabel.issueList.push(inIssue._id);
            await inUser.save();
        }

        return true;
    }

    async removeIssueLabel(queryData) {
        var inIssue = await this.IssueDetails.findById(queryData.issueID);
        var inUser = (await this.UserDetails.find({ username: queryData.username }))[0];

        if (inUser == null || inIssue == null) {
            return false;
        }

        var issueLabel = inUser.issueLabels.find(object => object.name == queryData.inLabel);

        if (issueLabel == null) {
            return false;
        }

        var containsThisIssue = issueLabel.issueList.indexOf(inIssue._id);

        if (containsThisIssue != -1) {
            issueLabel.issueList.splice(containsThisIssue, 1);

            if (issueLabel.issueList.length == 0) {
                var issueLabelIndex = inUser.issueLabels.indexOf(issueLabel);
                if (issueLabelIndex != -1) {
                    inUser.issueLabels.splice(issueLabelIndex, 1);
                }
            }

            await inUser.save();
        }

        return true;
    }

}

module.exports = WebDataHandler;