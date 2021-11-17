const RefreshRepoHandler = require('./refreshRepoHandler')
const RepoScanner = require('./repoScanner')

class WebDataHandler {
    constructor(inRepoDetails, inIssueDetails, inUserDetails, inSiteIssueLabelDetails, inIssueCommentDetails, inIssueCommentMentionDetails,
        inIssueReadDetails, inSearhQueryDetails, inMentionQueryDetails, inGHToken) {
        this.RepoDetails = inRepoDetails;
        this.IssueDetails = inIssueDetails;
        this.UserDetails = inUserDetails;
        this.siteIssueLabelDetails = inSiteIssueLabelDetails;
        this.IssueCommentDetails = inIssueCommentDetails;
        this.IssueCommentMentionDetails = inIssueCommentMentionDetails;
        this.IssueReadDetails = inIssueReadDetails;
        this.SearchQueryDetails = inSearhQueryDetails;
        this.MentionQueryDetails = inMentionQueryDetails;
        this.ghToken = inGHToken;
        this.refreshRepoHandler = new RefreshRepoHandler(this.RepoDetails, this.IssueDetails, this.IssueCommentDetails, this.UserDetails, this.IssueCommentMentionDetails, this.IssueReadDetails, this.ghToken);
        this.repoScanner = new RepoScanner(this.RepoDetails, this.IssueDetails, this.IssueCommentDetails, this.UserDetails, this.IssueCommentMentionDetails, this.IssueReadDetails);
    }

    isValidGithubShortURL(inString) {
        let splitStringArray = inString.split("/");

        return splitStringArray.length == 2;
    }

    async refreshData(inUsername) {
        var inUser = (await this.UserDetails.find({ username: inUsername }).populate('repos'))[0];
        // Check if the thing is not updating
        for (let i = 0; i < inUser.repos.length; i++) {
            this.refreshRepoHandler.addRepoForRefresh(inUser.repos[i]);
        }
        try {
            await this.refreshRepoHandler.startRefreshingRepos();
        } catch (error) {
            this.refreshRepoHandler.reset();
            console.log("Couldn't refresh repos");
            console.log(error);
        }
    }

    async refreshRepo(inUsername, inRepoName) {
        var inUser = (await this.UserDetails.find({ username: inUsername }).populate('repos'))[0];
        for (let i = 0; i < inUser.repos.length; i++) {
            if (inUser.repos[i].shortURL == inRepoName) {
                this.refreshRepoHandler.addRepoForRefresh(inUser.repos[i]);
            }
        }
        try {
            await this.refreshRepoHandler.startRefreshingRepos();
        } catch (error) {
            this.refreshRepoHandler.reset();
            console.log("Couldn't refresh repos");
            console.log(error);
        }
    }

    async scanUserForMentions(inUsername, inReponame) {
        // Check in user exists
        // Check in repo exists else return error

        let inUser = await this.UserDetails.findOne({ username: inUsername });
        let inRepo = await this.RepoDetails.findOne({ shortURL: inReponame });

        if (inUser == null | inRepo == null) {
            return false;
        }

        return await this.repoScanner.scanUserForMentions(inUser, inRepo);
    }

