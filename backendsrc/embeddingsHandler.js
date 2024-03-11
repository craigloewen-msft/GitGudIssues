const { Pinecone } = require("@pinecone-database/pinecone");
const { OpenAIClient, AzureKeyCredential } = require("@azure/openai");

class embeddingsHandler {

    static embeddingDimensions = 384;

    static indexName = "gitgudissues";

    constructor(inConfigObject) {
        // Set up azureClient and Pinecone 
        this.azureClient = new OpenAIClient(inConfigObject.azureEndpointURL, new AzureKeyCredential(inConfigObject.azureOpenAIAPIKey), {apiVersion: "2023-05-15"});
        this.pinecone = new Pinecone({
            environment: "gcp-starter",
            apiKey: inConfigObject.pineconeAPIKey,
        });
        this.index = this.pinecone.Index(embeddingsHandler.indexName);
    }

    async addMultipleEmbeddings(inputIssues) {
        // Get embeddings from Azure OpenAI Embeddings model

        if (inputIssues.length != 0) {
            const descriptions = inputIssues.map(issue => '### Title\n\n' + issue.title + '\n\n' + issue.body);
            const embeddings = await this.azureClient.getEmbeddings("issue-body-embeddings-model", descriptions);

            // Get list of issues grouped by repoRef with embeddings added
            let issuesByRepo = {};
            for (let i = 0; i < inputIssues.length; i++) {
                let issue = inputIssues[i];
                let embedding = embeddings.data[i].embedding;
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

        // If any of the issue ids are the same as the input issue id, remove them
        if (issue) {
            searchResults.matches = searchResults.matches.filter(match => match.id != issue._id.toString());
        }

        // If the searchResults are longe than 5 get rid of the last one
        if (searchResults && searchResults.matches.length > numberOfReturnedIssues) {
            searchResults.matches.pop();
        }

        let formattedResults = [];
        for await (const result of searchResults.matches) {
            formattedResults.push({
                score: result.score,
                id: result.id
            });
        }

        // let describeIndex = await this.index.describeIndexStats();

        return formattedResults;
    }

}

module.exports = embeddingsHandler;