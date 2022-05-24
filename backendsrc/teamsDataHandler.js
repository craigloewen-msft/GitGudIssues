class TeamsDataHandler {
    constructor(inRepoDetails, inIssueDetails, inUserDetails, inSiteIssueLabelDetails, inIssueCommentDetails, inIssueCommentMentionDetails,
        inIssueReadDetails, inSearhQueryDetails, inMentionQueryDetails, inGHToken, inTeamsDetails, inTeamTriageDetails, inWebDataHandler) {
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
        this.TeamTriageDetails = inTeamTriageDetails;
        this.WebDataHandler = inWebDataHandler;

        this.populateFullTeamsInfoObject = {
            path: 'triageList',
            match: { active: true },
            populate: [{
                path: 'participants.user',
                model: 'userInfo',
                select: ["username", "githubUsername"]
            },
            {
                path: 'participants.issueList',
                model: 'issueInfo'
            }]
        }

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

        let updateResult = await this.TeamDetails.updateOne({ '_id': editedTeamID }, editedTeam);

        return updateResult;
    }

    async getUserTeams(inData) {
        var inUser = (await this.UserDetails.find({ username: inData.username }).populate('teams').populate({ path: 'teams', populate: { path: 'users' } }).populate({ path: 'teams', populate: { path: 'repos' } }))[0];

        if (inUser == null) {
            throw "No team error";
        }

        return inUser.teams;
    }

    async getTeam(inData) {
        let inTeam = (await this.TeamDetails.find({ _id: inData.teamID }).populate('users').populate(this.populateFullTeamsInfoObject))[0];
        let inUser = (await this.UserDetails.find({ username: inData.username }).populate('teams').populate({ path: 'teams', populate: { path: 'users' } }).populate({ path: 'teams', populate: { path: 'repos' } }))[0];

        if (inTeam == null) {
            throw "Can't find return team";
        }

        let foundUserIndex = inTeam.users.findIndex(user => user.username == inData.username);

        if (foundUserIndex == -1) {
            throw "User is not part of team";
        }

        let returnTeam = this.readyTeamForReturn(inUser, inTeam);
        return returnTeam;
    }

    async deleteTeam(inData) {
        var deleteResult = await this.TeamDetails.deleteOne({ _id: inData.teamID });

        return this.getUserTeams(inData);
    }

    isUserInTeam(inUser, inTeam) {
        let teamMatch = inUser.teams.find(teamVisitor => teamVisitor._id.toString() == inTeam._id.toString())

        if (teamMatch != undefined) {
            return true;
        } else {
            return false;
        }
    }

    isUserInTeamTriage(inUser, inTeamTriage) {
        let teamTriageMatch = inTeamTriage.participants.find(participantVisitor => participantVisitor.user == inUser._id.toString())

        if (teamTriageMatch != undefined) {
            return true;
        } else {
            return false;
        }
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

        let teamMatchResult = this.isUserInTeam(inUser, inTeam);
        returnObject.teamData = inTeam;

        if (teamMatchResult) {
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
        var inTeam = (await this.TeamDetails.find({ "_id": inTeamID }))[0];

        let inviteRequest = inData.inviteRequest;

        if (inviteRequest == "accept") {
            let teamAddResult = await this.addUserToTeam(inUser, inTeam);
            return teamAddResult;
        }

        return null;
    }

    // Team triage functions

    async addUserToTeamTriage(inTeamTriage, inUser) {
        inTeamTriage.participants.push({ user: inUser, issueList: [] });
        await inTeamTriage.save();
    }

    async assignTriageIssuesToUser(inTeam, inTeamTriage, inUser) {
        // Get the list of untriaged issues (First 30)
        // Check if any of the untriaged issues returned are already in this triage session, if yes do not count them
        // Place issues to that user

        //Turn repo array into searchable term
        let repoIDArray = [];
        for (let i = 0; i < inTeam.repos.length; i++) {
            let repoVisitor = inTeam.repos[i];
            repoIDArray.push(repoVisitor._id);
        }

        // Get list of untriaged issues
        let untriagedIssueList = await this.WebDataHandler.getIssues({
            repoIDList: repoIDArray, state: "open", labels: "NONE,needs-triage", assignee: "NONE", username: inUser.username,
            limit: 30
        });

        let returnIssueList = [];

        // TODO: Put in logic if there are more than 30 issues we need to go through we would need to make another page
        // TODO: Optimize this function. Lots of rechecking of issues going on. List size is expected to be small so I'm not too worried
        for (let i = 0; i < untriagedIssueList.issueData.length; i++) {
            let issueVisitor = untriagedIssueList.issueData[i];

            // Check if issue is already triaged
            let alreadyInTriage = false;
            for (let j = 0; j < inTeamTriage.participants.length; j++) {
                let participantVisitor = inTeamTriage.participants[j];
                for (let k = 0; k < participantVisitor.issueList.length; k++) {
                    let issueCheckVisitor = participantVisitor.issueList[k];
                    if (issueCheckVisitor._id.toString() == issueVisitor._id.toString()) {
                        alreadyInTriage = true;
                    }
                }
            }

            if (!alreadyInTriage) {
                returnIssueList.push(issueVisitor._id);
                if (returnIssueList.length > 2) {
                    break;
                }
            }
        }

        // Get participant value for user and add the new issues to it
        for (let i = 0; i < inTeamTriage.participants.length; i++) {
            let participantVisitor = inTeamTriage.participants[i];
            if (participantVisitor.user._id.toString() == inUser._id.toString()) {
                for (let j = 0; j < returnIssueList.length; j++) {
                    let issueVisitor = returnIssueList[j];
                    participantVisitor.issueList.push(issueVisitor);
                }
            }
        }

        await inTeamTriage.save();
        return untriagedIssueList;
    }

    async readyTeamForReturn(inUser, inTeam) {
        inTeam = (await this.TeamDetails.find({ "_id": inTeam._id }).populate(this.populateFullTeamsInfoObject))[0];

        // Create an issue id list from all issues present
        let issueIDList = [];
        if (inTeam.triageList[0]) {
            for (let i = 0; i < inTeam.triageList[0].participants.length; i++) {
                let participantVisitor = inTeam.triageList[0].participants[i];
                for (let j = 0; j < participantVisitor.issueList.length; j++) {
                    let issueVisitor = participantVisitor.issueList[j];
                    if (issueVisitor._id) {
                        issueIDList.push(issueVisitor._id);
                    } else {
                        issueIDList.push(issueVisitor);
                    }
                }
            }
        }

        //Turn repo array into searchable term
        let repoIDArray = [];
        for (let i = 0; i < inTeam.repos.length; i++) {
            let repoVisitor = inTeam.repos[i];
            repoIDArray.push(repoVisitor._id);
        }

        // Use get issues function to get standardized issue output
        let richIssueInfoList = await this.WebDataHandler.getIssues({
            repoIDList: repoIDArray, issueIDList: issueIDList, username: inUser.username,
            limit: 30
        });

        let teamCopy = JSON.parse(JSON.stringify(inTeam));

        // Go through list again and assign each issue with the standardized output
        if (teamCopy.triageList[0]) {
            for (let i = 0; i < teamCopy.triageList[0].participants.length; i++) {
                let participantVisitor = teamCopy.triageList[0].participants[i];
                for (let j = 0; j < participantVisitor.issueList.length; j++) {
                    let issueVisitor = participantVisitor.issueList[j];
                    let richIssueMatch = richIssueInfoList.issueData.find(richIssue => richIssue._id.toString() == issueVisitor._id.toString());

                    if (richIssueMatch != undefined) {
                        participantVisitor.issueList[j] = richIssueMatch;
                    }
                }
            }
        }

        return teamCopy;
    }

    async createTeamTriage(inData) {
        let inTeamID = inData.teamID;
        var inUser = (await this.UserDetails.find({ username: inData.username }).populate('teams'))[0];
        var inTeam = (await this.TeamDetails.find({ "_id": inTeamID }).populate('repos').populate({
            path: 'triageList',
            match: { active: true },
        }))[0];

        if (inUser == null || inTeam == null) {
            throw "User or team not found";
        }

        if (!this.isUserInTeam(inUser, inTeam)) {
            throw "user is not in team";
        }

        if (inTeam.triageList.length == 0) {
            let createdTriage = await this.TeamTriageDetails.create({
                team: inTeam._id, active: true,
                participants: [],
                startDate: new Date(),
            });
            await this.addUserToTeamTriage(createdTriage, inUser);
            //TODO: Assign triage issues to that user
            await this.assignTriageIssuesToUser(inTeam, createdTriage, inUser);
        } else {
            throw "Active triage already exists"
        }

        let returnTeam = await this.readyTeamForReturn(inUser, inTeam);
        return returnTeam;
    }

    async endTeamTriage(inData) {
        let inTeamID = inData.teamID;
        var inUser = (await this.UserDetails.find({ username: inData.username }).populate('teams'))[0];
        var inTeam = (await this.TeamDetails.find({ "_id": inTeamID }).populate({
            path: 'triageList',
            match: { active: true },
        }))[0];

        if (inUser == null || inTeam == null) {
            throw "User or team not found";
        }

        if (!this.isUserInTeam(inUser, inTeam)) {
            throw "user is not in team";
        }

        if (inTeam.triageList.length == 0) {
            throw "No active team triage exists"
        } else {
            inTeam.triageList[0].active = false;
            inTeam.triageList[0].endDate = new Date();
            await inTeam.triageList[0].save();
        }

        let returnTeam = await this.readyTeamForReturn(inUser, inTeam);
        return returnTeam;
    }

    async joinTeamTriage(inData) {
        let inUser = (await this.UserDetails.find({ username: inData.username }).populate("teams"))[0];
        let inTeamTriage = (await this.TeamTriageDetails.find({ _id: inData.teamTriageID }))[0];
        let inTeam = (await this.TeamDetails.find({ _id: inTeamTriage.team }).populate("repos"))[0];

        if (inUser == null || inTeamTriage == null || inTeam == null) {
            throw "User or team not found";
        }

        if (!this.isUserInTeam(inUser, inTeam)) {
            throw "user is not in team";
        }

        if (!this.isUserInTeamTriage(inUser, inTeamTriage)) {
            await this.addUserToTeamTriage(inTeamTriage, inUser);
            await this.assignTriageIssuesToUser(inTeam, inTeamTriage, inUser);
        } else {
            throw "User is already in team triage";
        }

        let returnTeam = this.readyTeamForReturn(inUser, inTeam);
        return returnTeam;
    }

    async addIssuesToTeamTriageUser(inData) {
        let inUser = (await this.UserDetails.find({ username: inData.username }).populate("teams"))[0];
        let inTeamTriage = (await this.TeamTriageDetails.find({ _id: inData.teamTriageID }))[0];
        let inTeam = (await this.TeamDetails.find({ _id: inTeamTriage.team }).populate('repos'))[0];
        let requestedUser = (await this.UserDetails.find({ _id: inData.requestedUserID }).populate("teams"))[0];

        if (inUser == null || inTeamTriage == null || inTeam == null) {
            throw "User or team not found";
        }

        if (this.isUserInTeamTriage(inUser, inTeamTriage) && this.isUserInTeamTriage(requestedUser, inTeamTriage)) {
            await this.assignTriageIssuesToUser(inTeam, inTeamTriage, requestedUser);
        } else {
            throw "Users are not in the same team triage together";
        }

        let returnTeam = this.readyTeamForReturn(inUser, inTeam);
        return returnTeam;
    }

}

module.exports = TeamsDataHandler;