const RefreshRepoTask = require('./refreshReproTask')

class WebDataHandler {
    constructor(inRepoDetails, inIssueDetails) {
        this.RepoDetails = inRepoDetails;
        this.IssueDetails = inIssueDetails;
    }

    async refreshData(inUrl) {
        var refreshTask = new RefreshRepoTask(inUrl, this.RepoDetails, this.IssueDetails);
        await refreshTask.refreshData();
    }

}

module.exports = WebDataHandler;