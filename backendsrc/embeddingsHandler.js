const pythonWorkerHandler = require('./pythonWorkerHandler');
const zmq = require('zeromq');
const {
    SearchClient,
    SearchIndexClient,
    SearchIndexerClient,
    AzureKeyCredential,
} = require("@azure/search-documents");

class embeddingsHandler {

    static embeddingDimensions = 384;

    static indexName = "gitgudissues";

    constructor(inConfigObject) {
        // Set up Python Worker 
        this.sock = new zmq.Request;
        this.pythonWorker = new pythonWorkerHandler(this.sock);

        this.azureSearchURL = inConfigObject.azureSearchURL;
        this.azureSearchAPIKey = inConfigObject.azureSearchAPIKey;

        this.azureSearchIndexClient = new SearchIndexClient(inConfigObject.azureSearchURL, new AzureKeyCredential(inConfigObject.azureSearchAPIKey));
    }

    async createIndexIfNeeded() {
        // TODO Need some kind of error check to not do this every time....
        // Create index 
        const result = await this.azureSearchIndexClient.createOrUpdateIndex({
            name: embeddingsHandler.indexName,
            fields: [
                {
                    type: "Edm.String",
                    name: "issue_id",
                    key: true,
                    filterable: true,
                    sortable: true,
                },
                {
                    type: "Edm.String",
                    name: "repo_id",
                    filterable: true,
                    sortable: true,
                },
                {
                    type: "Collection(Edm.Single)",
                    name: "title_vector",
                    searchable: true,
                    vectorSearchDimensions: embeddingsHandler.embeddingDimensions,
                    vectorSearchProfile: "vector-search-profile",
                },
            ],
            vectorSearch: {
                algorithms: [{ name: "vector-search-algorithm", kind: "hnsw" }],
                profiles: [
                    {
                        name: "vector-search-profile",
                        algorithm: "vector-search-algorithm",
                    },
                ],
            },
        });

        return true;
    }

    async addEmbedding(inputIssue) {
        // Get embedding from Python Worker
        const embedding = await this.pythonWorker.getEmbedding(inputIssue.title);

        const collectionName = embeddingsHandler.indexName;

        const searchClient = new SearchClient(this.azureSearchURL, collectionName, new AzureKeyCredential(this.azureSearchAPIKey));

        // Set up index 
        await this.createIndexIfNeeded(inputIssue.repoRef);

        // Add to Azure Search
        let uploadResult = await searchClient.uploadDocuments([
            {
                issue_id: inputIssue._id.toString(),
                repo_id: inputIssue.repoRef.toString(),
                title_vector: embedding,
            },
        ]);

        const uploadsSucceeded = uploadResult.results.every((result) => result.succeeded);

        return true;
    }

    async addMultipleEmbeddings(inputIssues) {
        // Get embeddings from Python Worker

        if (inputIssues.length != 0) {
            const titles = inputIssues.map(issue => issue.title);
            const embeddings = await this.pythonWorker.getMultipleEmbeddings(titles);
    
            const collectionName = embeddingsHandler.indexName;
    
            const searchClient = new SearchClient(this.azureSearchURL, collectionName, new AzureKeyCredential(this.azureSearchAPIKey));
    
            // Set up index 
            await this.createIndexIfNeeded(inputIssues[0].repoRef);
    
            // Prepare documents for upload
            const documents = inputIssues.map((issue, index) => ({
                issue_id: issue._id.toString(),
                repo_id: issue.repoRef.toString(),
                title_vector: embeddings[index],
            }));
    
            // Add to Azure Search
            let uploadResult = await searchClient.uploadDocuments(documents);
    
            const uploadsSucceeded = uploadResult.results.every((result) => result.succeeded);
    
            return uploadsSucceeded;
        }
        else {
            return true;
        }
        
    }

    async removeEmbedding(inputIssue) {
        const collectionName = this.getCollectionName(inputIssue.repoRef);
        const searchClient = new SearchClient(this.azureSearchURL, collectionName, new AzureKeyCredential(this.azureSearchAPIKey));

        let deleteResult = await searchClient.deleteDocuments([
            {
                issue_id: inputIssue._id.toString(),
            },
        ]);

        // Check if index is empty, if yes delete it
        const searchResults = await searchClient.count("*");
        if (searchResults.count == 0) {
            await this.azureSearchIndexClient.deleteIndex(collectionName);
        }

        return true;
    }

    async removeRepo(inputRepoRef) {
        const collectionName = this.getCollectionName(inputRepoRef);
        const searchClient = new SearchClient(this.azureSearchURL, collectionName, new AzureKeyCredential(this.azureSearchAPIKey));

        let deleteResult = await searchClient.deleteIndex(collectionName);

        return true;
    }

    async getSimilarIssueIDs(repo, issueTitle, issue) {
        const collectionName = embeddingsHandler.indexName;

        const inputVector = await this.pythonWorker.getEmbedding(issueTitle);

        const searchClient = new SearchClient(this.azureSearchURL, collectionName, new AzureKeyCredential(this.azureSearchAPIKey));

        let searchFilter  = `repo_id eq '${repo._id.toString()}'`;

        if (issue) {
            searchFilter += ` and issue_id ne '${issue._id.toString()}'`;
        }

        const searchResults = await searchClient.search("*", {
            // Filter to not infclude input issue
            filter: searchFilter,
            vectorQueries: [
                {
                    kind: "vector",
                    fields: ["title_vector"],
                    kNearestNeighborsCount: 10,
                    // An embedding of the query "What are the most luxurious hotels?"
                    vector: inputVector,
                },
            ],
        });

        let formattedResults = [];
        for await (const result of searchResults.results) {
            formattedResults.push({
                score: result.score,
                id: result.document.issue_id
            });
        }

        return formattedResults;
    }

}

module.exports = embeddingsHandler;