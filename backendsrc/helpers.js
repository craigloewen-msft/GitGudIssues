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
                    mentionedAt: inIssue.updated_at, repoRef: inIssue.repoRef, html_url: issueURL, mentionAuthor: inIssue.user.login,
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
                    mentionedAt: inComment.updated_at, repoRef: inComment.repositoryID, html_url: inComment.html_url, mentionAuthor: inComment.user.login,
                }, { returnDocument: 'after', upsert: true });
            }
        }

        return sum;
    },
}
