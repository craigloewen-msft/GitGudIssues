module.exports = {
    'devMongoDBConnectionString': 'mongodb://db/GithubIssueManagement',
    // secret is for jwt
    'secret': 'mysecret',
    // https://www.npmjs.com/package/express-session#user-content-secret
    'sessionSecret': 'somesessionsecret',
    // https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token
    'ghToken': null,
    'azureOpenAIAPIKey': "key",
    'azureEndpointURL' : "url",
    'pineconeAPIKey' : 'key',
    'debugDisableEmbeddings': true,
};
