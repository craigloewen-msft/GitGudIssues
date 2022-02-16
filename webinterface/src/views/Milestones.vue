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
      <div class="issue-activity-graph">
        <CommentActivityGraph
          v-if="!loading"
          :inputQuery="inputQuery"
          ref="commentactivitygraph"
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
        <div class="col-md-4">
          <OpenedIssuesKeyNumber
            v-if="!loading"
            :inputQuery="inputQuery"
            ref="openedissueskeynumber"
          />
        </div>
        <div class="col-md-4">
          <ClosedIssuesKeyNumber
            v-if="!loading"
            :inputQuery="inputQuery"
            ref="closedissueskeynumber"
          />
        </div>
        <div class="col-md-4">
          <CommentsKeyNumber
            v-if="!loading"
            :inputQuery="inputQuery"
            ref="commentskeynumber"
          />
        </div>
      </div>
    </b-container>
  </div>
</template>

<script>
import ActiveIssuesGraph from "../components/RepoGraphs/ActiveIssuesGraph.vue";
import IssueActivityGraph from "../components/RepoGraphs/IssueActivityGraph.vue";
import CommentActivityGraph from "../components/RepoGraphs/CommentActivityGraph.vue";
import TopOpenersHighlightBox from "../components/RepoGraphs/TopOpenersHighlightBox.vue";
import TopCommentersHighlightBox from "../components/RepoGraphs/TopCommentersHighlightBox.vue";
import TopClosersHighlightBox from "../components/RepoGraphs/TopClosersHighlightBox.vue";
import OpenedIssuesKeyNumber from "../components/RepoGraphs/OpenedIssuesKeyNumber.vue";
import ClosedIssuesKeyNumber from "../components/RepoGraphs/ClosedIssuesKeyNumber.vue";
import CommentsKeyNumber from "../components/RepoGraphs/CommentsKeyNumber.vue";

export default {
  name: "RepoGraphs",
  components: {
    ActiveIssuesGraph,
    IssueActivityGraph,
    CommentActivityGraph,
    TopOpenersHighlightBox,
    TopCommentersHighlightBox,
    TopClosersHighlightBox,
    OpenedIssuesKeyNumber,
    ClosedIssuesKeyNumber,
    CommentsKeyNumber,
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
