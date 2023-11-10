// These are one off scripts to help with things like database migrations etc.
module.exports = {
    async AddEmbeddingsToIssuesInRepo(inIssueDetails, inEmbeddingsHandler, inRepo) {
        try {

            let issueList = await inIssueDetails.find({ repoRef: inRepo._id });
            for (let i = 0; i < issueList.length; i++) {
                console.log("Adding embedding for issue: " + issueList[i].number.toString());
                let issue = issueList[i];
                await inEmbeddingsHandler.addEmbedding(issue);
            }

        }
        catch (err) {
            console.log(err);
        }
    }
}
