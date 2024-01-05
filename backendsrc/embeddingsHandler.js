const pythonWorkerHandler = require('./pythonWorkerHandler');
const zmq = require('zeromq');
const { Pinecone } = require("@pinecone-database/pinecone");

class embeddingsHandler {

    static embeddingDimensions = 384;

    static indexName = "gitgudissues";

    constructor(inConfigObject) {
        // Set up Python Worker 
        this.sock = new zmq.Request;
        this.pythonWorker = new pythonWorkerHandler(this.sock);
        this.pinecone = new Pinecone({
            environment: "gcp-starter",
            apiKey: inConfigObject.pineconeAPIKey,
        });
        this.index = this.pinecone.Index(embeddingsHandler.indexName);
    }

    async addMultipleEmbeddings(inputIssues) {
        // Get embeddings from Python Worker

        if (inputIssues.length != 0) {
            const titles = inputIssues.map(issue => issue.title);
            const embeddings = await this.pythonWorker.getMultipleEmbeddings(titles);

            // Get list of issues grouped by repoRef with embeddings added
            let issuesByRepo = {};
            for (let i = 0; i < inputIssues.length; i++) {
                let issue = inputIssues[i];
                let embedding = embeddings[i];
                if (!issuesByRepo[issue.repoRef.toString()]) {
                    issuesByRepo[issue.repoRef.toString()] = [];
                }
                issuesByRepo[issue.repoRef.toString()].push({
                    id: issue._id.toString(),
                    values: embedding,
                });
            }

            // Upsert embeddings into Pinecone
            for (const [repoRef, issues] of Object.entries(issuesByRepo)) {
                await this.index.namespace(repoRef).upsert(issues);
            }

            return true;
        }
        else {
            return true;
        }

    }

    async removeEmbedding(inputIssue) {
        await this.index.namespace(inputIssue.repoRef.toString()).deleteOne(inputIssue._id.toString());

        return true;
    }

    async removeRepo(inputRepoRef) {
        await this.index.namespace(inputRepoRef.toString()).deleteAll();

        return true;
    }

    async getSimilarIssueIDs(repo, issueTitle, issue) {
        const inputVector = await this.pythonWorker.getEmbedding(issueTitle);

        let searchFilter = `repo_id eq '${repo._id.toString()}'`;

        let numberOfReturnedIssues = 5;

        if (issue) {
            searchFilter += ` and issue_id ne '${issue._id.toString()}'`;
        }

        let searchResults = await this.index.namespace(repo._id.toString()).query({
            topK: numberOfReturnedIssues + 1,
            vector: inputVector,
            includeValues: false
        });

        // If top result is the same issue, remove it
        if (issue && searchResults && searchResults.matches[0] && searchResults.matches[0].id == issue._id.toString()) {
            searchResults.matches.shift();
        } else {
            // If the searchResults are longe than 5 get rid of the last one
            if (searchResults && searchResults.matches.length > numberOfReturnedIssues) {
                searchResults.matches.pop();
            }
        }

        let formattedResults = [];
        for await (const result of searchResults.matches) {
            formattedResults.push({
                score: result.score,
                id: result.id
            });
        }

        return formattedResults;
    }

}

module.exports = embeddingsHandler;