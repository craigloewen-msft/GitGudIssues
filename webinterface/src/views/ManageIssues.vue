<template>
  <div class="pageContent">
    <div class="container issues-container">
      <IssueTable
        v-for="(issueQuery, issueQueryIndex) in issueQueries"
        :key="issueQueryIndex"
        v-bind:inputQuery="issueQuery"
        @deleteQueryEvent="deleteQuery(issueQuery)"
      >
      </IssueTable>
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
      issueQueries: [
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
    };
  },
  mounted() {
    this.refreshQueryList();
  },
  methods: {
    addNewQuery: function () {
      this.issueQueries.push({
        title: "New Query",
        repo: null,
        state: null,
        sort: null,
        limit: 5,
        creator: null,
        assignee: null,
        labels: null,
        repos: null,
        page_num: 1,
      });
    },
    deleteQuery: function (inputDeleteQuery) {
      var searchID = inputDeleteQuery._id;
      var deleteQueryIndex = -1;

      for (let i = 0; i < this.issueQueries.length; i++) {
        if (this.issueQueries[i]._id == searchID) {
          deleteQueryIndex = i;
          break;
        }
      }

      console.log(deleteQueryIndex);
      if (deleteQueryIndex != -1) {
        this.issueQueries.splice(deleteQueryIndex, 1);
      }
    },
    refreshQueryList: function () {
      this.$http.get("/api/getusermanageissuequeries").then((response) => {
        if (response.data.success) {
          const returnedQueries = response.data.queries;
          this.issueQueries = returnedQueries;
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
.issues-container {
  text-align: left;
}
</style>