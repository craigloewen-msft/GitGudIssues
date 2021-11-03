const RefreshRepoHandler = require('./refreshRepoHandler')

class WebDataHandler {
    constructor(inRepoDetails, inIssueDetails, inUserDetails, inSiteIssueLabelDetails, inIssueCommentDetails, inIssueCommentMentionDetails,
        inIssueReadDetails, inGHToken) {
        this.RepoDetails = inRepoDetails;
        this.IssueDetails = inIssueDetails;
        this.UserDetails = inUserDetails;
        this.siteIssueLabelDetails = inSiteIssueLabelDetails;
        this.IssueCommentDetails = inIssueCommentDetails;
        this.IssueCommentMentionDetails = inIssueCommentMentionDetails;
        this.IssueReadDetails = inIssueReadDetails;
        this.ghToken = inGHToken;
        this.refreshRepoHandler = new RefreshRepoHandler(this.RepoDetails, this.IssueDetails, this.IssueCommentDetails, this.UserDetails, this.IssueCommentMentionDetails, this.ghToken);
    }

    isValidGithubShortURL(inString) {
        let splitStringArray = inString.split("/");

        return splitStringArray.length == 2;
    }

    async refreshData(inUsername) {
        var inUser = (await this.UserDetails.find({ username: inUsername }).populate('repos'))[0];
        for (let i = 0; i < inUser.repos.length; i++) {
            this.refreshRepoHandler.addRepoForRefresh(inUser.repos[i]);
        }
        await this.refreshRepoHandler.startRefreshingRepos();;
    }

    getQueryInputs(queryData, inUser) {
        var findQuery = {};
        var sortQuery = { "data.created_at": -1 };
        var limitNum = 10;
        var skipNum = 0;

        let userRepoList = inUser.repos;

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
            let inputLimit = parseInt(queryData.limit);
            if (inputLimit < 30) {
                limitNum = inputLimit;
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
            let andLabelList = queryData.labels.split('&');
            let labelMatchObject = [];
            for (let i = 0; i < andLabelList.length; i++) {
                let labelList = andLabelList[i].split(',');
                let regexString = "";
                for (let j = 0; j < labelList.length; j++) {
                    if (j != 0) {
                        regexString = regexString + "|";
                    }
                    regexString = regexString + labelList[j];
                }
                labelMatchObject.push({ "data.labels": { "$elemMatch": { 'name': { "$regex": regexString, "$options": "gi" } } } });
            }
            if (findQuery["$and"] == null) {
                findQuery["$and"] = [];
            }
            for (let i = 0; i < labelMatchObject.length; i++) {
                findQuery["$and"].push(labelMatchObject[i]);
            }
        }

        if (queryData.repos) {
            let repoList = queryData.repos.split(',');
            let regexString = "";
            if (repoList.length > 0) {
                regexString = regexString + "https://api.github.com/repos/" + repoList[0];
            }
            for (let i = 1; i < repoList.length; i++) {
                regexString = regexString + "|" + "https://api.github.com/repos/" + repoList[i];
            }
            findQuery['data.repository_url'] = { "$regex": regexString, "$options": "gi" };
        } else {
            let regexString = "";
            if (userRepoList.length > 0) {
                regexString = userRepoList[0].url.split('/issues')[0];
            }
            for (let i = 1; i < userRepoList.length; i++) {
                regexString = regexString + "|" + userRepoList[i].url.split('/issues')[0];
            }
            findQuery['data.repository_url'] = { "$regex": regexString, "$options": "gi" };
        }

        if (queryData.siteLabels) {
            let andLabelList = queryData.siteLabels.split('&');
            let labelMatchObject = [];
            for (let i = 0; i < andLabelList.length; i++) {
                let siteLabelList = andLabelList[i].split(',');
                let orIssueLabels = inUser.issueLabels;
                labelMatchObject.push({ "siteIssueLabels": { "$in": orIssueLabels } });
            }

            if (findQuery["$and"] == null) {
                findQuery["$and"] = [];
            }
            for (let i = 0; i < labelMatchObject.length; i++) {
                findQuery["$and"].push(labelMatchObject[i]);
            }
        }

        return [findQuery, sortQuery, limitNum, skipNum];
    }

    async setIfIssuesAreRead(inputIssueArray, inUser) {
        await Promise.all(inputIssueArray.map(async (issueItem) => {
            let issueReadItem = await this.IssueReadDetails.findOne({ issueRef: issueItem._id, userRef: inUser._id });
            if (issueReadItem == null) {
                issueItem.readByUser = false;
            } else if (new Date(issueReadItem.readAt) >= new Date(issueItem.data.updated_at)) {
                issueItem.readByUser = true;
            } else {
                issueItem.readByUser = false;
            }
        }));
    }

    setIssueLabelsForUser(inputIssueArray, inUser) {
        let userIssueLabelList = inUser.issueLabels;

        inputIssueArray.map((issueItem) => {
            var siteLabelsToReturn = [];

            for (const iterIssueLabel of userIssueLabelList) {
                if (iterIssueLabel.issueList.indexOf(issueItem._id) != -1) {
                    siteLabelsToReturn.push(iterIssueLabel.name);
                }
            }

            issueItem.siteLabels = siteLabelsToReturn;

        });
    }

