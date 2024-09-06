const { OpenAIClient, AzureKeyCredential } = require("@azure/openai");
const { GetRepoLabels } = require('./helpers');

class aiLabelHandler {

    static deploymentId = "auto-label-test";

    constructor(inConfigObject) {
        // Set up azureClient and Pinecone 
        this.maxConcurrentRequests = 1;
        this.azureSemaphore = new Semaphore(this.maxConcurrentRequests);

        this.debugDisableAILabels = inConfigObject.debugDisableAILabels;
        if (!this.debugDisableAILabels) {
            this.azureClient = new OpenAIClient(inConfigObject.azureEndpointURL, new AzureKeyCredential(inConfigObject.azureOpenAIAPIKey), { apiVersion: "2024-04-01-preview" });
        }
    }

    async generateAILabels(repoName, issueTitle, issueBody) {

        const labels = await GetRepoLabels(repoName);

        let messages = [
            {
                role: "system", content: `Your task is to apply labels to the incoming GitHub issue. Do not output anything else besides the label output that is requested by the user.`
            },
            {
                role: "user", content: `Please help me label an incoming GitHub issue.

Here is the list of labels that you have available to you.
They are listed in priority order (So most used labels are at the top, least used are at the bottom).
Each label has its name in bold, and then a description of when it should be applied afterwards.

${labelsString}

And here is the issue info:

# Issue info:

**Title:** ${issueTitle}

${issueBody}

# Final instructions

Please output the labels that you think should be applied to this issue.
Only use the labels that are in the list above.
Output them as a comma seperated list, with no spaces between labels, and with 'Output labels:' infront. Output nothing else.

Example output: \`Output Labels: Label A, Label B, Label C\`

Now please give your output below.` }
        ];
        try {
            const result = await this.azureClient.chat.completions.create({
                deploymentId: deploymentId,
                messages: messages,
                temperature: 0.001,
                model: "",
            });
            return result.choices[0].message.content;
        } catch (error) {
            console.error('Error getting labels from Azure OpenAI:', error);
            return '';
        }
    }
}

module.exports = aiLabelHandler;