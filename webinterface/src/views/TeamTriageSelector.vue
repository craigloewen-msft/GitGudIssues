<template>
  <div>
    <div v-if="!loading">
      <h1>Team Triage Selection</h1>
      <!-- Choose a triage team... to be implemented -->
      <div v-for="(team, teamIndex) in teamsList" :key="teamIndex">
        <router-link :to="'/team/triage/' + team._id">{{
          team.name
        }}</router-link>
      </div>
    </div>
      <div v-if="loading" class="custom-tag-collection" style="display: flex; justify-content: center; margin-top: 50px;">
        <div
          class="placeholder col-3 repo-placeholder"
          style="width: 100px"
        ></div>
        <div
          class="placeholder col-3 repo-placeholder"
          style="width: 100px"
        ></div>
        <div
          class="placeholder col-3 repo-placeholder"
          style="width: 100px"
        ></div>
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

          if (this.teamsList.length == 1) {
            this.$router.push("/team/triage/" + this.teamsList[0].id);
          }
        }
      });
    },
  },
  mounted() {
    this.refreshTeamInfo();
  },
};
</script>