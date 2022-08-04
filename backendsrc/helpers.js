module.exports = {
    PromiseTimeout(delayms) {
        return new Promise(function (resolve, reject) {
            setTimeout(resolve, delayms);
        });
    },
    GetMentions(inputString) {
        let mentionsPattern = /\B@[a-z0-9_-]+/gi;
        if (inputString == null) {
            return null;
        }
        let mentionsArray = inputString.match(mentionsPattern);
        if (mentionsArray != null) {
            mentionsArray = mentionsArray.map(el => el.slice(1));
        }
        return mentionsArray;
    },
    CopyAllKeys(toObject, fromObject) {
        Object.keys(fromObject).forEach((key, index) => {
            toObject[key] = fromObject[key];
        });
    },
    async UpdateIssueRead(inIssueReadDetails, inIssue, inUser, inputDate) {
        let returnIssueReadList = await inIssueReadDetails.find({ issueRef: inIssue._id, userRef: inUser._id });

        let returnIssueRead = null;
        if (returnIssueReadList.length > 0) {
            returnIssueRead = returnIssueReadList.reduce((max, issueRead) => max.readAt > issueRead.readAt ? max : issueRead);
        }

        if (returnIssueRead == null) {
            returnIssueRead = await inIssueReadDetails.create({ issueRef: inIssue._id, userRef: inUser._id, readAt: inputDate, repoRef: inIssue.repoRef });
        } else {
            if (returnIssueRead.readAt < inputDate) {
                returnIssueRead.readAt = inputDate;
                await returnIssueRead.save();
            }
        }

        if (returnIssueReadList.length > 1) {
            let removeArray = returnIssueReadList.filter(issueRead => issueRead != returnIssueRead);
            await Promise.all(removeArray.map(async (issueRead) => {
                await inIssueReadDetails.deleteOne({ "_id": issueRead._id });
            }));
        }
    },
    async CreateMentionsFromIssueList(inMentionsArray, inIssueCommentMentionDetails, inUserDetails, inIssueReadDetails, inIssue) {
        if (inMentionsArray == null) {
            return 0;
        }

        let sum = 0;

        let issueURL = "https://github.com/" + inIssue.url.split("https://api.github.com/repos/").pop();

        for (let i = 0; i < inMentionsArray.length; i++) {
            let mentionItem = inMentionsArray[i];
            let mentionedUser = await inUserDetails.findOne({ 'githubUsername': mentionItem });
            if (mentionedUser) {
                sum = sum + 1;
                let mentionResult = await inIssueCommentMentionDetails.findOneAndUpdate({ 'commentRef': null, 'userRef': mentionedUser._id, 'issueRef': inIssue._id }, {
                    'commentRef': null, 'userRef': mentionedUser._id, 'issueRef': inIssue._id,
                    mentionedAt: inIssue.created_at, repoRef: inIssue.repoRef, html_url: issueURL, mentionAuthor: inIssue.user.login,
                }, { returnDocument: 'after', upsert: true });
            }
        }

        return sum;
    },
    async CreateMentionsFromCommentList(inMentionsArray, inIssueCommentMentionDetails, inUserDetails, inIssueReadDetails, inIssue, inComment) {
        if (inMentionsArray == null) {
            return 0;
        }

        let sum = 0;

        for (let i = 0; i < inMentionsArray.length; i++) {
            let mentionItem = inMentionsArray[i];
            let mentionedUser = await inUserDetails.findOne({ 'githubUsername': mentionItem });
            if (mentionedUser) {
                sum = sum + 1;
                let mentionResult = await inIssueCommentMentionDetails.findOneAndUpdate({ 'commentRef': inComment._id, 'userRef': mentionedUser._id, 'issueRef': inIssue._id }, {
                    'commentRef': inComment._id, 'userRef': mentionedUser._id, 'issueRef': inIssue._id,
                    mentionedAt: inComment.updated_at, repoRef: inComment.repoRef, html_url: inComment.html_url, mentionAuthor: inComment.user.login,
                }, { returnDocument: 'after', upsert: true });
            }
        }

        return sum;
    },
    async CreateIssueLinksFromInputText(inputText, inIssueLinkDetails, inIssueDetails, fromIssue, fromIssueRepo, inLinkDate) {
        // Prepare arguments
        let fromIssueRepoName = fromIssueRepo.shortURL.toLowerCase();
        let fromIssueID = fromIssue._id.toString();

        if (!inputText) {
            return false;
        }

        // Remove all code blocks
        inputText = inputText.replace(/```([^`]*)```/g, '');
        inputText = inputText.replace(/`([^`]+(?=`))`/g, '');
        // Get list of issues from input text
        let extractedURLList = inputText.match(/\bhttps?:\/\/github.com\/\S+/gi);
        let extractedHashtagList = inputText.match(/\B#[0-9]+(?=\s|$)/gi);

        // Put list in a {repoName: [issueNumbers]} format
        let linkedIssues = {};

        // Extract issue list from hashtags
        if (extractedHashtagList) {
            for (let i = 0; i < extractedHashtagList.length; i++) {
                let hashtagVisitor = extractedHashtagList[i];
                if (hashtagVisitor.length > 0 && hashtagVisitor.charAt(0) == "#") {
                    let issueNumber = hashtagVisitor.substring(1);
                    if (linkedIssues[fromIssueRepoName] == null) {
                        linkedIssues[fromIssueRepoName] = [];
                    }
                    linkedIssues[fromIssueRepoName].push(issueNumber);
                }
            }
        }

        // And from URLS
        if (extractedURLList) {
            for (let i = 0; i < extractedURLList.length; i++) {
                let urlVisitor = extractedURLList[i];
                let urlSplit = urlVisitor.split("/");
                let repoOwnerName = urlSplit[3];
                let repoName = urlSplit[4];
                let issueNumber = urlSplit[5];

                if (repoOwnerName) {
                    repoOwnerName = repoOwnerName.toLowerCase();
                }
                if (repoName) {
                    repoName = repoName.toLowerCase();
                }

                let repoString = repoOwnerName + "/" + repoName;

                if (Number.isFinite(issueNumber)) {
                    if (linkedIssues[repoString] == null) {
                        linkedIssues[repoString] = [];
                    }
                    linkedIssues[repoString].push(issueNumber);
                }
            }
        }

        let linkedRepoList = Object.keys(linkedIssues);
        // Iterate through our list to create links
        for (let i = 0; i < linkedRepoList.length; i++) {
            let repoVisitor = linkedRepoList[i];
            // Right now only link to internal only issues
            if (repoVisitor == fromIssueRepo.shortURL) {
                let issueNumberList = linkedIssues[repoVisitor];
                for (let j = 0; j < issueNumberList.length; j++) {
                    let issueNumberVisitor = parseInt(issueNumberList[j]);
                    let linkedToIssue = (await inIssueDetails.find({ 'number': issueNumberVisitor, 'repoRef': fromIssueRepo._id }))[0];
                    if (linkedToIssue) {
                        // Create link between issues
                        let toIssueID = linkedToIssue._id.toString();
                        let issueLinkResult = await inIssueLinkDetails.findOneAndUpdate({ 'fromIssue': fromIssueID, 'toIssue': toIssueID, 'repoRef': fromIssueRepo._id }, {
                            'fromIssue': fromIssueID, 'toIssue': toIssueID, 'repoRef': fromIssueRepo._id, linkDate: inLinkDate,
                        }, { returnDocument: 'after', upsert: true });
                    }
                }
            }
        }

        return linkedIssues;
    },
    async UpdateIssueLinksBetweenDatesFromIssues(inputRepo, beginDate, endDate, inIssueLinkDetails, inIssueDetails) {

        // Find all issue bodies sorted in ascending order by modified_at between these dates
        const cursor = inIssueDetails.find({
            'repoRef': inputRepo._id.toString(),
            "created_at": {
                "$gt": beginDate,
                "$lte": endDate
            }
        }).sort({ "updated_at": 1 }).cursor();
        for (let issueDoc = await cursor.next(); issueDoc != null; issueDoc = await cursor.next()) {
            // For each issue update all links
            await this.CreateIssueLinksFromInputText(issueDoc.body, inIssueLinkDetails, inIssueDetails, issueDoc, inputRepo, issueDoc.created_at);
        }
    },
    async UpdateIssueLinksBetweenDatesFromComments(inputRepo, beginDate, endDate, inIssueLinkDetails, inIssueDetails, inIssueCommentDetails) {

        // Find all issue comment bodies sorted in ascending order by modified_at between these dates
        const cursor = inIssueCommentDetails.find({
            'repoRef': inputRepo._id.toString(),
            "created_at": {
                "$gt": beginDate,
                "$lte": endDate
            }
        }).sort({ "updated_at": 1 }).populate("issueRef").cursor();
        for (let issueCommentDoc = await cursor.next(); issueCommentDoc != null; issueCommentDoc = await cursor.next()) {
            // For each issue update all links
            await this.CreateIssueLinksFromInputText(issueCommentDoc.body, inIssueLinkDetails, inIssueDetails, issueCommentDoc.issueRef, inputRepo, issueCommentDoc.updated_at);
        }
    },
}
