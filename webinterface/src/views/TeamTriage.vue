<template>
  <div>
    <div v-if="team">
      <div v-if="!team.triageList || team.triageList.length == 0">
        <h1>Triage hasn't started</h1>
        <b-button v-on:click="startTriage">Start Triage</b-button>
      </div>
      <div v-else-if="team.triageList[0]">
        <h1>{{ team.name }} Triage</h1>
        <div
          class="container user-issue-triage-box"
          v-for="(participant, participantIndex) in team.triageList[0]
            .participants"
          :key="participantIndex"
        >
          <h2>{{ participant.user.githubUsername }}</h2>
          <div
            v-for="(triageIssue, triageIssueIndex) in participant.issueList"
            :key="triageIssueIndex"
          >
            <IssueInfoBox
              v-bind:issue="triageIssue"
              v-bind:isMention="false"
            ></IssueInfoBox>
          </div>
          <div class="triage-bottom-buttons">
            <b-button
              v-on:click="addMoreIssues(team.triageList[0], participant.user)"
              >Add more issues</b-button
            >
          </div>
        </div>
        <div>
          <b-button v-on:click="endTriage">End Triage</b-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import IssueInfoBox from "../components/IssueInfoBox.vue";

export default {
  name: "TeamTriage",
  data() {
    return {
      teamID: this.$route.params.teamid,
      userID: this.$store.state.user.id,
      team: null,
      loading: true,
    };
  },
  components: {
    IssueInfoBox,
  },
  methods: {
    refreshTeamInfo: function (callback) {
      this.$http
        .post("/api/getteam/", { teamID: this.teamID })
        .then((response) => {
          if (response.data.success) {
            // Load in team data
            this.team = response.data.team;
            this.loading = false;

            // If triage exists
            if (this.team.triageList[0]) {
              // If not in triage join it
              if (!this.isUserInTriage()) {
                this.joinTriage(this.team.triageList[0]);
              }

              // Request repos get updated
              let refreshRepoList = this.team.repos;
              this.$http.post("/api/refreshrepolist", {
                repoList: refreshRepoList,
              });
            }

            // Execute callback
            callback();
          } else {
            console.log(response);
          }
        });
    },
    refreshTeamInfoContinuously: function () {
      let refreshFunction = function () {
        // Create timeout function
        setTimeout(
          function () {
            this.refreshTeamInfoContinuously();
          }.bind(this),
          10000
        );
      }.bind(this);

      if (this.$route.name == "Team Triage") {
        this.refreshTeamInfo(refreshFunction);
      }
    },
    startTriage: function () {
      this.$http
        .post("/api/createteamtriage/", { teamID: this.teamID })
        .then((response) => {
          if (response.data.success) {
            this.team = response.data.team;
          } else {
            console.log(response);
          }
        });
    },
    endTriage: function () {
      this.$http
        .post("/api/endteamtriage/", { teamID: this.teamID })
        .then((response) => {
          if (response.data.success) {
            this.team = response.data.team;
          } else {
            console.log(response);
          }
        });
    },
    joinTriage: function (inputTeamTriage) {
      this.$http
        .post("/api/jointeamtriage/", { teamTriageID: inputTeamTriage._id })
        .then((response) => {
          if (response.data.success) {
            this.team = response.data.team;
          } else {
            console.log(response);
          }
        });
    },
    addMoreIssues: function (inputTeamTriage, inputUser) {
      this.$http
        .post("/api/addissuestoteamtriageuser/", {
          teamTriageID: inputTeamTriage._id,
          requestedUserID: inputUser._id,
        })
        .then((response) => {
          if (response.data.success) {
            this.team = response.data.team;
          } else {
            console.log(response);
          }
        });
    },
    isUserInTriage: function () {
      for (let i = 0; i < this.team.triageList.length; i++) {
        let triageVisitor = this.team.triageList[i];
        for (let j = 0; j < triageVisitor.participants.length; j++) {
          let participantVisitor = triageVisitor.participants[j];
          if (participantVisitor.user._id == this.userID) {
            return true;
          }
        }
      }
      return false;
    },
  },
  mounted() {
    // Start auto refresh of triage info
    this.refreshTeamInfoContinuously();
    this.$gtag.pageview(this.$route);
  },
};
</script>

<style>
.user-issue-triage-box {
  margin-bottom: 20px;
}

.triage-bottom-buttons {
  display: flex;
}
</style>