// These are one off scripts to help with things like database migrations etc.
module.exports = {
    async AddEmbeddingsToIssuesInRepo(inIssueDetails, inEmbeddingsHandler, inRepo) {
        try {

            let issueList = await inIssueDetails.find({ repoRef: inRepo._id });
            for (let i = 0; i < issueList.length; i++) {
                let issue = issueList[i];
                await inEmbeddingsHandler.addEmbedding(issue);
                let findSimilarResults = await inEmbeddingsHandler.getSimilarIssueIDs(issue);
            }

        }
        catch (err) {
            console.log(err);
        }
    }
}
