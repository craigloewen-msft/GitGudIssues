class TeamsDataHandler {
    constructor(inRepoDetails, inIssueDetails, inUserDetails, inSiteIssueLabelDetails, inIssueCommentDetails, inIssueCommentMentionDetails,
        inIssueReadDetails, inSearhQueryDetails, inMentionQueryDetails, inGHToken, inTeamsDetails) {
        this.RepoDetails = inRepoDetails;
        this.IssueDetails = inIssueDetails;
        this.UserDetails = inUserDetails;
        this.siteIssueLabelDetails = inSiteIssueLabelDetails;
        this.IssueCommentDetails = inIssueCommentDetails;
        this.IssueCommentMentionDetails = inIssueCommentMentionDetails;
        this.IssueReadDetails = inIssueReadDetails;
        this.SearchQueryDetails = inSearhQueryDetails;
        this.MentionQueryDetails = inMentionQueryDetails;
        this.ghToken = inGHToken;
        this.TeamDetails = inTeamsDetails;
    }

    async addNewTeam(inData) {
        var inUser = (await this.UserDetails.find({ username: inData.username }).populate('teams'))[0];

        if (inUser == null) {
            return false;
        }

        let defaultTeamData = {
            name: "New Team",
            repos: [],
            users: [inUser],
            owner: inUser,
            triageSettings: null,
        };

        let newTeam = await this.TeamDetails.create(defaultTeamData);

        return newTeam;
    }

    async getUserTeams(inData) {
        var inUser = (await this.UserDetails.find({ username: inData.username }).populate('teams').populate({ path: 'teams', populate: { path: 'users' } }).populate({ path: 'teams', populate: { path: 'repos' } }))[0];

        if (inUser == null) {
            return false;
        }

        return inUser.teams;
    }

    async deleteTeam(inData) {
        var deleteResult = await this.TeamDetails.deleteOne({ _id: inData.teamID });

        return this.getUserTeams(inData);
    }

}

module.exports = TeamsDataHandler;