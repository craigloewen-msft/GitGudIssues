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

    static indexName = "gitgudissues-hybrid";

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
                },
                {
                    type: "Edm.String",
                    name: "issue_title",
                    searchable: true,
                },
                {
                    type: "Edm.String",
                    name: "issue_body",
                    searchable: true,
                },
                {
                    type: "Edm.String",
                    name: "repo_id",
                    filterable: true,
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
            semanticSettings: {
                defaultConfiguration: "semantic-search-configuration",
                configurations: [
                    {
                        name: "semantic-search-configuration",
                        prioritizedFields: {
                            titleField: { name: "issue_title" },
                            prioritizedContentFields: [{ name: "issue_body" }], 
                            //Content fields
                        }
                    }
                ]
            }
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
                issue_title: inputIssue.title.toString(),
                issue_body: inputIssue.body.toString().substring(0, 2048),
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
                issue_title: issue.title.toString(),
                issue_body: issue.body.toString().substring(0, 2048),
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

        let searchFilter = `repo_id eq '${repo._id.toString()}'`;

        if (issue) {
            searchFilter += ` and issue_id ne '${issue._id.toString()}'`;
        }

        const searchResults = await searchClient.search(issueTitle, {
            // Filter to not include input issue
            filter: searchFilter,
            vectorQueries: [
                {
                    kind: "vector",
                    fields: ["title_vector"],
                    kNearestNeighborsCount: 5,
                    vector: inputVector,
                },
            ],
            captions: "extractive|highlight-true",
            highlightPreTag: "<strong>",
            highlightPostTag: "</strong>",
            queryType: "semantic",
            queryLanguage: "en-us",
            semanticQuery: "semantic-search-configuration",
            // top: 3,
        });

        // So far returns worse results? 
        // Searches to try:
        // http://localhost:8080/api/getsimilarissues/microsoft/WSL/can%20i%20upgrade%20to%206%20kernel
        // http://localhost:8080/api/getsimilarissues/microsoft/WSL/WSL%20distros%20cannot%20access%20files%20within%20a%20Dev%20Drive

        let formattedResults = [];
        for await (const result of searchResults.results) {
            // Create a new object that is a clone of result
            formattedResults.push({
                issue_id: result.document.issue_id,
                issue_title: result.document.issue_title,
                repo_id: result.document.repo_id,
                score: result.score,
                highlights: result.highlights,
                rerankerScore: result.rerankerScore,
                captions: result.captions,
            });
        }

        return formattedResults;
    }

}

module.exports = embeddingsHandler;