const { Pinecone } = require("@pinecone-database/pinecone");
const { OpenAIClient, AzureKeyCredential } = require("@azure/openai");
const { getEncoding } = require("js-tiktoken")
const { Semaphore } = require("async-mutex");

class embeddingsHandler {

    static embeddingDimensions = 3072;

    static indexName = "gitgudissues";

    constructor(inConfigObject) {
        // Set up azureClient and Pinecone 
        this.azureClient = new OpenAIClient(inConfigObject.azureEndpointURL, new AzureKeyCredential(inConfigObject.azureOpenAIAPIKey), {apiVersion: "2023-05-15"});
        this.pinecone = new Pinecone({
            environment: "gcp-starter",
            apiKey: inConfigObject.pineconeAPIKey,
        });
        this.index = this.pinecone.Index(embeddingsHandler.indexName);
        this.maxConcurrentRequests = 1;
        this.pineconeSemaphore = new Semaphore(this.maxConcurrentRequests);
        this.azureSemaphore = new Semaphore(this.maxConcurrentRequests);
    }

    async addEmbedding(inputIssue) {
        const enc = getEncoding("cl100k_base");

        // Get embeddings from Azure OpenAI Embeddings model
        const description = ['# ' + inputIssue.title + '\n\n' + inputIssue.body];

        const encoding = enc.encode(description[0]);
                if (encoding.length > 8192) {
                    description[0] = enc.decode(encoding.slice(0, 8000));
                }

        // if (inputIssues.length != 0) {
        //     const descriptions = inputIssues.map(issue => '# ' + issue.title + '\n\n' + issue.body);

            // Check description and truncate if greater than 8192 tokens
            // for (let i = 0; i < descriptions.length; i++) {
            //     const encoding = enc.encode(descriptions[i]);
            //     if (encoding.length > 8192) {
            //         descriptions[i] = enc.decode(encoding.slice(0, 8000));
            //     }
            // }
            
        let embeddingObject = null ;
            
        try { 
            await this.azureSemaphore.runExclusive(async () => {
                embeddingObject = await this.azureClient.getEmbeddings("issue-body-embeddings-model", description);
            });
        } catch (error) {
            console.log(error);
        }

        let embedding = embeddingObject.data[0].embedding;

        // if (!issuesByRepo[inputIssue.repoRef.toString()]) {
        //     issuesByRepo[inputIssue.repoRef.toString()] = [];
        // }
        // issuesByRepo[inputIssue.repoRef.toString()].push({
        //     id: inputIssue._id.toString(),
        //     values: embedding,
        // });

        let payload = {
            id: inputIssue._id.toString(),
            values: embedding,
        }

        console.log("Upserting embeddings for issue number: " + inputIssue.number);
        return await this.pineconeSemaphore.runExclusive(async () => {
            console.log("Semaphore acquired for issue number: " + inputIssue.number);
            await this.index.namespace(inputIssue.repoRef.toString()).upsert([payload]);
        });

        // Get list of issues grouped by repoRef with embeddings added
            // for (let i = 0; i < inputIssues.length; i++) {
            //     let issue = inputIssues[i];
            //     let embedding = embeddings.data[i].embedding;
            //     if (!issuesByRepo[issue.repoRef.toString()]) {
            //         issuesByRepo[issue.repoRef.toString()] = [];
            //     }
            //     issuesByRepo[issue.repoRef.toString()].push({
            //         id: issue._id.toString(),
            //         values: embedding,
            //     });
            // }

            // Upsert embeddings into Pinecone
        // for (const [repoRef, issues] of Object.entries(issuesByRepo)) {
        //     console.log("Upserting embeddings for issue number: " + issues[0].number);
        //     return await this.pineconeSemaphore.runExclusive(async () => {
        //         console.log("Semaphore acquired for issue number: " + issues[0].number);
        //         await this.index.namespace(repoRef).upsert(issues);
        //     });
        // }

        return true;
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
        // Create title + body description
        const description = ['# ' + issueTitle + '\n\n' + issue.body];
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