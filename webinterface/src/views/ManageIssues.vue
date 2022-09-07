<template>
  <div class="pageContent">
    <div class="container issues-container">
      <div class="page-header">
        <h2>Manage Issue Queries</h2>
        <b-button v-on:click="refreshQueryList">Refresh Queries</b-button>
      </div>
      <IssueTable
        v-for="(issueQuery, issueQueryIndex) in issueQueryObjects"
        :key="issueQueryIndex"
        v-bind:inputQuery="issueQuery.query"
        @deleteQueryEvent="deleteQuery(issueQuery)"
        v-bind:inEditMode="issueQuery.startEdit"
        v-bind:getIssuesEndpoint="'/api/getissues'"
        v-bind:modifyIssuesEndpoint="'/api/modifyusermanageissuequery'"
      >
      </IssueTable>
      <div v-if="loading">
        <div class="placeholder" style="width: 300px"></div>
        <br />
        <div class="placeholder" style="width: 300px"></div>
        <br />
        <div class="placeholder" style="width: 300px"></div>
        <br />
      </div>
      <b-button v-on:click="addNewQuery">New Query</b-button>
    </div>
  </div>
</template>

<script>
import IssueTable from "../components/IssueTable";

export default {
  name: "Login",
  components: {
    IssueTable,
  },
  data() {
    return {
      issueQueryObjects: [
        // {
        //   title: "Newest Issues",
        //   repo: "microsoftdocs/wsl",
        //   state: "open",
        //   sort: "created",
        //   limit: 5,
        //   creator: null,
        //   assignee: null,
        //   labels: null,
        //   repos: null,
        //   page_num: 1,
        // },
        // {
        //   title: "Recently Updated",
        //   repo: "microsoftdocs/wsl",
        //   state: "all",
        //   sort: "updated",
        //   limit: 5,
        //   creator: null,
        //   assignee: null,
        //   labels: null,
        //   page_num: 1,
        // },
      ],
      loading: true,
    };
  },
  mounted() {
    this.refreshQueryList();
    this.$gtag.pageview(this.$route);
  },
  methods: {
    addNewQuery: function () {
      this.$gtag.event("addIssueQuery", {
        event_category: "queryFunctions",
        event_label: "New Query",
        value: 2,
      });
      this.issueQueryObjects.push({
        startEdit: true,
        query: {
          title: "New Query",
          repo: null,
          state: null,
          sort: null,
          limit: 10,
          creator: null,
          assignee: null,
          labels: null,
          repos: null,
          page_num: 1,
          milestones: null,
        },
      });
    },
    deleteQuery: function (inputDeleteQuery) {
      var searchID = inputDeleteQuery._id;
      var deleteQueryIndex = -1;
      this.$gtag.event("deleteIssueQuery", {
        event_category: "queryFunctions",
        event_label: inputDeleteQuery.title,
        value: 1,
      });

      for (let i = 0; i < this.issueQueryObjects.length; i++) {
        if (this.issueQueryObjects[i]._id == searchID) {
          deleteQueryIndex = i;
          break;
        }
      }

      console.log(deleteQueryIndex);
      if (deleteQueryIndex != -1) {
        this.issueQueryObjects.splice(deleteQueryIndex, 1);
      }
    },
    refreshQueryList: function () {
      this.issueQueryObjects = [];
      this.$http.get("/api/getusermanageissuequeries").then((response) => {
        if (response.data.success) {
          const returnedQueries = response.data.queries;
          for (let i = 0; i < returnedQueries.length; i++) {
            returnedQueries[i].page_num = 1;
            this.issueQueryObjects.push({
              startEdit: false,
              query: returnedQueries[i],
            });
          }
          this.loading = false;
        } else {
          // TODO Add in some error catching condition
          console.log(response);
        }
      });
    },
  },
};
</script>

<style>
</style>