    getQueryInputs(queryData, inUser) {
        var findQuery = {};
        var sortQuery = { "created_at": -1 };
        var limitNum = 10;
        var skipNum = 0;

        let andOrArrays = [];

        let userRepoList = inUser.repos;

        if (queryData.per_page) {
            limitNum = queryData.per_page;
        }

        if (queryData.sort) {
            if (queryData.sort == 'updated') {
                sortQuery = { "updated_at": -1 }
            }
        }

        if (queryData.state) {
            if (queryData.state != "all") {
                findQuery['state'] = queryData.state;
            }
        }

        if (queryData.limit) {
            let inputLimit = parseInt(queryData.limit);
            if (inputLimit < 0) {
                limitNum = 0;
            }
            if (inputLimit < 30) {
                limitNum = inputLimit;
            } else {
                limitNum = 30;
            }
        }

        if (queryData.page_num) {
            skipNum = (parseInt(queryData.page_num) - 1) * limitNum;
        }

        if (queryData.creator) {
            findQuery['user.login'] = { "$regex": queryData.creator, "$options": "gi" }
        }

        if (queryData.assignee) {
            findQuery['assignee.login'] = { "$regex": queryData.assignee, "$options": "gi" }
        }

        if (queryData.labels) {
            let orLabelList = queryData.labels.split(',');
            let labelMatchObject = [];

            for (let i = 0; i < orLabelList.length; i++) {
                let labelList = orLabelList[i].split('&');
                let andList = [];
                for (let j = 0; j < labelList.length; j++) {
                    andList.push(labelList[j]);
                }
                labelMatchObject.push(andList);
            }

            let emplaceObject = [];
            andOrArrays.push(emplaceObject);

            for (let i = 0; i < labelMatchObject.length; i++) {
                let andLabelList = labelMatchObject[i];
                let andObject = { "$and": [] };
                if (andLabelList.length == 1) {
                    emplaceObject.push({ "labels": { "$elemMatch": { "name": andLabelList[0] } } });
                } else {
                    for (let j = 0; j < andLabelList.length; j++) {
                        let putLabel = andLabelList[j];
                        andObject["$and"].push({ "labels": { "$elemMatch": { "name": putLabel } } });
                    }
                    emplaceObject.push(andObject);
                }
            }
        }

        let repoQueryData = [];
        if (queryData.repos) {
            queryData.repos = queryData.repos.toLowerCase();
            let repoList = queryData.repos.split(',');
            let matchArray = [];
            for (let i = 0; i < repoList.length; i++) {
                matchArray.push("https://api.github.com/repos/" + repoList[i]);
            }
            repoQueryData = matchArray;
        } else {
            let matchArray = [];
            for (let i = 0; i < userRepoList.length; i++) {
                matchArray.push(userRepoList[i].url.split('/issues')[0]);
            }
            repoQueryData = matchArray;
        }

        if (repoQueryData.length == 1) {
            findQuery['repository_url'] = repoQueryData[0];
        } else if (repoQueryData.length > 1) {
            findQuery['repository_url'] = { "$in": repoQueryData };
        }

        if (queryData.siteLabels) {
            let orLabelList = queryData.siteLabels.split(',');
            let labelMatchObject = [];

            for (let i = 0; i < orLabelList.length; i++) {
                let labelList = orLabelList[i].split('&');
                let andList = [];
                for (let j = 0; j < labelList.length; j++) {
                    andList.push(labelList[j]);
                }
                labelMatchObject.push(andList);
            }

            let emplaceObject = [];
            andOrArrays.push(emplaceObject);

            for (let i = 0; i < labelMatchObject.length; i++) {
                let andLabelList = labelMatchObject[i];
                let andObject = { "$and": [] };
                if (andLabelList.length == 1) {
                    emplaceObject.push({ "siteIssueLabels": { "$elemMatch": { "name": andLabelList[0] } } });
                } else {
                    for (let j = 0; j < andLabelList.length; j++) {
                        let putLabel = andLabelList[j];
                        andObject["$and"].push({ "siteIssueLabels": { "$elemMatch": { "name": putLabel } } });
                    }
                    emplaceObject.push(andObject);
                }
            }
        }

        if (queryData.number) {
            findQuery['number'] = Number(queryData.number);
        }

        let tempArray = [[{
            "$and":
                [
                    { "labels": { "$elemMatch": { "name": "needs-author-feedback" } } },
                    { "labels": { "$elemMatch": { "name": "wsl1" } } }]
        },
        {
            "$and": [{ "labels": { "$elemMatch": { "name": "bug" } } },
            { "labels": { "$elemMatch": { "name": "GPU" } } }]
        }]];

        // Get and array (level 1)
        let rootAndArray = [];
        for (let i = 0; i < andOrArrays.length; i++) {
            // Get or Array (level 2)
            let orEmplaceArray = [];
            let thisOrArray = andOrArrays[i];
            let orReturnObject = null;
            for (let j = 0; j < thisOrArray.length; j++) {
                orEmplaceArray.push(thisOrArray[j]); // Level 3 is already done
            }
            if (orEmplaceArray.length == 1) {
                orReturnObject = orEmplaceArray[0];
            } else {
                orReturnObject = { "$or": orEmplaceArray };
            }
            // End Level 2
            rootAndArray.push(orReturnObject);
        }
        if (rootAndArray.length == 1) {
            Object.keys(rootAndArray[0]).forEach((key, index) => {
                findQuery[key] = rootAndArray[0][key];
            });
        } else if (rootAndArray.length > 1) {
            findQuery["$and"] = rootAndArray;
        }
        // End level 1

        return [findQuery, sortQuery, limitNum, skipNum];
    }

