<template>
  <div>
    <h1>Team Triage Selection</h1>
    <!-- Choose a triage team... to be implemented -->
    <div v-for="(team, teamIndex) in teamsList" :key="teamIndex">
      <router-link :to="'/team/triage/' + team._id">{{
        team.name
      }}</router-link>
    </div>
  </div>
</template>

<script>
export default {
  name: "TeamTriageSelector",
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
  },
  mounted() {
    this.refreshTeamInfo();
  },
};
</script>