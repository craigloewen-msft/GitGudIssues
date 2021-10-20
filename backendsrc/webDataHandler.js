const RefreshRepoHandler = require('./refreshRepoHandler')

class WebDataHandler {
    constructor(inRepoDetails, inIssueDetails, inIssueReadDetails, inUserDetails, inSiteIssueLabelDetails, inGHToken) {
        this.RepoDetails = inRepoDetails;
        this.IssueDetails = inIssueDetails;
        this.IssueReadDetails = inIssueReadDetails;
        this.UserDetails = inUserDetails;
        this.siteIssueLabelDetails = inSiteIssueLabelDetails;
        this.ghToken = inGHToken;
        this.refreshRepoHandler = new RefreshRepoHandler(this.RepoDetails, this.IssueDetails, this.ghToken);
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

    async getIssues(queryData) {

        // Get User Data
        var inUser = (await this.UserDetails.find({ username: queryData.username }).populate('issueLabels').populate('repos'))[0];
        let userIssueLabelList = inUser.issueLabels;
        let userRepoList = inUser.repos;

        if (inUser == null) {
            throw "User can't be found";
        }

        var userID = inUser.id.toString();

        // Start getting issue data
        var findQuery = {};
        var sortQuery = { "data.created_at": -1 };
        var limitNum = 10;
        var skipNum = 0;

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
                let orIssueLabels = await this.siteIssueLabelDetails.find({ 'name': { '$in': siteLabelList }, owner: inUser._id });
                labelMatchObject.push({ "siteIssueLabels": { "$in": orIssueLabels } });
            }

            if (findQuery["$and"] == null) {
                findQuery["$and"] = [];
            }
            for (let i = 0; i < labelMatchObject.length; i++) {
                findQuery["$and"].push(labelMatchObject[i]);
            }
        }

        var queryResults = await Promise.all([this.IssueDetails.count(findQuery).exec(), this.IssueDetails.find(findQuery).sort(sortQuery).skip(skipNum).limit(limitNum).exec()]);

        // Get a return array
        var returnIssueResultsArray = JSON.parse(JSON.stringify(queryResults[1]));

        // For each issue get whether it's read or unread
        var getIssueReadPromise = Promise.all(returnIssueResultsArray.map(async (issueItem) => {
            var issueReadItem = issueItem.readByArray.find(obj => obj.userRef == inUser._id.toString());
            if (issueReadItem == null) {
                issueItem.readByUser = false;
            } else if (new Date(issueReadItem.readAt) >= new Date(issueItem.data.updated_at)) {
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

        var returnIssueRead = inIssue.readByArray.find(obj => obj.userRef == inUser._id.toString());
        if (returnIssueRead == null) {
            inIssue.readByArray.push({ readAt: new Date(), userRef: inUser._id.toString() });
        } else {
            returnIssueRead.readAt = new Date();
        }

        await inIssue.save();
        return true;
    }

    async setIssueUnread(queryData) {
        var inIssue = await this.IssueDetails.findById(queryData.issueID);
        var inUser = (await this.UserDetails.find({ username: queryData.username }))[0];

        if (inUser == null || inIssue == null) {
            return false;
        }

        var returnIssueRead = inIssue.readByArray.find(obj => obj.userRef == inUser._id.toString());
        if (returnIssueRead == null) {
            return false;
        } else {
            inIssue.readByArray = inIssue.readByArray.filter(item => item != returnIssueRead);
            await inIssue.save();
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
                updating: false, lastUpdatedAt: new Date('1/1/1900')
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
                    await this.IssueDetails.deleteMany({ 'data.repository_url': { "$regex": deleteRepoUrl, "$options": "gi" } });
                    await this.RepoDetails.findByIdAndDelete(inputRepo._id);
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


}

module.exports = WebDataHandler;