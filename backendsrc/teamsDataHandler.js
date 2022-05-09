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
        await newTeam.save();

        return newTeam;
    }

    async updateTeam(inData) {
        var inUser = (await this.UserDetails.find({ username: inData.username }).populate('teams'))[0];
        var inTeam = await this.TeamDetails.findOne({ "_id": inData._id });

        if (inUser == null || inTeam == null) {
            return false;
        }

        if (inTeam.owner._id.toString() != inUser._id.toString()) {
            return false;
        }

        let editedTeamID = inData._id;
        let editedTeam = inData;
        delete editedTeam._id;

        let updateResult = await this.TeamDetails.update({ '_id': editedTeamID }, editedTeam);

        return updateResult;
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

    async getInviteStatus(inData) {
        let inTeamID = inData.inviteID;
        var inUser = (await this.UserDetails.find({ username: inData.username }).populate('teams'))[0];
        var inTeam = await this.TeamDetails.findOne({ "_id": inTeamID });

        let returnObject = { inviteStatus: null, teamData: null };

        if (inUser == null || inTeam == null) {
            returnObject.inviteStatus = "error";
            return returnObject;
        }

        let teamMatch = inUser.teams.find(teamVisitor => teamVisitor._id.toString() == inTeam._id.toString())
        returnObject.teamData = inTeam;

        if (teamMatch != undefined) {
            returnObject.inviteStatus = "in-team";
            return returnObject;
        } else {
            returnObject.inviteStatus = "not-in-team"
            return returnObject;
        }
    }

    async addUserToTeam(inUser, inTeam) {
        if (inUser == null || inTeam == null) {
            return "error";
        }

        let teamMatch = inUser.teams.find(teamVisitor => teamVisitor._id.toString() == inTeam._id.toString())

        if (teamMatch != undefined) {
            return "in-team";
        } else {

            inTeam.users.push(inUser._id);
            await inTeam.save();

            return "success";
        }
    }

    async handleInvite(inData) {
        let inTeamID = inData.inviteID;
        var inUser = (await this.UserDetails.find({ username: inData.username }).populate('teams'))[0];
        var inTeam = await this.TeamDetails.findOne({ "_id": inTeamID });

        let inviteRequest = inData.inviteRequest;

        if (inviteRequest == "accept") {
            let teamAddResult = await this.addUserToTeam(inUser, inTeam);
            return teamAddResult;
        }

        return null;
    }

}

module.exports = TeamsDataHandler;