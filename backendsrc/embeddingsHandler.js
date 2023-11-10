const pythonWorkerHandler = require('./pythonWorkerHandler');
const { MilvusClient, DataType, ConsistencyLevelEnum, MetricType } = require("@zilliz/milvus2-sdk-node");
const zmq = require('zeromq');

class embeddingsHandler {

    static embeddingDimensions = 384;

    static milvusFields = [
        {
            name: "issue_db_id",
            data_type: DataType.VarChar,
            max_length: 256,
            is_primary_key: true,
            description: "",
        },
        {
            name: "issue_title_embedding",
            data_type: DataType.FloatVector,
            description: "",
            dim: embeddingsHandler.embeddingDimensions,
        },
    ];

    static milvusIndexFields = {
        metric_type: "L2",
        index_type: "IVF_FLAT",
        params: JSON.stringify({ nlist: 1024 }),
    };

    constructor() {
        // Set up Python Worker 
        this.sock = new zmq.Request;
        this.pythonWorker = new pythonWorkerHandler(this.sock);

        // Set up Milvus Client
        const address = "standalone:19530";
        const username = "root";
        const password = "password";

        this.loadedCollection = null;

        this.milvusClient = new MilvusClient({ address });
    }

    getCollectionName(repoRef) {
        return "r" + repoRef.toString();
    }

    async addEmbedding(inputIssue) {
        // Get embedding from Python Worker
        const embedding = await this.pythonWorker.getEmbedding(inputIssue.title);

        const collectionName = this.getCollectionName(inputIssue.repoRef);

        // Check if collection exists
        let collectionExists = await this.milvusClient.hasCollection({
            collection_name: collectionName,
        });

        // let dropResult = await this.milvusClient.dropCollection({
        //     collection_name: collectionName,
        // });

        // Create collection if it doesn't exist
        if (!collectionExists.value) {
            await this.milvusClient.createCollection({
                collection_name: collectionName,
                description: "GitHub Issue title embeddings",
                fields: embeddingsHandler.milvusFields,
            });

            await this.milvusClient.createIndex({
                collection_name: collectionName,
                field_name: "issue_title_embedding",
                extra_params: embeddingsHandler.milvusIndexFields,
            });
        }

        let insertResult = await this.milvusClient.upsert({
            collection_name: collectionName,
            fields_data: [
                {
                    issue_db_id: inputIssue._id.toString(),
                    issue_title_embedding: embedding,
                },
            ],
        });

        return true;
    }

    async removeEmbedding(inputIssue) {
        const collectionName = this.getCollectionName(inputIssue.repoRef);

        let deleteResult = await this.milvusClient.delete({
            collection_name: collectionName,
            expr: "issue_db_id in " + inputIssue._id.toString(),
        });

        let connectionStats = await this.milvusClient.getCollectionStatistics({
            collection_name: collectionName,
        });

        if (connectionStats.row_count == 0) {
            await milvusClient.dropCollection({
                collection_name: collectionName,
            });
        }

        return true;
    }

    async removeRepoEmbeddings(inputRepoRef) {
        const collectionName = this.getCollectionName(inputRepoRef);

        let deleteResult = await this.milvusClient.dropCollection({
            collection_name: collectionName,
        });

        return true;
    }

    async loadCollection(collectionName) {
        // Does release collection happen automatically? Will need to test...
        if (this.loadedCollection != collectionName) {

            if (this.loadedCollection != null) {
                let releaseResults = await this.milvusClient.releaseCollection({
                    collection_name: this.loadedCollection,
                });
            }

            let loadCollectionResults = await this.milvusClient.loadCollection({
                collection_name: collectionName,
            });
            this.loadedCollection = collectionName;
        }

    }

    async removeRepo(inputRepoRef) {
        const collectionName = this.getCollectionName(inputRepoRef);

        let deleteResult = await this.milvusClient.dropCollection({
            collection_name: collectionName,
        });

        return true;
    }

    async flush(inputRepoRef) {
        const collectionName = this.getCollectionName(inputRepoRef);
        return await this.milvusClient.flushSync({
            collection_names: [collectionName],
        });
    }

    async getSimilarIssueIDs(inputIssue) {
        const collectionName = this.getCollectionName(inputIssue.repoRef);

        console.log("Start embedding search for issue: " + inputIssue._id.toString());

        const inputVector = await this.pythonWorker.getEmbedding(inputIssue.title);

        const searchParams = {
            params: { nprobe: 1024 }
        };

        console.log("Loading collection");

        await this.loadCollection(collectionName);

        console.log("Executing search");
        const queryResult = await this.milvusClient.search({
            collection_name: collectionName,
            vector: inputVector,
            limit: 10,
            metric_type: MetricType.L2,
            param: searchParams,
            consistency_level: ConsistencyLevelEnum.Strong,
            expr: 'issue_db_id != "' + inputIssue._id.toString() + '"'
        });

        if (queryResult.status.error_code != "Success") {
            throw "Error came back from milvus client"
        }

        let connectionStats = await this.milvusClient.getCollectionStatistics({
            collection_name: collectionName,
        });

        return queryResult.results;
    }

}

module.exports = embeddingsHandler;