    async getIssues(queryData) {

        // Get User Data
        var inUser = (await this.UserDetails.find({ username: queryData.username }).populate('issueLabels').populate('repos'))[0];

        if (inUser == null) {
            throw "User can't be found";
        }

        // Get issue query data
        let [findQuery, sortQuery, limitNum, skipNum] = this.getQueryInputs(queryData, inUser);

        var queryResults = await Promise.all([this.IssueDetails.count(findQuery).exec(), this.IssueDetails.find(findQuery).sort(sortQuery).skip(skipNum).limit(limitNum).exec()]);

        // Get a return array
        var returnIssueResultsArray = JSON.parse(JSON.stringify(queryResults[1]));

        // For each issue get whether it's read or unread
        await this.setIfIssuesAreRead(returnIssueResultsArray, inUser);

        // Get what issues have what labels for this user (can be done in parallel with above)
        this.setIssueLabelsForUser(returnIssueResultsArray, inUser);

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

        var returnIssueRead = await this.IssueReadDetails.findOne({ issueRef: inIssue._id, userRef: inUser._id });
        if (returnIssueRead == null) {
            returnIssueRead = await this.IssueReadDetails.create({ issueRef: inIssue._id, userRef: inUser._id, readAt: new Date(), repoRef: inIssue.repoRef });
        } else {
            returnIssueRead.readAt = new Date();
        }

        await returnIssueRead.save();
        return true;
    }

    async setIssueUnread(queryData) {
        var inIssue = await this.IssueDetails.findById(queryData.issueID);
        var inUser = (await this.UserDetails.find({ username: queryData.username }))[0];

        if (inUser == null || inIssue == null) {
            return false;
        }

        var returnIssueRead = await this.IssueReadDetails.findOne({ issueRef: inIssue._id, userRef: inUser._id });
        if (returnIssueRead == null) {
            return false;
        } else {
            var deleteReturn = await this.IssueReadDetails.deleteOne({ '_id': returnIssueRead._id });
        }

        return true;
    }

    async setIssueLabel(queryData) {
        var inIssue = await this.IssueDetails.findById(queryData.issueID);
        var inUser = (await this.UserDetails.find({ username: queryData.username }).populate('issueLabels'))[0];

        if (inUser == null || inIssue == null) {
            return false;
        }

        var issueLabel = inUser.issueLabels.find(obj => obj.name == queryData.inLabel);
        var siteIssueLabelID = null;

        if (issueLabel == null) {
            issueLabel = await this.siteIssueLabelDetails.create({ name: queryData.inLabel, issueList: [], owner: inUser._id });
            inUser.issueLabels.push(issueLabel._id);
        }

        var containsThisIssue = issueLabel.issueList.indexOf(inIssue._id);

        if (containsThisIssue == -1) {
            issueLabel.issueList.push(inIssue._id);
            inIssue.siteIssueLabels.push(issueLabel._id);
            await issueLabel.save();
            await Promise.all([inUser.save(), inIssue.save()]);
        }

        return true;
    }

    async removeIssueLabel(queryData) {
        var inIssue = await this.IssueDetails.findById(queryData.issueID);
        var inUser = (await this.UserDetails.find({ username: queryData.username }).populate('issueLabels'))[0];

        if (inUser == null || inIssue == null) {
            return false;
        }

        var issueLabel = inUser.issueLabels.find(obj => obj.name == queryData.inLabel);

        if (issueLabel == null) {
            return false;
        }

        var siteIssueLabelID = issueLabel._id.toString();
        var siteIssueLabelIssueIndex = issueLabel.issueList.indexOf(inIssue._id);
        var issueSiteIssueLabelIndex = inIssue.siteIssueLabels.indexOf(issueLabel._id);

        if (issueSiteIssueLabelIndex != -1) {
            inIssue.siteIssueLabels.splice(issueSiteIssueLabelIndex, 1);
            await inIssue.save();
        }

        if (siteIssueLabelIssueIndex != -1) {
            issueLabel.issueList.splice(siteIssueLabelIssueIndex, 1);

            if (issueLabel.issueList.length == 0) {
                var issueLabelIndex = inUser.issueLabels.indexOf(issueLabel);
                if (issueLabelIndex != -1) {
                    inUser.issueLabels.splice(issueLabelIndex, 1);
                    inUser.save();
                }
                await this.siteIssueLabelDetails.findByIdAndDelete(siteIssueLabelID);
            } else {
                await issueLabel.save();
            }
        }
        return true;
    }