    async setIfIssuesAreRead(inputIssueArray, inUser) {
        inputIssueArray.map((issueItem) => {
            let issueReadArray = issueItem.issueReadArray;
            if (issueReadArray.length > 0) {
                // Choose the highest read at
                let issueReadItem = issueReadArray.reduce((max, issueRead) => max.readAt > issueRead.readAt ? max : issueRead);
                if (new Date(issueReadItem.readAt) >= new Date(issueItem.updated_at)) {
                    issueItem.readByUser = true;
                } else {
                    issueItem.readByUser = false;
                }
            } else {
                issueItem.readByUser = false;
            }
        });

    }

    setIssueLabelsForUser(inputIssueArray, inUser) {
        inputIssueArray.map((issueItem) => {
            var siteLabelsToReturn = [];

            for (const iterIssueLabel of issueItem.siteIssueLabels) {
                siteLabelsToReturn.push(iterIssueLabel.name);
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

        var countQuery = this.IssueDetails.aggregate([
            {
                "$lookup": {
                    "from": "siteIssueLabelInfo",
                    "localField": "_id",
                    "foreignField": "issueList",
                    "as": "siteIssueLabels"
                }
            },
            { "$match": findQuery },
            { "$count": "resultCount" },
        ]);

        var issueQuery = this.IssueDetails.aggregate([
            { "$project": { "body": 0 } },
            {
                "$lookup": {
                    "from": "siteIssueLabelInfo",
                    "localField": "_id",
                    "foreignField": "issueList",
                    "as": "siteIssueLabels",
                    "pipeline": [
                        {
                            "$match": {
                                "owner": inUser._id
                            }
                        }
                    ],
                }
            },
            {
                "$lookup": {
                    "from": "issueReadInfo",
                    "localField": "_id",
                    "foreignField": "issueRef",
                    "as": "issueReadArray",
                    "pipeline": [
                        {
                            "$match": {
                                "userRef": inUser._id
                            }
                        }
                    ],
                }
            },
            { "$match": findQuery },
            // { "$unwind": "$issueResult" },
            { "$sort": sortQuery },
            { "$skip": skipNum },
            { "$limit": limitNum },
        ]);

        var queryResults = await Promise.all([countQuery, issueQuery]);

        // Get a return array
        var returnIssueResultsArray = JSON.parse(JSON.stringify(queryResults[1]));

        // For each issue get whether it's read or unread
        this.setIfIssuesAreRead(returnIssueResultsArray, inUser);

        // Get what issues have what labels for this user (can be done in parallel with above)
        this.setIssueLabelsForUser(returnIssueResultsArray, inUser);

        // Return the values
        let returnCount = 0;
        if (queryResults[0][0] != null) {
            returnCount = queryResults[0][0].resultCount;
        }
        var returnResult = { count: returnCount, issueData: returnIssueResultsArray };
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
        }

        var containsThisIssue = issueLabel.issueList.indexOf(inIssue._id);

        if (containsThisIssue == -1) {
            issueLabel.issueList.push(inIssue._id);
            await issueLabel.save();
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

        if (siteIssueLabelIssueIndex != -1) {
            issueLabel.issueList.splice(siteIssueLabelIssueIndex, 1);

            if (issueLabel.issueList.length == 0) {
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

        let initialInputRepo = inputRepo;

        if (inputRepo == null) {
            inputRepo = await this.RepoDetails.create({
                'shortURL': inputData.inRepoShortURL, 'url': 'https://api.github.com/repos/' + inputData.inRepoShortURL + '/issues',
                updating: false, lastIssuesCompleteUpdate: new Date('1/1/1900'), lastCommentsCompleteUpdate: new Date('1/1/1900')
            });
        }

        if (inputUser) {
            if (inputUser.repos.indexOf(inputRepo._id) == -1) {
                inputUser.repos.push(inputRepo._id);
                await inputUser.save();
            } else {
                return false;
            }
        } else {
            return false;
        }

        // If repo already exists then scan for mentions
        if (initialInputRepo != null) {
            this.repoScanner.scanUserForMentions(inputUser, inputRepo);
        }

        return true;
    }

    async removeUserRepo(queryData) {
        const inputData = { username: queryData.username, inRepoShortURL: queryData.inRepoShortURL.toLowerCase() };

        var inputUser = (await this.UserDetails.find({ 'username': inputData.username }))[0];
        var inputRepo = await this.RepoDetails.findOne({ 'shortURL': inputData.inRepoShortURL }).populate('userList');

        if (inputUser && inputRepo) {
            var repoIndex = inputUser.repos.indexOf(inputRepo._id);
            if (repoIndex != -1) {
                inputUser.repos.splice(repoIndex, 1);
                await inputUser.save();

                // Remove user mentions
                await this.IssueCommentMentionDetails.deleteMany({ userRef: inputUser._id, repoRef: inputRepo._id })
                await this.IssueReadDetails.deleteMany({ userRef: inputUser._id, repoRef: inputRepo._id })

            } else {
                return false;
            }

            if (inputRepo.userList.length == 1) {

                console.log("Deleting repo: " + inputRepo.shortURL);

                this.refreshRepoHandler.reset();

                await this.IssueCommentMentionDetails.deleteMany({ repoRef: inputRepo._id })
                await this.IssueReadDetails.deleteMany({ repoRef: inputRepo._id })
                await this.IssueCommentDetails.deleteMany({ repositoryID: inputRepo._id })
                await this.IssueDetails.deleteMany({ repoRef: inputRepo._id })
                await this.RepoDetails.deleteOne({ '_id': inputRepo._id })
            }
        } else {
            return false;
        }

        return true;
    }

    transformIssueSearchLeafRecursive(findQuery, firstFindQuery) {
        for (let objectKey of Object.keys(firstFindQuery)) {
            if (objectKey != "$and" && objectKey != "$or") {
                if (objectKey != "siteIssueLabels" && objectKey != "issueReadArray") {
                    findQuery["issueResult." + objectKey] = firstFindQuery[objectKey];
                } else {
                    findQuery[objectKey] = firstFindQuery[objectKey];
                }
            } else {
                let emplaceArray = [];
                findQuery[objectKey] = emplaceArray;
                for (let i = 0; i < firstFindQuery[objectKey].length; i++) {
                    let insertObject = {};
                    emplaceArray.push(insertObject);
                    this.transformIssueSearchLeafRecursive(insertObject, firstFindQuery[objectKey][i]);
                }
            }
        }

    }

    transformIssueSearchCriteriaToMentions(firstFindQuery, firstSortQuery) {
        let findQuery = {};
        let sortQuery = {};

        // Put all our search criteria as an 'issue ref' object
        this.transformIssueSearchLeafRecursive(findQuery, firstFindQuery);

        // Put all our sort criteria as an 'issue ref' object
        for (let objectKey of Object.keys(firstSortQuery)) {
            sortQuery["mentionedAt"] = firstSortQuery[objectKey];
        }

        return [findQuery, sortQuery];
    }

    async getMentions(queryData) {
        // Get User Data
        var inUser = (await this.UserDetails.find({ username: queryData.username }).populate('issueLabels').populate('repos'))[0];

        if (inUser == null) {
            throw "User can't be found";
        }

        // Get issue query data
        let [firstFindQuery, firstSortQuery, limitNum, skipNum] = this.getQueryInputs(queryData, inUser);

        let [findQuery, sortQuery] = this.transformIssueSearchCriteriaToMentions(firstFindQuery, firstSortQuery);

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
            { "$project": { "issueResult.body": 0 } },
            { "$unwind": "$issueResult" },
            {
                "$lookup": {
                    "from": "siteIssueLabelInfo",
                    "localField": "issueResult._id",
                    "foreignField": "issueList",
                    "as": "siteIssueLabels",
                    "pipeline": [
                        {
                            "$match": {
                                "owner": inUser._id
                            }
                        }
                    ],
                }
            },
            {
                "$lookup": {
                    "from": "issueReadInfo",
                    "localField": "issueResult._id",
                    "foreignField": "issueRef",
                    "as": "issueReadArray",
                    "pipeline": [
                        {
                            "$match": {
                                "userRef": inUser._id
                            }
                        }
                    ],
                }
            },
            { "$match": findQuery },
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
            pushItem.issueReadArray = queryResults[1][i].issueReadArray;
            pushItem.siteIssueLabels = queryResults[1][i].siteIssueLabels;
            returnIssueResultsArray.push(pushItem);
        }

        // For each issue get whether it's read or unread
        this.setIfIssuesAreRead(returnIssueResultsArray, inUser);

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

    async modifyUserManageIssueQuery(inputData) {
        const { _id: inQueryID, ...inQueryData } = inputData.inQuery;
        var returnID = null;
        var inputUser = (await this.UserDetails.find({ 'username': inputData.username }))[0];

        if (inputData.inAction == "save") {
            var updatedSearchQuery = await this.SearchQueryDetails.findByIdAndUpdate(inQueryID, { '$set': inQueryData });
            if (updatedSearchQuery == null) {
                var newSearchQuery = await this.SearchQueryDetails.create(inputData.inQuery);
                newSearchQuery.userRef = inputUser._id;
                await newSearchQuery.save();
                returnID = newSearchQuery._id.toString()
            } else {
                returnID = updatedSearchQuery._id.toString();
            }
        } else if (inputData.inAction == "delete") {
            var deletedSearchQuery = await this.SearchQueryDetails.findByIdAndDelete(inQueryID);
            returnID = inQueryID;
        }

        return returnID;
    }

    async modifyUserManageMentionQuery(inputData) {
        const { _id: inQueryID, ...inQueryData } = inputData.inQuery;
        var returnID = null;
        var inputUser = (await this.UserDetails.find({ 'username': inputData.username }))[0];

        if (inputData.inAction == "save") {
            var updatedSearchQuery = await this.MentionQueryDetails.findByIdAndUpdate(inQueryID, { '$set': inQueryData });
            if (updatedSearchQuery == null) {
                var newMentionQuery = await this.MentionQueryDetails.create(inputData.inQuery);
                newMentionQuery.userRef = inputUser._id;
                await newMentionQuery.save();
                returnID = newMentionQuery._id.toString()
            } else {
                returnID = updatedSearchQuery._id.toString();
            }
        } else if (inputData.inAction == "delete") {
            var deletedSearchQuery = await this.MentionQueryDetails.findByIdAndDelete(inQueryID);
            returnID = inQueryID;
        }

        return returnID;
    }


}

module.exports = WebDataHandler;