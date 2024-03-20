const { OpenAIClient, AzureKeyCredential } = require("@azure/openai");

class aiCompletionsHandler {
    constructor(inConfigObject) {
        this.client = new OpenAIClient(
            inConfigObject.aiCompletionsEndpoint,
            // "https://<resource name>.openai.azure.com/",
            new AzureKeyCredential(inConfigObject.aiCompletionsKey)
        );
        this.deploymentID = inConfigObject.aiCompletionsDeploymentID;
    }

    formatIssueIntoPrompt(inIssue) {
        let promptString = `Your job is to determine the labels for the following GitHub Issue. 
You will be given info on the issue title and body, as well as the labels and when to apply them for the repository.
Only add labels when you are sure that the description of the label applies correctly to the issue, and add multiple labels as necessary. 
DO NOT add any labels that are not given to you in the 'Repository labels list'. 
Your output should be a comma separated list of labels, such as: 'bug,network,performance'.

==== Issue Title ====
${inIssue.title}

==== Issue Body ====
${inIssue.body.substring(0, 2000)}

==== Repository labels and descriptions of when to apply them ====
Area-User Interface: The issue is related to the user interface
Issue-Task: This is a feature request, but it doesn't need a major design
Product-Terminal: Relates to the the new Windows Terminal product
Issue-Bug: The application shouldn't be doing this or needs an investigation
Area-VT: Relates to virtual terminal sequence support
Help Wanted: Is a simple issue that we encourage the community to help with
Issue-Feature: Complex enough to require an in depth planning process and actual budgeted, scheduled work
Product-Conhost: For issues in the console codebase

==== Output labels ====`;
        return promptString;
    }

    async getAICompletion(inPrompt) {
        try {
        const { id, created, choices, usage } = await this.client.getCompletions(this.deploymentID, [inPrompt]);
        return choices[0].text;
        } catch (err) {
            console.log(err);
            return null;
        }
    }

}

module.exports = aiCompletionsHandler;