    async setUserRepo(queryData) {
        const inputData = { username: queryData.username, inRepoShortURL: queryData.inRepoShortURL.toLowerCase() };

        if (!this.isValidGithubShortURL(inputData.inRepoShortURL)) {
            return false;
        }

        var inputUser = (await this.UserDetails.find({ 'username': inputData.username }))[0];
        var inputRepo = (await this.RepoDetails.find({ "shortURL": inputData.inRepoShortURL }))[0];

        if (inputRepo == null) {
            inputRepo = await this.RepoDetails.create({
                'shortURL': inputData.inRepoShortURL, 'url': 'https://api.github.com/repos/' + inputData.inRepoShortURL + '/issues',
                updating: false, lastUpdatedAt: new Date('1/1/1900'), lastUpdatedCommentsAt: new Date('1/1/1900')
            });
        }

        if (inputUser) {
            if (inputUser.repos.indexOf(inputRepo._id) == -1) {
                inputUser.repos.push(inputRepo._id);
                inputRepo.userList.push(inputUser._id);
                await inputUser.save();
                await inputRepo.save();
            } else {
                return false;
            }
        } else {
            return false;
        }

        return true;
    }

    async removeUserRepo(queryData) {
        const inputData = { username: queryData.username, inRepoShortURL: queryData.inRepoShortURL.toLowerCase() };

        var inputUser = (await this.UserDetails.find({ 'username': inputData.username }))[0];
        var inputRepo = (await this.RepoDetails.find({ 'shortURL': inputData.inRepoShortURL }))[0];

        if (inputUser && inputRepo) {
            var repoIndex = inputUser.repos.indexOf(inputRepo._id);
            if (repoIndex != -1) {
                inputUser.repos.splice(repoIndex, 1);
                await inputUser.save();
            } else {
                return false;
            }

            var userIndex = inputRepo.userList.indexOf(inputUser._id);
            if (userIndex != -1) {
                inputRepo.userList.splice(userIndex, 1);
                if (inputRepo.userList.length == 0) {
                    let deleteRepoUrl = inputRepo.shortURL.split("/issues")[0];

                    await this.IssueCommentMentionDetails.deleteMany({ repoRef: inputRepo._id });
                    await this.IssueCommentDetails.deleteMany({ repoRef: inputRepo._id });
                    await this.IssueReadDetails.deleteMany({ repoRef: inputRepo._id });
                    await this.IssueDetails.deleteMany({ repoRef: inputRepo._id });
                    await this.RepoDetails.deleteMany({ '_id': inputRepo._id });
                } else {
                    await inputRepo.save();
                }
            } else {
                return false;
            }
        } else {
            return false;
        }

        return true;
    }

    async getMentions(queryData) {
        // Get User Data
        var inUser = (await this.UserDetails.find({ username: queryData.username }).populate('issueLabels').populate('repos'))[0];

        if (inUser == null) {
            throw "User can't be found";
        }

        // Get issue query data
        let [firstFindQuery, firstSortQuery, limitNum, skipNum] = this.getQueryInputs(queryData, inUser);

        let findQuery = {};
        let sortQuery = {};

        // Put all our search criteria as an 'issue ref' object
        for (let objectKey of Object.keys(firstFindQuery)) {
            findQuery["issueResult." + objectKey] = firstFindQuery[objectKey];
        }

        // Put all our sort criteria as an 'issue ref' object
        for (let objectKey of Object.keys(firstSortQuery)) {
            sortQuery["mentionedAt"] = firstSortQuery[objectKey];
        }

        // var testIssueFind = await this.IssueCommentMentionDetails.find({ 'userRef': inUser._id }).populate({ "path": 'issueRef', "match": { 'data.number': 536 }});
        var countQuery = this.IssueCommentMentionDetails.aggregate([
            { "$match": { "userRef": inUser._id } },
            {
                "$lookup": {
                    "from": "issueInfo",
                    "localField": "issueRef",
                    "foreignField": "_id",
                    "as": "issueResult"
                }
            },
            { "$match": findQuery },
            { "$count": "resultCount" },
        ]);
        var mentionQuery = this.IssueCommentMentionDetails.aggregate([
            { "$match": { "userRef": inUser._id } },
            {
                "$lookup": {
                    "from": "issueInfo",
                    "localField": "issueRef",
                    "foreignField": "_id",
                    "as": "issueResult"
                }
            },
            { "$match": findQuery },
            { "$unwind": "$issueResult" },
            { "$sort": sortQuery },
            { "$skip": skipNum },
            { "$limit": limitNum },
        ]);

        var queryResults = await Promise.all([countQuery, mentionQuery]);

        // Get a return array
        let returnIssueResultsArray = [];
        for (let i = 0; i < queryResults[1].length; i++) {
            let pushItem = queryResults[1][i].issueResult;
            pushItem.mentionedAt = queryResults[1][i].mentionedAt;
            pushItem.html_url = queryResults[1][i].html_url;
            pushItem.mentionAuthor = queryResults[1][i].mentionAuthor;
            returnIssueResultsArray.push(pushItem);
        }

        // For each issue get whether it's read or unread
        await this.setIfIssuesAreRead(returnIssueResultsArray, inUser);

        // Get what issues have what labels for this user (can be done in parallel with above)
        this.setIssueLabelsForUser(returnIssueResultsArray, inUser);

        // Return the values
        let queryCountReturn = null;
        if (queryResults[0][0]) {
            queryCountReturn = queryResults[0][0].resultCount;
        } else {
            queryCountReturn = 0;
        }
        var returnResult = { count: queryCountReturn, issueData: returnIssueResultsArray };
        return returnResult;

    }


}

module.exports = WebDataHandler;