const RefreshRepoHandler = require('./refreshRepoHandler')
const RepoScanner = require('./repoScanner')
const embeddingsHandler = require('./embeddingsHandler')
const axios = require('axios');
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
const oneOffScriptHelpers = require('./oneOffScriptHelpers');

class WebDataHandler {
    constructor(inRepoDetails, inIssueDetails, inUserDetails, inSiteIssueLabelDetails, inIssueCommentDetails, inIssueCommentMentionDetails,
        inIssueReadDetails, inSearhQueryDetails, inMentionQueryDetails, inGHToken, inIssueLinkDetails) {
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
        this.IssueLinkDetails = inIssueLinkDetails;

        this.embeddingsHandler = new embeddingsHandler();
        this.refreshRepoHandler = new RefreshRepoHandler(this.RepoDetails, this.IssueDetails,
            this.IssueCommentDetails, this.UserDetails, this.IssueCommentMentionDetails, this.IssueReadDetails,
            this.ghToken, this.IssueLinkDetails, this.embeddingsHandler);
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
            console.error(`Got error while checking repo validity, error: `, error)
            return false;
        }
    }

    async refreshData(inUsername) {
        var inUser = (await this.UserDetails.find({ username: inUsername }).populate('repos'))[0];
        // Check if the thing is not updating
        for (let i = 0; i < inUser.repos.length; i++) {
            await oneOffScriptHelpers.AddEmbeddingsToIssuesInRepo(this.IssueDetails, this.embeddingsHandler, inUser.repos[i]);
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

    async refreshRepoList(inputData) {
        // Get repolist
        let repoList = await this.RepoDetails.find({ _id: { "$in": inputData.repoList } });

        for (let i = 0; i < repoList.length; i++) {
            let visitorRepo = repoList[i];
            this.refreshRepoHandler.addRepoForRefresh(visitorRepo);
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
        let readNeeded = false;

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
            // If the user searches for NONE then use special function
            if (queryData.assignee == "NONE") {
                findQuery['assignee'] = null;
            } else {
                findQuery['assignee.login'] = { "$regex": queryData.assignee, "$options": "gi" }
            }
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
                    // If the user searches for NONE then use special function
                    // Only applies to the 1 and case (Can't NONE with an AND)
                    if (andLabelList[0] == "NONE") {
                        emplaceObject.push({ "labels": { "$size": 0 } });
                    } else {
                        emplaceObject.push({ "labels": { "$elemMatch": { "name": andLabelList[0] } } });
                    }
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
        } else if (queryData.repoIDList) {
            repoQueryData = queryData.repoIDList;
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

        if (queryData.issueIDList) {
            findQuery["_id"] = { "$in": queryData.issueIDList };
        }

        // If requested, filter to a set of milestones. This obviously won't
        // work across multiple repos, unless they happen to have the same
        // milestone names.
        if (queryData.milestones) {
            // Obviously, this won't work if the milestone has a comma in it's title.
            let orMilestoneList = queryData.milestones.split(',');

            // Theoretically we should trim leading/trailing whitespace here.

            // if we actually found a milestone to filter by...
            if (orMilestoneList.length > 0) {
                // Add a clause to make sure that the issues are in at least one
                // of the requested milestones, by title of the milestone.

                let emplaceObject = [];
                andOrArrays.push(emplaceObject);
                let andObject = { "$and": [] };
                andObject["$and"].push({ "milestone.title": { "$in": orMilestoneList } });
                emplaceObject.push(andObject);
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

        if (queryData.read) {
            if (queryData.read == "unread") {
                findQuery["readByUser"] = false;
                readNeeded = true;
            } else if (queryData.read == "read") {
                findQuery["readByUser"] = true;
                readNeeded = true;
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

        return [findQuery, sortQuery, limitNum, skipNum, commentsNeeded, readNeeded];
    }

    getIssueGraphLabelsToIncludeList(queryData) {
        let labelList = [];
        if (queryData.graphLabels) {
            labelList = queryData.graphLabels.split(',');
        }
        return labelList;
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
        let [findQuery, sortQuery, limitNum, skipNum, commentsNeeded, readNeeded] = this.getQueryInputs(queryData, inUser);

        let countQueryPipeline = [];
        let issueQueryPipeline = [];

        let issueReadLookUpStage = {
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
        };

        let addIssueReadStage = {
            "$addFields": {
                "readByUser": {
                    // "$comments"
                    "$reduce": {
                        "input": "$issueReadArray", initialValue: false,
                        "in": {
                            "$cond": { "if": { "$gt": ["$$this.readAt", "$updated_at"] }, "then": true, "else": false }
                        }
                    }
                    // { "$cond": { "if": { "$gt": ["$comments", currentDate] }, "then": true, "else": false } }
                }
            }
        };

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

        if (readNeeded) {
            countQueryPipeline.push(issueReadLookUpStage, addIssueReadStage);
        }

        issueQueryPipeline.push(issueReadLookUpStage, addIssueReadStage);

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
            { "$match": findQuery },
            // { "$unwind": "$issueResult" },
            { "$sort": sortQuery },
            { "$skip": skipNum },
            { "$limit": limitNum },
            { "$project": { "body": 0 } }
        );

        var countQuery = this.IssueDetails.aggregate(countQueryPipeline);
        var issueQuery = this.IssueDetails.aggregate(issueQueryPipeline);

        var queryResults = await Promise.all([countQuery, issueQuery]);

        // Get a return array
        var returnIssueResultsArray = JSON.parse(JSON.stringify(queryResults[1]));

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
            console.error(`Repo: "${inputData.inRepoShortURL}" is not a valid Github short url`)
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
                console.log(`Input User: "${inputData.username}" already contains repo, not doing anything`)
                return false;
            }
        } else {
            console.error(`Input User: "${inputData.username}" doesn't exist.`)
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

                await this.IssueLinkDetails.deleteMany({ repoRef: inputRepo._id })
                await this.IssueCommentMentionDetails.deleteMany({ repoRef: inputRepo._id })
                await this.IssueReadDetails.deleteMany({ repoRef: inputRepo._id })
                await this.IssueCommentDetails.deleteMany({ repoRef: inputRepo._id })
                await this.IssueDetails.deleteMany({ repoRef: inputRepo._id })
                await this.RepoDetails.deleteOne({ '_id': inputRepo._id })

                await this.embeddingsHandler.removeRepo(inputRepo._id);
            }
        } else {
            return false;
        }

        return true;
    }

    transformIssueSearchLeafRecursive(findQuery, firstFindQuery) {
        for (let objectKey of Object.keys(firstFindQuery)) {
            if (objectKey != "$and" && objectKey != "$or") {
                if (objectKey != "siteIssueLabels" && objectKey != "issueReadArray" && objectKey != "issueCommentsArray" && objectKey != "readByUser") {
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
        let [firstFindQuery, firstSortQuery, limitNum, skipNum, commentsNeeded, readNeeded] = this.getQueryInputs(queryData, inUser);

        let [findQuery, sortQuery] = this.transformIssueSearchCriteriaToMentions(firstFindQuery, firstSortQuery);


        let countQueryPipeline = [];
        let mentionQueryPipeline = [];

        let issueReadLookUpStage = {
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
        };

        let addIssueReadStage = {
            "$addFields": {
                "readByUser": {
                    // "$comments"
                    "$reduce": {
                        "input": "$issueReadArray", initialValue: false,
                        "in": {
                            "$cond": { "if": { "$gt": ["$$this.readAt", "$issueResult.updated_at"] }, "then": true, "else": false }
                        }
                    }
                    // { "$cond": { "if": { "$gt": ["$comments", currentDate] }, "then": true, "else": false } }
                }
            }
        };

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

        if (readNeeded) {
            countQueryPipeline.push(issueReadLookUpStage, addIssueReadStage);
        }

        mentionQueryPipeline.push(issueReadLookUpStage, addIssueReadStage);

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
            { "$match": findQuery },
            { "$sort": sortQuery },
            { "$skip": skipNum },
            { "$limit": limitNum },
            { "$project": { "issueResult.body": 0 } },
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
            pushItem.readByUser = queryResults[1][i].readByUser;
            returnIssueResultsArray.push(pushItem);
        }

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

    // Create an array of Date values between `startDate` and `endDate`, separated
    // by `interval` days.
    getDateListBetweenDates(startDate, endDate, interval) {
        const datesList = [];
        let visitorDate = new Date(startDate);

        while (visitorDate < endDate) {
            datesList.push(new Date(visitorDate));
            visitorDate.setDate(visitorDate.getDate() + interval);
        }

        return datesList;
    }

    // Collect the active issues for a given day.
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
        // Determine the resolution in days that we should use for graphs for
        // the given date range. If the date range is fewer than 200 days, then
        // we'll return 7, for "weekly" resolution. If it's more than 200 days,
        // then return 30 for "monthly"
        let inputPeriod = 7;

        let dayDifference = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
        if (dayDifference > 200) {
            inputPeriod = 30;
        }

        return inputPeriod;
    }

    // This has to be a static method, because arrow functions (like the callers below) can't call non-static methods.
    static getDateLabel(inDate) {
        // months are 0-indexed, so add 1 so that they make sense to a human
        return (inDate.getMonth() + 1) + " " + inDate.getDate() + " " + inDate.getFullYear();
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
        let queryInputPeriod = queryData.inputPeriod;

        // Get issue query data
        let [firstFindQuery, firstSortQuery, limitNum, skipNum, commentsNeeded] = this.getQueryInputs(queryData, inUser);

        // Create a list of days to get issue data for.
        let dateArray = this.getDateListBetweenDates(startDate, endDate, queryInputPeriod == 0 ? inputPeriod : queryInputPeriod);

        let datesPromiseList = [];

        // Collect up the async functions to query the number of active issues
        // on each day in our dateArray
        for (let i = 0; i < dateArray.length; i++) {
            let inputDate = dateArray[i];
            datesPromiseList.push(this.getActiveIssues(inputDate, firstFindQuery));
        }

        let xData = await Promise.all(datesPromiseList);
        let labelData = dateArray.map((inDate) => WebDataHandler.getDateLabel(inDate));
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
        let queryInputPeriod = queryData.inputPeriod;

        // Get issue query data
        let [firstFindQuery, firstSortQuery, limitNum, skipNum, commentsNeeded] = this.getQueryInputs(queryData, inUser);
        let dateArray = this.getDateListBetweenDates(startDate, endDate, queryInputPeriod == 0 ? inputPeriod : queryInputPeriod);

        let issuesClosedPromiseList = [];
        let issuesCreatedPromiseList = [];

        for (let i = 0; i < dateArray.length; i++) {
            let inputDate = dateArray[i];
            let issueClosedPromise = this.getIssuesClosed(inputDate, queryInputPeriod == 0 ? inputPeriod : queryInputPeriod, firstFindQuery);
            let issuesCreatedPromise = this.getIssuesCreated(inputDate, queryInputPeriod == 0 ? inputPeriod : queryInputPeriod, firstFindQuery);
            issuesClosedPromiseList.push(issueClosedPromise);
            issuesCreatedPromiseList.push(issuesCreatedPromise);
        }

        let [issuesClosedData, issuesCreatedData] = await Promise.all([Promise.all(issuesClosedPromiseList), Promise.all(issuesCreatedPromiseList)]);
        let labelData = dateArray.map((inDate) => WebDataHandler.getDateLabel(inDate));
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
        let queryInputPeriod = queryData.inputPeriod;

        // Get issue query data
        let [firstFindQuery, firstSortQuery, limitNum, skipNum, commentsNeeded] = this.getQueryInputs(queryData, inUser);
        let dateArray = this.getDateListBetweenDates(startDate, endDate, queryInputPeriod == 0 ? inputPeriod : queryInputPeriod);

        let commentNumberPromiseList = [];

        for (let i = 0; i < dateArray.length; i++) {
            let inputDate = dateArray[i];
            let commentNumberPromise = this.getCommentsCreated(inputDate, queryInputPeriod == 0 ? inputPeriod : queryInputPeriod, firstFindQuery);
            commentNumberPromiseList.push(commentNumberPromise);
        }

        let xData = await Promise.all(commentNumberPromiseList);
        let labelData = dateArray.map((inDate) => WebDataHandler.getDateLabel(inDate));
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
        let labelData = dateArray.map((inDate) => WebDataHandler.getDateLabel(inDate));

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
                    "closed_at": {
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

    async getTopLinkedIssues(startDate, endDate, firstFindQuery) {
        let countData = await this.IssueDetails.aggregate([
            {
                "$match": firstFindQuery,
            },
            {
                "$lookup": {
                    "from": "issueLinkInfo",
                    "localField": "_id",
                    "foreignField": "toIssue",
                    "as": "linkedIssueList",
                    "pipeline": [
                        {
                            "$match": {
                                "linkDate": {
                                    "$lt": endDate,
                                    "$gt": startDate,
                                },
                            }
                        }
                    ],
                }
            },
            {
                "$addFields": {
                    "numberLinkedIssues": { "$size": "$linkedIssueList" }
                }
            },
            // Look up each linked issue to get their numbers to debug more
            // {
            //     "$lookup": {
            //         "from": "issueInfo",
            //         "localField": "linkedIssueList.fromIssue",
            //         "foreignField": "_id",
            //         "as": "linkedIssueInfoList",
            //     }
            // },
            {
                "$sort": {
                    "numberLinkedIssues": -1
                }
            },
            // Project only the values we care about
            {
                "$project": {
                    "_id": "$number",
                    "url": { "$concat": ["https://github.com/", { "$substr": ["$url", 29, -1] }] },
                    "count": "$numberLinkedIssues",
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

    async getTopLinkedIssuesHiglightData(queryData) {
        // Get User Data
        var inUser = (await this.UserDetails.find({ username: queryData.username }).populate('issueLabels').populate('repos'))[0];

        if (inUser == null) {
            throw "User can't be found";
        }

        let startDate = new Date(queryData.startDate);
        let endDate = new Date(queryData.endDate);

        // Get issue query data
        let [firstFindQuery, firstSortQuery, limitNum, skipNum, commentsNeeded] = this.getQueryInputs(queryData, inUser);

        let queryResult = await this.getTopLinkedIssues(startDate, endDate, firstFindQuery);

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

    async getRepoConnectedGraphData(startDate, endDate, firstFindQuery, issueGraphLabelsToIncludeList) {
        let nodesList = {};
        let linkReturnList = [];
        let nodeReturnList = [];
        let unknownNodesSearchList = [];
        let nodeIDListArray = [];
        let addedLabelList = [];
        let nodeReturnDictionary = {};

        // Get a list of issues created between two dates to get a list of all nodes created
        let initialIssueList = await this.IssueDetails.aggregate([
            {
                "$match": firstFindQuery,
            },
            {
                "$match": {
                    "created_at": {
                        "$lt": endDate,
                        "$gt": startDate,
                    }
                }
            },
            // Add issue links
            {
                "$lookup": {
                    "from": "issueLinkInfo",
                    "localField": "_id",
                    "foreignField": "toIssue",
                    "as": "linkedIssueList",
                    "pipeline": [
                        {
                            "$match": {
                                "linkDate": {
                                    "$lt": endDate,
                                    "$gt": startDate,
                                },
                            }
                        }
                    ],
                }
            },
            {
                "$addFields": {
                    "numberLinkedIssues": { "$size": "$linkedIssueList" }
                }
            },
            {
                "$project": {
                    "_id": 1,
                    "number": 1,
                    "comments": 1,
                    "labels": 1,
                    "url": 1,
                    "created_at": 1,
                }
            },
        ]);

        // Put each issue created between two dates in the "Known issue" object
        for (let i = 0; i < initialIssueList.length; i++) {
            let issueVisitor = initialIssueList[i];
            if (nodesList[issueVisitor._id.toString()] == null) {
                nodesList[issueVisitor._id.toString()] = issueVisitor;
                nodesList[issueVisitor._id.toString()].totalVal = 1;
            }
        }

        // Get a list of issue links created between two dates 
        let issueLinkList = await this.IssueLinkDetails.aggregate([
            {
                "$match": firstFindQuery,
            },
            {
                "$match": {
                    "linkDate": {
                        "$lt": endDate,
                        "$gt": startDate,
                    }
                }
            }
        ]);

        // For each link, add the link to the linked return object
        // And if the issue is unknown then add it to a list
        for (let i = 0; i < issueLinkList.length; i++) {
            let linkVisitor = issueLinkList[i];
            linkReturnList.push({ source: linkVisitor.fromIssue, target: linkVisitor.toIssue });

            if (nodesList[linkVisitor.fromIssue.toString()] == null) {
                unknownNodesSearchList.push(linkVisitor.fromIssue);
                nodesList[linkVisitor.fromIssue.toString()] = { totalVal: 1 };
            }
            if (nodesList[linkVisitor.toIssue.toString()] == null) {
                unknownNodesSearchList.push(linkVisitor.toIssue);
                nodesList[linkVisitor.toIssue.toString()] = { totalVal: 1 };
            }
        }

        // Get list of comments between dates
        let commentsList = await this.IssueCommentDetails.aggregate([
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
                "$project": {
                    "_id": 1,
                    "issueRef": 1,
                    "html_url": 1,
                    "reactions.total_count": 1,
                    "created_at": 1,
                }
            },
        ]);

        // Link each found comment to an issue and add it as a node
        for (let i = 0; i < commentsList.length; i++) {
            let commentVisitor = commentsList[i];
            let commentNode = { "id": commentVisitor._id.toString(), name: null, totalVal: 1 + commentVisitor.reactions.total_count, graphVal: 1, group: "comment", url: commentVisitor.html_url, created_at: commentVisitor.created_at };
            nodeReturnDictionary[commentNode.id] = commentNode;
            linkReturnList.push({ source: commentVisitor._id.toString(), target: commentVisitor.issueRef.toString() });

            if (nodesList[commentVisitor.issueRef.toString()] == null) {
                unknownNodesSearchList.push(commentVisitor.issueRef);
                nodesList[commentVisitor.issueRef.toString()] = { totalVal: 1 };
            }


            // Increment the totalValue of the parent node by the sum of its child
            nodesList[commentVisitor.issueRef.toString()].totalVal += commentNode.totalVal;
        }

        // Get issue info for all unknown issues
        let unknownIssueList = await this.IssueDetails.aggregate([
            {
                "$match": firstFindQuery,
            },
            {
                "$match": {
                    "_id": {
                        "$in": unknownNodesSearchList,
                    }
                }
            },
            // Add issue links
            {
                "$lookup": {
                    "from": "issueLinkInfo",
                    "localField": "_id",
                    "foreignField": "toIssue",
                    "as": "linkedIssueList",
                    "pipeline": [
                        {
                            "$match": {
                                "linkDate": {
                                    "$lt": endDate,
                                    "$gt": startDate,
                                },
                            }
                        }
                    ],
                }
            },
            {
                "$addFields": {
                    "numberLinkedIssues": { "$size": "$linkedIssueList" }
                }
            },
            {
                "$project": {
                    "_id": 1,
                    "number": 1,
                    "comments": 1,
                    "labels": 1,
                    "url": 1,
                    "created_at": 1,
                }
            },
        ]);

        for (let i = 0; i < unknownIssueList.length; i++) {
            let unknownIssueVisitor = unknownIssueList[i];
            if (nodesList[unknownIssueVisitor._id.toString()] != null) {
                let totalVal = nodesList[unknownIssueVisitor._id.toString()].totalVal;
                nodesList[unknownIssueVisitor._id.toString()] = unknownIssueVisitor;
                nodesList[unknownIssueVisitor._id.toString()].totalVal = totalVal;
            } else {
                nodesList[unknownIssueVisitor._id.toString()] = unknownIssueVisitor;
                nodesList[unknownIssueVisitor._id.toString()].totalVal = 1;
            }
        }

        // Format nodes list for return
        nodeIDListArray = Object.keys(nodesList);
        for (let i = 0; i < nodeIDListArray.length; i++) {
            let nodeVisitor = nodesList[nodeIDListArray[i]];

            let formattedURL = nodeVisitor.url.replace("https://api.github.com/repos/", "https://github.com/");

            let issueNode = { "id": nodeVisitor._id.toString(), name: nodeVisitor.number, totalVal: nodeVisitor.totalVal, graphVal: 1, group: "issue", url: formattedURL, created_at: nodeVisitor.created_at };
            nodeReturnDictionary[issueNode.id] = issueNode;

            // Add labels to node list
            for (let j = 0; j < nodeVisitor.labels.length; j++) {
                let labelVisitor = nodeVisitor.labels[j];

                let shouldProcessLabel = false;

                // Check if we should process label by checking if it is in issueGraphLabelsToIncludeList
                if (issueGraphLabelsToIncludeList.length != 0) {
                    for (let k = 0; k < issueGraphLabelsToIncludeList.length; k++) {
                        if (labelVisitor.name == issueGraphLabelsToIncludeList[k]) {
                            shouldProcessLabel = true;
                            break;
                        }
                    }
                } else {
                    // If no labels are specified then process all labels
                    shouldProcessLabel = true;
                }

                if (shouldProcessLabel) {

                    linkReturnList.push({ "source": nodeVisitor._id.toString(), "target": labelVisitor.name });

                    if (!addedLabelList.includes(labelVisitor.name)) {
                        addedLabelList.push(labelVisitor.name);
                        let labelNode = { id: labelVisitor.name, name: labelVisitor.name, totalVal: 1, graphVal: 1, group: "label" };
                        nodeReturnDictionary[labelVisitor.name] = labelNode;
                    }

                    // Add the total value of the issue to the label
                    nodeReturnDictionary[labelVisitor.name].totalVal += issueNode.totalVal;
                }
            }
        }

        for (let i = 0; i < linkReturnList.length; i++) {
            let linkVisitor = linkReturnList[i];
            let target = linkVisitor.target;
            let source = linkVisitor.source;

            let targetNode = nodeReturnDictionary[target];
            let sourceNode = nodeReturnDictionary[source];

            nodeReturnDictionary[target].graphVal = nodeReturnDictionary[target].graphVal + 1;
        }

        // Format nodes list for return
        nodeIDListArray = Object.keys(nodeReturnDictionary);
        for (let i = 0; i < nodeIDListArray.length; i++) {
            let nodeVisitor = nodeReturnDictionary[nodeIDListArray[i]];

            // Adjust the size of the node to two functions, one for smaller node sizes and one for larger node sizes
            if (nodeVisitor.totalVal < 50) {
                nodeVisitor.val = (0.2717 * nodeVisitor.totalVal + 0.64).toFixed(1);
            } else {
                nodeVisitor.val = (0.07 * nodeVisitor.totalVal + 10).toFixed(1);
            }

            // Check if created at is between input dates, if it is add a partOfQuery attribute
            if (nodeVisitor.created_at != null) {
                let createdAtDate = new Date(nodeVisitor.created_at);
                if (createdAtDate > startDate && createdAtDate < endDate) {
                    nodeVisitor.partOfQuery = true;
                } else {
                    nodeVisitor.partOfQuery = false;
                }
            } else {
                nodeVisitor.partOfQuery = false;
            }

            nodeReturnList.push(nodeVisitor);
        }

        return { nodes: nodeReturnList, links: linkReturnList };
    }

    async getRepoIssueGraphData(queryData) {
        // Get User Data
        var inUser = (await this.UserDetails.find({ username: queryData.username }).populate('issueLabels').populate('repos'))[0];

        if (inUser == null) {
            throw "User can't be found";
        }

        let startDate = new Date(queryData.startDate);
        let endDate = new Date(queryData.endDate);

        // Get issue query data
        let [firstFindQuery, firstSortQuery, limitNum, skipNum, commentsNeeded] = this.getQueryInputs(queryData, inUser);
        let issueGraphLabelsToIncludeList = this.getIssueGraphLabelsToIncludeList(queryData, inUser);

        let queryResult = await this.getRepoConnectedGraphData(startDate, endDate, firstFindQuery, issueGraphLabelsToIncludeList);

        return queryResult;
    }

    async getSimilarIssues(queryData) {
        const { organizationName, repoName, issueNumber } = queryData;

        let dbRepoName = (organizationName + "/" + repoName).toLowerCase();

        let repo = await this.RepoDetails.findOne({ shortURL: dbRepoName });
        let issue = await this.IssueDetails.findOne({ repoRef: repo._id, number: issueNumber });

        if (issue == null) {
            throw "Issue not found";
        }

        if (repo == null) {
            throw "Repo not found";
        }

        let similarIssueIDArray = await this.embeddingsHandler.getSimilarIssueIDs(issue);

        // Make a new array that finds each issue with the id specified in the array above
        let similarIssuesArray = await Promise.all(similarIssueIDArray.map(similarIssueIDObject => this.IssueDetails.findOne({ _id: similarIssueIDObject.id })));

        let returnArray = similarIssueIDArray.map((similarIssueIDObject, index) => {
            similarIssuesArray[index].body = "";
            return {
                score: similarIssueIDObject.score,
                title: similarIssuesArray[index].title,
            }
            // return {
            //     score: similarIssueIDObject.score,
            //     issue: similarIssuesArray[index]
            // }
        });

        return returnArray;
    }
}

module.exports = WebDataHandler;
