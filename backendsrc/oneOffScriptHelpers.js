// These are one off scripts to help with things like database migrations etc.
module.exports = {
    async AddEmbeddingsToIssuesInRepo(inIssueDetails, inEmbeddingsHandler, inRepo) {

        if (inRepo.shortURL == "microsoft/winget-pkgs") {
            try {
                let startPeriod = new Date((new Date().getTime() - (20 * 12 * 4 * 7 * 24 * 60 * 60 * 1000))); // 20 years ago
                let totalIssues = await inIssueDetails.countDocuments({
                    repoRef: inRepo._id,
                    created_at: { $gte: startPeriod }
                });
                console.log(`Total issues for ${inRepo.shortURL}: ${totalIssues}`)
                let pageSize = 1;
                let pages = Math.ceil(totalIssues / pageSize);
                for (let i = 0; i < pages; i++) {
                    let issueList = await inIssueDetails.find({
                        repoRef: inRepo._id,
                        created_at: { $gte: startPeriod }
                    }).sort({ number: 1 }).skip((i * pageSize)).limit(pageSize);
                    await inEmbeddingsHandler.addEmbedding(issueList[0]);
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

    async backFillAILabels(inStartDate, inIssueDetails, inRepoDetails, inRepoShortURL, inAILabelHandler) {
        try {
            let repo = await inRepoDetails.findOne({ shortURL: inRepoShortURL });

            if (!repo) {
                return;
            }

            let repoName = repo.shortURL.split("/").pop();

            let totalIssues = await inIssueDetails.countDocuments({
                repoRef: repo._id,
                created_at: { $gte: inStartDate }
            });

            console.log(`Total issues for ${inRepoShortURL}: ${totalIssues}`)
            let pageSize = 20;
            let pages = Math.ceil(totalIssues / pageSize);

            for (let i = 0; i < pages; i++) {
                let issueList = await inIssueDetails.find({
                    repoRef: repo._id,
                    created_at: { $gte: inStartDate }
                }).sort({ number: 1 }).skip((i * pageSize)).limit(pageSize);

                let labelPromises = issueList.map(async (issue) => {
                    const aiLabelsString = await inAILabelHandler.generateAILabels(repoName, issue.title, issue.body);
                    const aiLabelsData = aiLabelsString.replace(/Output labels?: /i, "").split(/[\s,]+/);
                    const aiLabels = aiLabelsData.map((label) => {
                        return label.trim();
                    });
                    console.log(`Adding AI labels for ${inRepoShortURL}, issue ${issue.number}`);
                    return inIssueDetails.updateOne({ _id: issue._id }, { $set: { aiLabels: aiLabels } });
                });

                await Promise.all(labelPromises);
                
                // If any promise wasn't returned true then throw an error
                if (labelPromises.some((result) => !result)) {
                    throw new Error("Error updating AI labels");
                }

                let percentComplete = ((i + 1) / pages) * 100;
                console.log(`Adding AI labels for ${inRepoShortURL} (${percentComplete.toFixed(2)}% complete)`);
            }

        } catch (err) {
            console.log(err);
        }
    },

    async getAILabelAccuracy(inStartDate, inEndDate, inIssueDetails, inRepoDetails, inRepoShortURL) {
        try {
            let returnStats = {};
            let initLabelStats = function (inLabel) {
                if (!returnStats[inLabel]) {
                    returnStats[inLabel] = {
                        total: 0,
                        correctlyApplied: 0,
                        incorrectlyApplied: 0, 
                        missing: 0
                    };
                }
            }

            let repo = await inRepoDetails.findOne({ shortURL: inRepoShortURL });

            if (!repo) {
                return;
            }

            let repoName = repo.shortURL.split("/").pop();

            let totalIssues = await inIssueDetails.countDocuments({
                repoRef: repo._id,
                created_at: { $gte: inStartDate, $lte: inEndDate}
            });

            console.log(`Total issues for ${inRepoShortURL}: ${totalIssues}`)
            let pageSize = 20;
            let pages = Math.ceil(totalIssues / pageSize);

            for (let i = 0; i < pages; i++) {
                let issueList = await inIssueDetails.find({
                    repoRef: repo._id,
                    created_at: { $gte: inStartDate, $lte: inEndDate}
                }).sort({ number: 1 }).skip((i * pageSize)).limit(pageSize);

                let labelPromises = issueList.map(async (issue) => {
                    let aiLabels = issue.aiLabels;
                    let actualLabels = issue.labels.map((label) => {
                        return label.name;
                    });

                    for (let j = 0; j < aiLabels.length; j++) {
                        let label = aiLabels[j];
                        initLabelStats(label);

                        if (actualLabels.includes(label)) {
                            returnStats[label].correctlyApplied++;
                        } else {
                            returnStats[label].incorrectlyApplied++;
                        }
                    }

                    for (let j = 0 ; j < actualLabels.length; j++) {
                        let label = actualLabels[j];
                        initLabelStats(label);

                        if (!aiLabels.includes(label)) {
                            returnStats[label].missing++;
                        }
                    }
                });

                await Promise.all(labelPromises);

                let percentComplete = ((i + 1) / pages) * 100;
                console.log(`Adding AI labels for ${inRepoShortURL} (${percentComplete.toFixed(2)}% complete)`);
            }

            let finalReturnObject = [];

            let returnStatsLabels = Object.keys(returnStats);
            for (let i = 0; i < returnStatsLabels.length; i++) {
                let returnLabel = returnStatsLabels[i];
                let returnLabelData = returnStats[returnLabel];

                let percentCorrect = returnLabelData.correctlyApplied * 100.0 / (returnLabelData.correctlyApplied + returnLabelData.incorrectlyApplied + returnLabelData.missing);

                returnLabelData.percentCorrect = percentCorrect;
                returnLabelData.name = returnLabel;
                finalReturnObject.push(returnLabelData);
            }

            // Sort by highest correctly applied
            finalReturnObject.sort((a, b) => {
                return b.correctlyApplied - a.correctlyApplied;
            });

            return finalReturnObject;

        } catch (err) {
            console.log(err);
        }
    }
}
