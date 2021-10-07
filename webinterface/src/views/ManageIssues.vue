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
    };
  },
  mounted() {
    this.refreshQueryList();
  },
  methods: {
    addNewQuery: function () {
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
        },
      });
    },
    deleteQuery: function (inputDeleteQuery) {
      var searchID = inputDeleteQuery._id;
      var deleteQueryIndex = -1;

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

.page-header {
  display: flex;
  justify-content: space-between;
}
</style>