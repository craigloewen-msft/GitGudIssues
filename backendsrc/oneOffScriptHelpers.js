// These are one off scripts to help with things like database migrations etc.
module.exports = {
    async AddEmbeddingsToIssuesInRepo(inIssueDetails, inEmbeddingsHandler, inRepo) {

        if (inRepo.shortURL == "microsoft/terminal") {
            try {
                let startPeriod = new Date((new Date().getTime() - (20 * 12 * 4 * 7 * 24 * 60 * 60 * 1000))); // 20 years ago
                let totalIssues = await inIssueDetails.countDocuments({
                    repoRef: inRepo._id,
                    created_at: { $gte: startPeriod }
                });
                let pageSize = 100;
                let pages = Math.ceil(totalIssues / pageSize);

                for (let i = 0; i < pages; i++) {
                    let issueList = await inIssueDetails.find({
                        repoRef: inRepo._id,
                        created_at: { $gte: startPeriod }
                    }).sort({ number: 1 }).skip(i * pageSize).limit(pageSize);
                    await inEmbeddingsHandler.addMultipleEmbeddings(issueList);
                    let percentComplete = ((i + 1) / pages) * 100;
                    let beginningNumber = i * pageSize + 1;
                    let endNumber = Math.min((i + 1) * pageSize, totalIssues);
                    console.log(`Adding embeddings for ${inRepo.shortURL}, numbers ${beginningNumber} to ${endNumber} (${percentComplete.toFixed(2)}% complete)`);
                }
            }
            catch (err) {
                console.log(err);
            }
        }
    }
}
