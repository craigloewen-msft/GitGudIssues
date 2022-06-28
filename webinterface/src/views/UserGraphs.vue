<template>
  <div class="pageContent">
    <b-container>
      <h1>{{ inputQuery.names }}</h1>
      <div class="graph-title-and-controls">
        <div class="graph-controls">
          <div class="table-header-buttons">
            <div class="table-header-buttons-group">
              <b-dropdown
                id="dropdown-1"
                text="Username"
                class="m-md-2"
                size="sm"
                variant="outline-secondary"
              >
                <b-form-input
                  placeholder="user1,user2"
                  size="sm"
                  v-model="inputQuery.names"
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
        <!-- Stacked bar chart of each repo with a line of total closed, total opened, and net opened and closed -->
        <UserIssueActivityGraph
          v-if="!loading"
          :inputQuery="inputQuery"
          ref="activeissuesgraph"
        />
      </div>
      <div class="active-issues-graph row">
        <!-- top openers top commenters -->
        <div class="col-md-6">
          <UserOpenedPieGraph
            v-if="!loading"
            :inputQuery="inputQuery"
            ref="useropenedpiegraph"
          />
        </div>
        <div class="col-md-6">
          <UserClosedPieGraph
            v-if="!loading"
            :inputQuery="inputQuery"
            ref="userclosedpiegraph"
          />
        </div>
      </div>
      <div class="row">
        <div class="col-md-6">
          <OpenedIssuesKeyNumber
            v-if="!loading"
            :inputQuery="openedIssuesKeyNumberInputQuery"
            ref="openedissueskeynumber"
          />
        </div>
        <div class="col-md-6">
          <ClosedIssuesKeyNumber
            v-if="!loading"
            :inputQuery="closedIssuesKeyNumberInputQuery"
            ref="closedissueskeynumber"
          />
        </div>
      </div>
    </b-container>
  </div>
</template>

<script>
import OpenedIssuesKeyNumber from "../components/RepoGraphs/OpenedIssuesKeyNumber.vue";
import UserOpenedPieGraph from "../components/RepoGraphs/UserOpenedPieGraph.vue";
import UserClosedPieGraph from "../components/RepoGraphs/UserClosedPieGraph.vue";
import ClosedIssuesKeyNumber from "../components/RepoGraphs/ClosedIssuesKeyNumber.vue";
import UserIssueActivityGraph from "../components/RepoGraphs/UserIssueActivityGraph.vue";

export default {
  name: "RepoGraphs",
  components: {
    OpenedIssuesKeyNumber,
    UserOpenedPieGraph,
    UserClosedPieGraph,
    ClosedIssuesKeyNumber,
    UserIssueActivityGraph,
  },
  data() {
    return {
      inputQuery: {
        names: "",
        startDate: new Date(new Date().setMonth(new Date().getMonth() - 6)),
        endDate: new Date(new Date().setDate(new Date().getDate() + 1)),
      },
      loading: true,
    };
  },
  mounted: function () {
    this.$gtag.pageview(this.$route);
    this.getGHUsername();
  },
  computed: {
    closedIssuesKeyNumberInputQuery: function () {
      return {
        closed_by: this.inputQuery.names,
        startDate: this.inputQuery.startDate,
        endDate: this.inputQuery.endDate,
      };
    },
    openedIssuesKeyNumberInputQuery: function () {
      return {
        creator: this.inputQuery.names,
        startDate: this.inputQuery.startDate,
        endDate: this.inputQuery.endDate,
      };
    },
  },
  methods: {
    getGHUsername: function () {
      this.loading = true;
      this.inputQuery.names = "";
      this.$http
        .get("/api/user/" + this.$store.state.user.username + "/")
        .then((response) => {
          const someUserData = response.data.user;
          this.inputQuery.names = someUserData.githubUsername;
          this.loading = false;
        });
    },
    refreshData: function () {
      // IN this case because computed functions above will lag a little we need to input a small delay before updating
      setTimeout(() => {
        Object.entries(this.$refs).forEach(([key, refItem]) => {
          console.log("Refreshing items");
          refItem.refreshData();
        });
      },100);
    },
  },
};
</script>

<style>
</style>