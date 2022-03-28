<template>
  <div>
    <h1>Your Teams</h1>
    <div
      class="team-box"
      v-for="(team, teamIndex) in teamsList"
      :key="teamIndex"
    >
      <TeamsCard @deleteTeamsEvent="loadTeamInfo" :team="team" />
    </div>
    <button v-on:click="addTeam" class="btn btn-primary" type="button">
      Add Team
    </button>
  </div>
</template>

<script>
import TeamsCard from "./TeamsCard.vue";

export default {
  name: "TeamsView",
  components: {
    TeamsCard,
  },
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
    addTeam: function () {
      this.$http.post("/api/createnewteam/", {}).then((response) => {
        if (response.data.success) {
          const newTeam = response.data.newTeam;
          this.teamsList.push(newTeam);
        }
      });
    },
    loadTeamInfo: function (inTeamInfo) {
      this.teamsList = inTeamInfo;
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
  },
  mounted() {
    this.refreshTeamInfo();
    this.getGHUsername();
  },
};
</script>