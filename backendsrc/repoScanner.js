const helperFunctions = require('./helpers');

class repoScanner {

    constructor(inRepoDetails, inIssueDetails, inIssueCommentDetails, inUserDetails, inIssueCommentMentionDetails, inIssueReadDetails) {
        this.RepoDetails = inRepoDetails;
        this.IssueDetails = inIssueDetails;
        this.IssueCommentDetails = inIssueCommentDetails;
        this.IssueCommentMentionDetails = inIssueCommentMentionDetails;
        this.UserDetails = inUserDetails;
        this.IssueReadDetails = inIssueReadDetails;

        this.scans = {};
    }

    async scanUserForMentions(inUser, inRepo) {
        if (this.scans[inUser._id + inRepo._id] == true) {
            return false;
        }

        this.scans[inUser._id + inRepo._id] = true;

        // Find last mentioned date to see if user mentions exist
        let lastUpdatedAtDate = new Date('1/1/1900');

        let lastIssueCommentMention = (await this.IssueCommentMentionDetails.find({ userRef: inUser._id, repoRef: inRepo._id }).sort({ 'mentionedAt': -1 }).limit(1))[0];

        if (lastIssueCommentMention != null) {
            lastUpdatedAtDate = lastIssueCommentMention.mentionedAt;
        }


        for await (const issueItem of this.IssueDetails.find({ repoRef: inRepo._id })) {
            // For each issue, get list of mentions and then create new mention
            await issueItem.populate('issueCommentsArray');

            let authorName = issueItem.user.login;
            let authorUser = await this.UserDetails.findOne({ "githubUsername": authorName });

            if (authorUser != null) {
                await helperFunctions.UpdateIssueRead(this.IssueReadDetails, issueItem, authorUser, issueItem.created_at);
            }

            // Get list of mentions
            let issueBodyMentionsArray = helperFunctions.GetMentions(issueItem.body);

            let issueMentionInsertCount = await helperFunctions.CreateMentionsFromIssueList(issueBodyMentionsArray, this.IssueCommentMentionDetails, this.UserDetails, this.IssueReadDetails, issueItem);

            // For each comment in this issue, do the scan as well
            for (let i = 0; i < issueItem.issueCommentsArray.length; i++) {
                let issueCommentItem = issueItem.issueCommentsArray[i];

                let authorName = issueCommentItem.user.login;
                let authorUser = await this.UserDetails.findOne({ "githubUsername": authorName });

                if (authorUser != null) {
                    await helperFunctions.UpdateIssueRead(this.IssueReadDetails, issueItem, authorUser, issueCommentItem.updated_at);
                }

                let commentBodyMentionsArray = helperFunctions.GetMentions(issueCommentItem.body);
                let commentMentionInsertCount = await helperFunctions.CreateMentionsFromCommentList(commentBodyMentionsArray, this.IssueCommentMentionDetails, this.UserDetails, this.IssueReadDetails, issueItem, issueCommentItem);
            }
        }

        console.log("Done scanning " + inRepo.shortURL + " - " + inUser.username);

        return true;
    }
}

module.exports = repoScanner;