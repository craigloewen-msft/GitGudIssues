<template>
  <div>
    <h1>Your Teams</h1>
    <div
      class="team-box"
      v-for="(team, teamIndex) in teamsList"
      :key="teamIndex"
    >
      <h2>{{ team.name }}</h2>
      <h3>Members</h3>
      <p v-for="(member, memberIndex) in team.users" :key="memberIndex">
        {{ member.githubUsername }}
      </p>
      <h3>Repos</h3>
      <p v-for="(repo, repoIndex) in team.repos" :key="repoIndex">
        {{ repo.shortURL }}
      </p>
      <button
        v-on:click="deleteTeam(team)"
        class="btn btn-warning"
        type="button"
      >
        Delete
      </button>
    </div>
    <button v-on:click="addTeam" class="btn btn-primary" type="button">
      Add Team
    </button>
  </div>
</template>

<script>
export default {
  name: "TeamsView",
  props: {},
  data() {
    return {
      teamsList: [],
      loading: true,
      githubUsername: null,
    };
  },
  methods: {
    refreshTeamInfo: function () {
      this.$http.get("/api/getuserteams/").then((response) => {
        if (response.data.success) {
          const teamsListData = response.data.teamsList;
          this.teamsList = teamsListData;
          this.loading = false;
        }
      });
    },
    getGHUsername: function () {
      this.loading = true;
      this.$http
        .get("/api/user/" + this.$store.state.user.username + "/")
        .then((response) => {
          const someUserData = response.data.user;
          this.githubUsername = someUserData.githubUsername;
          this.loading = false;
        });
    },
    addTeam: function () {
      this.$http.post("/api/createnewteam/", {}).then((response) => {
        if (response.data.success) {
          const newTeam = response.data.newTeam;
          this.teamsList.push(newTeam);
        }
      });
    },
    deleteTeam: function (inTeam) {
      this.$http
        .post("/api/deleteteam/", { teamID: inTeam._id })
        .then((response) => {
          if (response.data.success) {
            const teamsListData = response.data.teamsList;
            this.teamsList = teamsListData;
          }
        });
    },
  },
  mounted() {
    this.refreshTeamInfo();
    this.getGHUsername();
  },
};
</script>