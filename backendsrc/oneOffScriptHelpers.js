// These are one off scripts to help with things like database migrations etc.
module.exports = {
    async AddEmbeddingsToIssuesInRepo(inIssueDetails, inEmbeddingsHandler, inRepo) {

        if (inRepo.shortURL == "microsoft/react-native-windows") {
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
    },
    async determineIssueLabels(aiCompletionsHandler, IssueDetails, RepoDetails) {
        // Get 10 latest issues from the Terminal repo
        let repo = await RepoDetails.findOne({ shortURL: "microsoft/terminal" });
        let issues = await IssueDetails.find({ repoRef: repo._id }).sort({ number: -1 }).limit(10).skip(100);

        // For each issue, format it into a prompt and create an array of respones and issue objects
        let promptResponses = [];
        for (let i = 0; i < issues.length; i++) {
            let issue = issues[i];
            let prompt = aiCompletionsHandler.formatIssueIntoPrompt(issue);
            let issueLabelList = issue.labels.map(x => x.name);
            promptResponses.push({ inputPrompt: prompt, issue: issue, issueLabelList: issueLabelList });
        }

        // Get AI completion for each prompt
        for (let i = 0; i < promptResponses.length; i++) {
            let promptResponse = promptResponses[i];
            promptResponse.aiCompletion = await aiCompletionsHandler.getAICompletion(promptResponse.inputPrompt);
        }

        console.log(promptResponses);

    }
}
