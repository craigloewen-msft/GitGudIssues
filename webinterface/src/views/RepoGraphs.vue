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
        <ActiveIssuesGraph
          v-if="!loading"
          :inputQuery="inputQuery"
          ref="activeissuesgraph"
        />
      </div>
      <div class="issue-activity-graph">
        <IssueActivityGraph
          v-if="!loading"
          :inputQuery="inputQuery"
          ref="issueactivitygraph"
        />
      </div>
      <div class="active-issues-graph row">
        <!-- top openers top commenters -->
        <div class="col-md-4">
          <TopOpenersHighlightBox
            v-if="!loading"
            :inputQuery="inputQuery"
            ref="topopenershighlight"
          />
        </div>
        <div class="col-md-4">
          <TopClosersHighlightBox
            v-if="!loading"
            :inputQuery="inputQuery"
            ref="topclosershighlight"
          />
        </div>
        <div class="col-md-4">
          <TopCommentersHighlightBox
            v-if="!loading"
            :inputQuery="inputQuery"
            ref="topcommentershighlight"
          />
        </div>
      </div>
      <div class="row">
        <div class="col-md-6">
          <OpenedIssuesKeyNumber
            v-if="!loading"
            :inputQuery="inputQuery"
            ref="openedissueskeynumber"
          />
        </div>
        <div class="col-md-6">
          <ClosedIssuesKeyNumber
            v-if="!loading"
            :inputQuery="inputQuery"
            ref="closedissueskeynumber"
          />
        </div>
      </div>
    </b-container>
  </div>
</template>

<script>
import ActiveIssuesGraph from "../components/RepoGraphs/ActiveIssuesGraph.vue";
import IssueActivityGraph from "../components/RepoGraphs/IssueActivityGraph.vue";
import TopOpenersHighlightBox from "../components/RepoGraphs/TopOpenersHighlightBox.vue";
import TopCommentersHighlightBox from "../components/RepoGraphs/TopCommentersHighlightBox.vue";
import TopClosersHighlightBox from "../components/RepoGraphs/TopClosersHighlightBox.vue";
import OpenedIssuesKeyNumber from "../components/RepoGraphs/OpenedIssuesKeyNumber.vue"
import ClosedIssuesKeyNumber from "../components/RepoGraphs/ClosedIssuesKeyNumber.vue"

export default {
  name: "RepoGraphs",
  components: {
    ActiveIssuesGraph,
    IssueActivityGraph,
    TopOpenersHighlightBox,
    TopCommentersHighlightBox,
    TopClosersHighlightBox,
    OpenedIssuesKeyNumber,
    ClosedIssuesKeyNumber,
  },
  data() {
    return {
      inputQuery: {
        repos: "",
        startDate: new Date(new Date().setMonth(new Date().getMonth() - 6)),
        endDate: new Date(),
      },
      loading: true,
      repoList: [],
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
      this.$http
        .get("/api/user/" + this.$store.state.user.username + "/")
        .then((response) => {
          const someUserData = response.data.user;
          this.repoList = someUserData.repos;
          this.inputQuery.repos = this.repoList[0].title;
          this.loading = false;
        });
    },
    refreshData: function () {
      this.$refs.activeissuesgraph.refreshData();
      this.$refs.issueactivitygraph.refreshData();
      this.$refs.topopenershighlight.refreshData();
      this.$refs.topcommentershighlight.refreshData();
      this.$refs.topclosershighlight.refreshData();
      this.$refs.openedissueskeynumber.refreshData();
      this.$refs.closedissueskeynumber.refreshData();
    },
  },
};
</script>

<style>
@import "../style/controlButtons.scss";
</style>