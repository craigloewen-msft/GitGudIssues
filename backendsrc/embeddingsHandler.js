const { Pinecone } = require("@pinecone-database/pinecone");
const { OpenAIClient, AzureKeyCredential } = require("@azure/openai");
const { Semaphore } = require("async-mutex");
const { GetDescription } = require('./helpers');

class embeddingsHandler {

    static embeddingDimensions = 3072;

    static indexName = "gitgudissues";

    constructor(inConfigObject) {
        // Set up azureClient and Pinecone 
        this.maxConcurrentRequests = 1;
        this.pineconeSemaphore = new Semaphore(this.maxConcurrentRequests);
        this.azureSemaphore = new Semaphore(this.maxConcurrentRequests);

        this.debugDisableEmbeddings = inConfigObject.debugDisableEmbeddings;
        if (!this.debugDisableEmbeddings) {
            this.pinecone = new Pinecone({
                environment: "gcp-starter",
                apiKey: inConfigObject.pineconeAPIKey,
            });
            this.azureClient = new OpenAIClient(inConfigObject.azureEndpointURL, new AzureKeyCredential(inConfigObject.azureOpenAIAPIKey), { apiVersion: "2023-05-15" });
            this.index = this.pinecone.Index(embeddingsHandler.indexName);
        }
    }

    async addEmbedding(inputIssue) {
        try {
            // Get embeddings from Azure OpenAI Embeddings model
            const description = [GetDescription(inputIssue.title, inputIssue.body)];

            let embeddingObject = null;

            if (this.debugDisableEmbeddings) {
                return;
            }

            await this.azureSemaphore.runExclusive(async () => {
                embeddingObject = await this.azureClient.getEmbeddings("issue-body-embeddings-model", description);
            });

            let embedding = embeddingObject.data[0].embedding;

            let payload = {
                id: inputIssue._id.toString(),
                values: embedding,
            }

            return await this.pineconeSemaphore.runExclusive(async () => {
                await this.index.namespace(inputIssue.repoRef.toString()).upsert([payload]);
            });
        } catch (error) {
            console.error(error);
            throw "Can't do embedding"
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

    async getSimilarIssueIDs(repo, issueDescription, issue) {
        // Create title + body description
        const description = [issueDescription];

        if (this.debugDisableEmbeddings) {
            console.log("Embeddings are disabled")
            return [];
        }

        // Query azure for embeddings
        const inputVector = await this.azureClient.getEmbeddings("issue-body-embeddings-model", description);

        let searchFilter = `repo_id eq '${repo._id.toString()}'`;

        let numberOfReturnedIssues = 5;

        if (issue) {
            searchFilter += ` and issue_id ne '${issue._id.toString()}'`;
        }

        let searchResults = await this.index.namespace(repo._id.toString()).query({
            topK: numberOfReturnedIssues + 1,
            vector: inputVector.data[0].embedding,
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