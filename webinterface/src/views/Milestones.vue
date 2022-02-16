<template>
  <div class="pageContent">
    <b-container>
      <h1>{{ inputQuery.repos }}</h1>
      <div class="graph-title-and-controls">
        <div class="graph-controls">
          <div class="table-header-buttons">
            <div class="table-header-buttons-group">
              <b-dropdown
                id="dropdown-1"
                text="Repo"
                class="m-md-2"
                size="sm"
                variant="outline-secondary"
              >
                <b-form-input
                  placeholder="microsoft/wsl,microsoft/vscode"
                  size="sm"
                  v-model="inputQuery.repos"
                  v-debounce:1s="refreshData"
                  @keyup.enter="refreshData"
                ></b-form-input>
              </b-dropdown>

              <b-dropdown
                id="milestone-dropdown"
                text="milestone"
                class="m-md-2"
                size="sm"
                variant="outline-secondary"
              >
                <b-form-input
                  placeholder="Terminal v1.14,22H1"
                  size="sm"
                  v-model="inputQuery.milestones"
                  v-debounce:1s="refreshData"
                  @keyup.enter="refreshData"
                ></b-form-input>
              </b-dropdown>

            </div>
          </div>
          <b-form-datepicker
            size="sm"
            v-model="inputQuery.startDate"
            class="mb-2"
            @input="refreshData"
          ></b-form-datepicker>
          <b-form-datepicker
            size="sm"
            v-model="inputQuery.endDate"
            class="mb-2"
            @input="refreshData"
          ></b-form-datepicker>
        </div>
      </div>
      <div class="active-issues-graph">
        <MilestoneIssuesGraph
          v-if="!loading"
          :inputQuery="inputQuery"
          ref="milestoneissuesgraph"
        />
      </div>
    </b-container>
  </div>
</template>

<script>
import MilestoneIssuesGraph from "../components/RepoGraphs/MilestoneIssuesGraph.vue";

export default {
  name: "RepoGraphs",
  components: {
    MilestoneIssuesGraph,
  },
  data() {
    return {
      inputQuery: {
        repos: "",
        startDate: new Date(new Date().setMonth(new Date().getMonth() - 6)),
        endDate: new Date(),
        milestones: ""
      },
      loading: true,
      repoList: [],
      milestoneList: [],
    };
  },
  mounted: function () {
    this.$http.defaults.headers.common["Authorization"] =
      this.$store.state.token;
    this.$gtag.pageview(this.$route);
    this.getInputRepos();
  },
  methods: {
    getInputRepos: function () {
      this.loading = true;
      this.repoList = [];
      this.milestoneList = [];
      this.$http
        .get("/api/user/" + this.$store.state.user.username + "/")
        .then((response) => {
          const someUserData = response.data.user;
          this.repoList = someUserData.repos;
          this.inputQuery.repos = this.repoList[0].title;
          // TODO!
          // Get all the milestones for the repo that's in this.inputQuery.repos
          //
          // FAKE DATA BELOW
          this.milestoneList = [
            { title: "Terminal v1.14", id: 41 },
            { title: "22H1", id: 43 }
          ];
          this.inputQuery.milestones = this.milestoneList[0].title;
          this.loading = false;
        });
    },
    refreshData: function () {
      Object.entries(this.$refs).forEach(([key, refItem]) => {
        refItem.refreshData();
      });
    },
  },
};
</script>

<style>
@import "../style/controlButtons.scss";
</style>
