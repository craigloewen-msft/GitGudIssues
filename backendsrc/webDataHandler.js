const RefreshRepoHandler = require('./refreshRepoHandler')
const RepoScanner = require('./repoScanner')
const axios = require('axios');
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;

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

    async isValidGithubShortURL(inString) {
        let splitStringArray = inString.split("/");
        let repoOwner = splitStringArray[0];
        let repoName = splitStringArray[1];

        let apiString = "https://api.github.com/repos/" + repoOwner + "/" + repoName;

        try {
            let response = null;
            if (this.ghToken) {
                response = await axios.get(apiString, {
                    headers: {
                        "Authorization": "token " + this.ghToken,
                    },
                });
            } else {
                response = await axios.get(apiString, {
                });
            }
            return true;
        } catch (error) {
            return false;
        }
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

    async refreshAllData() {
        var userList = await this.UserDetails.find({});
        for (let i = 0; i < userList.length; i++) {
            this.refreshData(userList[i].username);
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
        let commentsNeeded = false;

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
            let creatorSplitString = queryData.creator.split(",");
            findQuery['user.login'] = { "$in": creatorSplitString };
        }

        if (queryData.closed_by) {
            let closedBySplitString = queryData.closed_by.split(",");
            findQuery["closed_by.login"] = { "$in": closedBySplitString };
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
            for (let i = 0; i < userRepoList.length; i++) {
                let repoVisitor = userRepoList[i];
                if (repoList.includes(repoVisitor.shortURL)) {
                    matchArray.push(ObjectId(userRepoList[i]._id.toString()));
                }
            }
            repoQueryData = matchArray;
        } else {
            let matchArray = [];
            for (let i = 0; i < userRepoList.length; i++) {
                matchArray.push(ObjectId(userRepoList[i]._id.toString()));
            }
            repoQueryData = matchArray;
        }

        if (repoQueryData.length == 1) {
            findQuery['repoRef'] = repoQueryData[0];
        } else if (repoQueryData.length > 1) {
            findQuery['repoRef'] = { "$in": repoQueryData };
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

        if (queryData.commentedAliases) {
            commentsNeeded = true;
            let orLabelList = queryData.commentedAliases.split(',');
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
                    emplaceObject.push({ "issueCommentsArray": { "$elemMatch": { "user.login": andLabelList[0] } } });
                } else {
                    for (let j = 0; j < andLabelList.length; j++) {
                        let putLabel = andLabelList[j];
                        andObject["$and"].push({ "issueCommentsArray": { "$elemMatch": { "user.login": putLabel } } });
                    }
                    emplaceObject.push(andObject);
                }
            }
        }

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

        return [findQuery, sortQuery, limitNum, skipNum, commentsNeeded];
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
        let [findQuery, sortQuery, limitNum, skipNum, commentsNeeded] = this.getQueryInputs(queryData, inUser);

        let countQueryPipeline = [];
        let issueQueryPipeline = [];

        issueQueryPipeline.push(
            { "$project": { "body": 0 } }
        );

        let commentLookup = {
            "$lookup": {
                "from": "issueCommentInfo",
                "localField": "_id",
                "foreignField": "issueRef",
                "as": "issueCommentsArray",
                "pipeline": [
                    {
                        "$project": {
                            "updated_at": 1,
                            "user.login": 1
                        }
                    }
                ],
            }
        };

        if (commentsNeeded) {
            countQueryPipeline.push(commentLookup);
            issueQueryPipeline.push(commentLookup);
        }

        countQueryPipeline.push(
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
        );

        issueQueryPipeline.push(
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
        );

        var countQuery = this.IssueDetails.aggregate(countQueryPipeline);
        var issueQuery = this.IssueDetails.aggregate(issueQueryPipeline);

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

        let isValidRepo = await this.isValidGithubShortURL(inputData.inRepoShortURL);

        if (!isValidRepo) {
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
                await this.IssueCommentDetails.deleteMany({ repoRef: inputRepo._id })
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
                if (objectKey != "siteIssueLabels" && objectKey != "issueReadArray" && objectKey != "issueCommentsArray") {
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
        let [firstFindQuery, firstSortQuery, limitNum, skipNum, commentsNeeded] = this.getQueryInputs(queryData, inUser);

        let [findQuery, sortQuery] = this.transformIssueSearchCriteriaToMentions(firstFindQuery, firstSortQuery);


        let countQueryPipeline = [];
        let mentionQueryPipeline = [];

        countQueryPipeline.push(
            { "$match": { "userRef": inUser._id } },
            {
                "$lookup": {
                    "from": "issueInfo",
                    "localField": "issueRef",
                    "foreignField": "_id",
                    "as": "issueResult"
                }
            },
        );
        mentionQueryPipeline.push(
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
        );

        let commentLookup = {
            "$lookup": {
                "from": "issueCommentInfo",
                "localField": "issueResult._id",
                "foreignField": "issueRef",
                "as": "issueCommentsArray",
                "pipeline": [
                    {
                        "$project": {
                            "updated_at": 1,
                            "user.login": 1
                        }
                    }
                ],
            }
        };

        if (commentsNeeded) {
            countQueryPipeline.push(commentLookup);
            mentionQueryPipeline.push(commentLookup);
        }

        countQueryPipeline.push(
            { "$match": findQuery },
            { "$count": "resultCount" },
        );

        mentionQueryPipeline.push(
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
        );

        var countQuery = this.IssueCommentMentionDetails.aggregate(countQueryPipeline);
        var mentionQuery = this.IssueCommentMentionDetails.aggregate(mentionQueryPipeline);

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

    // Chart data functions

    getDateListBetweenDates(startDate, endDate, interval) {
        const datesList = [];
        let visitorDate = new Date(startDate);

        while (visitorDate < endDate) {
            datesList.push(new Date(visitorDate));
            visitorDate.setDate(visitorDate.getDate() + interval);
        }

        return datesList;
    }

    async getActiveIssues(inputDate, firstFindQuery) {
        let countData = await this.IssueDetails.aggregate([
            {
                "$match": firstFindQuery,
            },
            {
                "$match": {
                    "created_at": {
                        "$lt": inputDate
                    },
                    "$or": [
                        { "closed_at": { "$gt": inputDate } },
                        { "closed_at": null },
                    ]
                }
            },
            {
                "$count": "resultCount"
            }
        ])
        if (countData[0]) {
            return countData[0].resultCount;
        } else {
            return 0;
        }
    }

    async getIssuesCreated(inputDate, inputPeriod, firstFindQuery) {
        let previousDate = new Date(inputDate);
        previousDate.setDate(inputDate.getDate() - inputPeriod);

        let countData = await this.IssueDetails.aggregate([
            {
                "$match": firstFindQuery,
            },
            {
                "$match": {
                    "created_at": {
                        "$lt": inputDate,
                        "$gt": previousDate,
                    },
                }
            },
            {
                "$count": "resultCount"
            }
        ])
        if (countData[0]) {
            return countData[0].resultCount;
        } else {
            return 0;
        }
    }

    async getCommentsCreated(inputDate, inputPeriod, firstFindQuery) {
        let previousDate = new Date(inputDate);
        previousDate.setDate(inputDate.getDate() - inputPeriod);

        let countData = await this.IssueCommentDetails.aggregate([
            {
                "$match": firstFindQuery,
            },
            {
                "$match": {
                    "created_at": {
                        "$lt": inputDate,
                        "$gt": previousDate,
                    },
                }
            },
            {
                "$count": "resultCount"
            }
        ])
        if (countData[0]) {
            return countData[0].resultCount;
        } else {
            return 0;
        }
    }

    async getIssuesClosed(inputDate, inputPeriod, firstFindQuery) {
        let previousDate = new Date(inputDate);
        previousDate.setDate(inputDate.getDate() - inputPeriod);

        let countData = await this.IssueDetails.aggregate([
            {
                "$match": firstFindQuery,
            },
            {
                "$match": {
                    "closed_at": {
                        "$lt": inputDate,
                        "$gt": previousDate,
                    },
                }
            },
            {
                "$count": "resultCount"
            }
        ])
        if (countData[0]) {
            return countData[0].resultCount;
        } else {
            return 0;
        }
    }

    getIntervalPeriod(startDate, endDate) {
        let inputPeriod = 7;

        let dayDifference = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
        if (dayDifference > 200) {
            inputPeriod = 30;
        }

        return inputPeriod;
    }

    async getActiveIssuesGraphData(queryData) {
        // Get User Data
        var inUser = (await this.UserDetails.find({ username: queryData.username }).populate('issueLabels').populate('repos'))[0];

        if (inUser == null) {
            throw "User can't be found";
        }

        let startDate = new Date(queryData.startDate);
        let endDate = new Date(queryData.endDate);
        let inputPeriod = this.getIntervalPeriod(startDate, endDate);

        // Get issue query data
        let [firstFindQuery, firstSortQuery, limitNum, skipNum, commentsNeeded] = this.getQueryInputs(queryData, inUser);
        let dateArray = this.getDateListBetweenDates(startDate, endDate, inputPeriod);

        let datesPromiseList = [];

        for (let i = 0; i < dateArray.length; i++) {
            let inputDate = dateArray[i];
            datesPromiseList.push(this.getActiveIssues(inputDate, firstFindQuery));
        }

        let xData = await Promise.all(datesPromiseList);
        let labelData = dateArray.map((inDate) => inDate.getMonth() + " " + inDate.getDate() + " " + inDate.getFullYear());
        return { datasets: [{ data: xData, label: "Active Issues" }], labels: labelData };
    }

    async getIssueActivityGraphData(queryData) {
        // Get User Data
        var inUser = (await this.UserDetails.find({ username: queryData.username }).populate('issueLabels').populate('repos'))[0];

        if (inUser == null) {
            throw "User can't be found";
        }

        let startDate = new Date(queryData.startDate);
        let endDate = new Date(queryData.endDate);
        let inputPeriod = this.getIntervalPeriod(startDate, endDate);

        // Get issue query data
        let [firstFindQuery, firstSortQuery, limitNum, skipNum, commentsNeeded] = this.getQueryInputs(queryData, inUser);
        let dateArray = this.getDateListBetweenDates(startDate, endDate, inputPeriod);

        let issuesClosedPromiseList = [];
        let issuesCreatedPromiseList = [];

        for (let i = 0; i < dateArray.length; i++) {
            let inputDate = dateArray[i];
            let issueClosedPromise = this.getIssuesClosed(inputDate, inputPeriod, firstFindQuery);
            let issuesCreatedPromise = this.getIssuesCreated(inputDate, inputPeriod, firstFindQuery);
            issuesClosedPromiseList.push(issueClosedPromise);
            issuesCreatedPromiseList.push(issuesCreatedPromise);
        }

        let [issuesClosedData, issuesCreatedData] = await Promise.all([Promise.all(issuesClosedPromiseList), Promise.all(issuesCreatedPromiseList)]);
        let labelData = dateArray.map((inDate) => inDate.getMonth() + " " + inDate.getDate() + " " + inDate.getFullYear());
        return { datasets: [{ data: issuesClosedData, label: "Closed Issues" }, { data: issuesCreatedData, label: "Created Issues" }], labels: labelData };
    }

    async getCommentActivityGraphData(queryData) {
        // Get User Data
        var inUser = (await this.UserDetails.find({ username: queryData.username }).populate('issueLabels').populate('repos'))[0];

        if (inUser == null) {
            throw "User can't be found";
        }

        let startDate = new Date(queryData.startDate);
        let endDate = new Date(queryData.endDate);
        let inputPeriod = this.getIntervalPeriod(startDate, endDate);

        // Get issue query data
        let [firstFindQuery, firstSortQuery, limitNum, skipNum, commentsNeeded] = this.getQueryInputs(queryData, inUser);
        let dateArray = this.getDateListBetweenDates(startDate, endDate, inputPeriod);

        let commentNumberPromiseList = [];

        for (let i = 0; i < dateArray.length; i++) {
            let inputDate = dateArray[i];
            let commentNumberPromise = this.getCommentsCreated(inputDate, inputPeriod, firstFindQuery);
            commentNumberPromiseList.push(commentNumberPromise);
        }

        let xData = await Promise.all(commentNumberPromiseList);
        let labelData = dateArray.map((inDate) => inDate.getMonth() + " " + inDate.getDate() + " " + inDate.getFullYear());
        return { datasets: [{ data: xData, label: "Number of Comments" }], labels: labelData };
    }

    async getUserActivityData(inputDate, inputPeriod, firstFindQuery, inGHUsernameList) {
        let previousDate = new Date(inputDate);
        previousDate.setDate(inputDate.getDate() - inputPeriod);
        let returnObject = {};

        // Convert name list to an array
        let splitGHUsernameList = inGHUsernameList.split(",");

        let closedSummaryPromise = this.IssueDetails.aggregate([
            {
                "$match": firstFindQuery,
            },
            {
                "$match": {
                    "closed_at": {
                        "$lt": inputDate,
                        "$gt": previousDate,
                    },
                    "closed_by.login": {
                        "$in": splitGHUsernameList
                    }
                }
            },
            {
                "$lookup": {
                    "from": "repoInfo",
                    "localField": "repoRef",
                    "foreignField": "_id",
                    "as": "repoInfo"
                }
            },
            {
                "$group": {
                    _id: "$repoInfo.shortURL",
                    count: { "$count": {} },
                }
            },
            {
                "$sort": {
                    "count": -1
                }
            },
        ]);

        let openedSummaryPromise = this.IssueDetails.aggregate([
            {
                "$match": firstFindQuery,
            },
            {
                "$match": {
                    "created_at": {
                        "$lt": inputDate,
                        "$gt": previousDate,
                    },
                    "user.login": {
                        "$in": splitGHUsernameList
                    }
                }
            },
            {
                "$lookup": {
                    "from": "repoInfo",
                    "localField": "repoRef",
                    "foreignField": "_id",
                    "as": "repoInfo"
                }
            },
            {
                "$group": {
                    _id: "$repoInfo.shortURL",
                    count: { "$count": {} },
                }
            },
            {
                "$sort": {
                    "count": -1
                }
            },
        ]);

        let closedSummary = await closedSummaryPromise;
        let openedSummary = await openedSummaryPromise;

        for (let i = 0; i < closedSummary.length; i++) {
            let repoInfoVisitor = closedSummary[i];
            if (repoInfoVisitor._id.length == 0) {
                throw "Malformed issue with no reference repos"
            } else if (repoInfoVisitor._id.length > 1) {
                throw "Malformed issue with multiple repo refs"
            }
            returnObject[repoInfoVisitor._id[0]] = { closed: -repoInfoVisitor.count };
        }

        for (let i = 0; i < openedSummary.length; i++) {
            let repoInfoVisitor = openedSummary[i];
            if (repoInfoVisitor._id.length == 0) {
                throw "Malformed issue with no reference repos"
            } else if (repoInfoVisitor._id.length > 1) {
                throw "Malformed issue with multiple repo refs"
            }
            if (!returnObject[repoInfoVisitor._id[0]]) {
                returnObject[repoInfoVisitor._id[0]] = { closed: 0, opened: repoInfoVisitor.count };
            } else {
                returnObject[repoInfoVisitor._id[0]].opened = repoInfoVisitor.count;
            }
        }

        // Final processing of data
        let totalOpened = 0;
        let totalClosed = 0;

        for (let repoName in returnObject) {
            let repoVisitorObject = returnObject[repoName];

            // If data doesn't exist put in a 0
            if (!repoVisitorObject.opened) {
                repoVisitorObject.opened = 0;
            }

            totalOpened = totalOpened + repoVisitorObject.opened;
            totalClosed = totalClosed + repoVisitorObject.closed;
        }

        returnObject.aggregateData = { opened: totalOpened, closed: totalClosed };

        return returnObject;
    }

    async getUserActivityGraphData(queryData) {
        // Get User Data
        var inUser = (await this.UserDetails.find({ username: queryData.username }).populate('repos'))[0];

        if (inUser == null) {
            throw "User can't be found";
        }

        let startDate = new Date(queryData.startDate);
        let endDate = new Date(queryData.endDate);
        let inputPeriod = this.getIntervalPeriod(startDate, endDate);

        // Get issue query data
        let [firstFindQuery, firstSortQuery, limitNum, skipNum, commentsNeeded] = this.getQueryInputs(queryData, inUser);
        let dateArray = this.getDateListBetweenDates(startDate, endDate, inputPeriod);

        // Get [Opened issues by repo, closed issues by repo, total open issues, total closed issues, and net]
        let dataPointGatherPromiseList = [];

        for (let i = 0; i < dateArray.length; i++) {
            let inputDate = dateArray[i];
            let dataPointGatherPromise = this.getUserActivityData(inputDate, inputPeriod, firstFindQuery, queryData.names);
            dataPointGatherPromiseList.push(dataPointGatherPromise);
        }

        let dataPointArray = await Promise.all(dataPointGatherPromiseList);
        let labelData = dateArray.map((inDate) => inDate.getMonth() + " " + inDate.getDate() + " " + inDate.getFullYear());

        let returnChartObject = {};
        returnChartObject.labels = labelData;
        returnChartObject.datasets = [];

        let datasetObject = {};
        datasetObject.totalOpened = new Array(dateArray.length).fill(0);
        datasetObject.totalClosed = new Array(dateArray.length).fill(0);
        datasetObject.netOpened = new Array(dateArray.length).fill(0);

        let repoDatasetsObject = {};

        for (let i = 0; i < dateArray.length; i++) {
            let dataPointVisitor = dataPointArray[i];
            for (let dataPointLabel in dataPointVisitor) {
                let dataPointSpecificValue = dataPointVisitor[dataPointLabel];
                if (dataPointLabel == "aggregateData") {
                    datasetObject.totalOpened[i] = dataPointSpecificValue.opened;
                    datasetObject.totalClosed[i] = dataPointSpecificValue.closed;
                    datasetObject.netOpened[i] = dataPointSpecificValue.opened + dataPointSpecificValue.closed;
                } else {
                    let openedInputName = dataPointLabel + " - opened";
                    let closedInputName = dataPointLabel + " - closed";
                    if (!repoDatasetsObject[openedInputName]) {
                        repoDatasetsObject[openedInputName] = new Array(dateArray.length).fill(0);
                    }
                    if (!repoDatasetsObject[closedInputName]) {
                        repoDatasetsObject[closedInputName] = new Array(dateArray.length).fill(0);
                    }
                    repoDatasetsObject[openedInputName][i] = dataPointSpecificValue.opened;
                    repoDatasetsObject[closedInputName][i] = dataPointSpecificValue.closed;
                }
            }
        }

        // Process array into the chart data format below and then send off the results

        let chartReturnDatasets = [];
        // Left out aggregate counts since it got too busy with them
        // chartReturnDatasets.push({ data: datasetObject.totalOpened, label: "Total opened", type: "line", fill: false, yAxisID: "line-y-axis" });
        // chartReturnDatasets.push({ data: datasetObject.totalClosed, label: "Total closed", type: "line", fill: false, yAxisID: "line-y-axis" });
        // chartReturnDatasets.push({ data: datasetObject.netOpened, label: "Net opened", type: "line", fill: false, yAxisID: "line-y-axis" });

        for (let chartDataLabel in repoDatasetsObject) {
            chartReturnDatasets.push({ data: repoDatasetsObject[chartDataLabel], label: chartDataLabel });
        }


        return { datasets: chartReturnDatasets, labels: labelData };
    }

    async getUserOpenedPieGraphData(queryData) {
        // Get User Data
        var inUser = (await this.UserDetails.find({ username: queryData.username }).populate('issueLabels').populate('repos'))[0];

        if (inUser == null) {
            throw "User can't be found";
        }

        let startDate = new Date(queryData.startDate);
        let endDate = new Date(queryData.endDate);

        let totalDateTimeDifference = endDate.getTime() - startDate.getTime();
        let totalDateDayDifference = totalDateTimeDifference / (1000 * 60 * 60 * 24);

        let inputPeriod = totalDateDayDifference;

        // Get issue query data
        let [firstFindQuery, firstSortQuery, limitNum, skipNum, commentsNeeded] = this.getQueryInputs(queryData, inUser);

        let totalIssueRepoData = await this.getUserActivityData(endDate, inputPeriod, firstFindQuery, queryData.names);

        delete totalIssueRepoData.aggregateData;

        let returnDataArray = [];
        let returnLabelArray = [];

        for (let repoLabel in totalIssueRepoData) {
            returnDataArray.push(totalIssueRepoData[repoLabel].opened);
            returnLabelArray.push(repoLabel);
        }

        return { datasets: [{ data: returnDataArray, label: "Opened Issues", hoverOffset: 4 }], labels: returnLabelArray };
    }

    async getUserClosedPieGraphData(queryData) {
        // Get User Data
        var inUser = (await this.UserDetails.find({ username: queryData.username }).populate('issueLabels').populate('repos'))[0];

        if (inUser == null) {
            throw "User can't be found";
        }

        let startDate = new Date(queryData.startDate);
        let endDate = new Date(queryData.endDate);

        let totalDateTimeDifference = endDate.getTime() - startDate.getTime();
        let totalDateDayDifference = totalDateTimeDifference / (1000 * 60 * 60 * 24);

        let inputPeriod = totalDateDayDifference;

        // Get issue query data
        let [firstFindQuery, firstSortQuery, limitNum, skipNum, commentsNeeded] = this.getQueryInputs(queryData, inUser);

        let totalIssueRepoData = await this.getUserActivityData(endDate, inputPeriod, firstFindQuery, queryData.names);

        delete totalIssueRepoData.aggregateData;

        let returnDataArray = [];
        let returnLabelArray = [];

        for (let repoLabel in totalIssueRepoData) {
            returnDataArray.push(-totalIssueRepoData[repoLabel].closed);
            returnLabelArray.push(repoLabel);
        }

        return { datasets: [{ data: returnDataArray, label: "Closed Issues", hoverOffset: 4 }], labels: returnLabelArray };
    }

    // Highlight functions

    async getTopIssueOpeners(startDate, endDate, firstFindQuery) {
        let countData = await this.IssueDetails.aggregate([
            {
                "$match": firstFindQuery,
            },
            {
                "$match": {
                    "created_at": {
                        "$lt": endDate,
                        "$gt": startDate,
                    },
                }
            },
            {
                "$group": {
                    _id: "$user.login",
                    count: { "$count": {} },
                }
            },
            {
                "$sort": {
                    "count": -1
                }
            },
            {
                "$limit": 5,
            },
        ])
        return countData;
    }

    async getTopIssueClosers(startDate, endDate, firstFindQuery) {
        let countData = await this.IssueDetails.aggregate([
            {
                "$match": firstFindQuery,
            },
            {
                "$match": {
                    "created_at": {
                        "$lt": endDate,
                        "$gt": startDate,
                    },
                    "state": "closed",
                    // "closed_by.login" : {
                    //     "$ne": "",
                    // }
                }
            },
            {
                "$group": {
                    _id: "$closed_by.login",
                    count: { "$count": {} },
                }
            },
            {
                "$sort": {
                    "count": -1
                }
            },
            {
                "$limit": 5,
            },
        ])
        return countData;
    }

    async getTopIssueCommenters(startDate, endDate, firstFindQuery) {
        let countData = await this.IssueCommentDetails.aggregate([
            {
                "$match": firstFindQuery
            },
            {
                "$match": {
                    "created_at": {
                        "$lt": endDate,
                        "$gt": startDate,
                    },
                }
            },
            {
                "$group": {
                    _id: "$user.login",
                    count: { "$count": {} },
                }
            },
            {
                "$sort": {
                    "count": -1
                }
            },
            {
                "$limit": 5,
            },
        ])
        return countData;
    }

    async getTopIssueOpenersHighlightData(queryData) {
        // Get User Data
        var inUser = (await this.UserDetails.find({ username: queryData.username }).populate('issueLabels').populate('repos'))[0];

        if (inUser == null) {
            throw "User can't be found";
        }

        let startDate = new Date(queryData.startDate);
        let endDate = new Date(queryData.endDate);

        // Get issue query data
        let [firstFindQuery, firstSortQuery, limitNum, skipNum, commentsNeeded] = this.getQueryInputs(queryData, inUser);

        let queryResult = await this.getTopIssueOpeners(startDate, endDate, firstFindQuery);

        return queryResult;
    }

    async getTopIssueClosersHighlightData(queryData) {
        // Get User Data
        var inUser = (await this.UserDetails.find({ username: queryData.username }).populate('issueLabels').populate('repos'))[0];

        if (inUser == null) {
            throw "User can't be found";
        }

        let startDate = new Date(queryData.startDate);
        let endDate = new Date(queryData.endDate);

        // Get issue query data
        let [firstFindQuery, firstSortQuery, limitNum, skipNum, commentsNeeded] = this.getQueryInputs(queryData, inUser);

        let queryResult = await this.getTopIssueClosers(startDate, endDate, firstFindQuery);

        return queryResult;
    }

    async getTopIssueCommentersHighlightData(queryData) {
        // Get User Data
        var inUser = (await this.UserDetails.find({ username: queryData.username }).populate('issueLabels').populate('repos'))[0];

        if (inUser == null) {
            throw "User can't be found";
        }

        let startDate = new Date(queryData.startDate);
        let endDate = new Date(queryData.endDate);

        // Get issue query data
        let [firstFindQuery, firstSortQuery, limitNum, skipNum, commentsNeeded] = this.getQueryInputs(queryData, inUser);

        let queryResult = await this.getTopIssueCommenters(startDate, endDate, firstFindQuery);

        return queryResult;
    }

    async getOpenIssuesKeyNumberValue(startDate, endDate, firstFindQuery) {
        let countData = await this.IssueDetails.aggregate([
            {
                "$match": firstFindQuery,
            },
            {
                "$match": {
                    "created_at": {
                        "$lt": endDate,
                        "$gt": startDate,
                    },
                }
            },
            {
                "$count": "resultCount"
            }
        ])
        if (countData[0]) {
            return countData[0].resultCount;
        } else {
            return 0;
        }
    }

    async getClosedIssuesKeyNumberValue(startDate, endDate, firstFindQuery) {
        let countData = await this.IssueDetails.aggregate([
            {
                "$match": firstFindQuery,
            },
            {
                "$match": {
                    "closed_at": {
                        "$lt": endDate,
                        "$gt": startDate,
                    },
                }
            },
            {
                "$count": "resultCount"
            }
        ])
        if (countData[0]) {
            return countData[0].resultCount;
        } else {
            return 0;
        }
    }

    async getCommentsKeyNumberValue(startDate, endDate, firstFindQuery) {
        let countData = await this.IssueCommentDetails.aggregate([
            {
                "$match": firstFindQuery,
            },
            {
                "$match": {
                    "created_at": {
                        "$lt": endDate,
                        "$gt": startDate,
                    },
                }
            },
            {
                "$count": "resultCount"
            }
        ])
        if (countData[0]) {
            return countData[0].resultCount;
        } else {
            return 0;
        }
    }

    async getOpenIssuesKeyNumber(queryData) {
        // Get User Data
        var inUser = (await this.UserDetails.find({ username: queryData.username }).populate('issueLabels').populate('repos'))[0];

        if (inUser == null) {
            throw "User can't be found";
        }

        let startDate = new Date(queryData.startDate);
        let endDate = new Date(queryData.endDate);

        // Get issue query data
        let [firstFindQuery, firstSortQuery, limitNum, skipNum, commentsNeeded] = this.getQueryInputs(queryData, inUser);

        let queryResult = await this.getOpenIssuesKeyNumberValue(startDate, endDate, firstFindQuery);

        return queryResult;
    }

    async getClosedIssuesKeyNumber(queryData) {
        // Get User Data
        var inUser = (await this.UserDetails.find({ username: queryData.username }).populate('issueLabels').populate('repos'))[0];

        if (inUser == null) {
            throw "User can't be found";
        }

        let startDate = new Date(queryData.startDate);
        let endDate = new Date(queryData.endDate);

        // Get issue query data
        let [firstFindQuery, firstSortQuery, limitNum, skipNum, commentsNeeded] = this.getQueryInputs(queryData, inUser);

        let queryResult = await this.getClosedIssuesKeyNumberValue(startDate, endDate, firstFindQuery);

        return queryResult;
    }

    async getCommentsKeyNumber(queryData) {
        // Get User Data
        var inUser = (await this.UserDetails.find({ username: queryData.username }).populate('issueLabels').populate('repos'))[0];

        if (inUser == null) {
            throw "User can't be found";
        }

        let startDate = new Date(queryData.startDate);
        let endDate = new Date(queryData.endDate);

        // Get issue query data
        let [firstFindQuery, firstSortQuery, limitNum, skipNum, commentsNeeded] = this.getQueryInputs(queryData, inUser);

        let queryResult = await this.getCommentsKeyNumberValue(startDate, endDate, firstFindQuery);

        return queryResult;
    }

}

module.exports = WebDataHandler;