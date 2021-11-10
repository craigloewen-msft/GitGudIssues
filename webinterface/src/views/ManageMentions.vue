<template>
  <div class="pageContent">
    <div class="container issues-container">
      <div class="page-header">
        <h2>Manage Mentions</h2>
        <b-button v-on:click="refreshQueryList">Refresh Mentions</b-button>
      </div>
      <IssueTable
        v-for="(mentionQuery, mentionQueryIndex) in mentionQueryObjects"
        :key="mentionQueryIndex"
        v-bind:inputQuery="mentionQuery.query"
        @deleteQueryEvent="deleteQuery(mentionQuery)"
        v-bind:inEditMode="mentionQuery.startEdit"
        getIssuesEndpoint="/api/getmentions"
        modifyIssuesEndpoint="/api/modifyusermanagementionquery"
        v-bind:isMention="true"
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
      <b-button v-on:click="addNewQuery">New Mention Query</b-button>
    </div>
  </div>
</template>

<script>
import IssueTable from "../components/IssueTable";

export default {
  name: "ManageMentions",
  components: {
    IssueTable,
  },
  data() {
    return {
      mentionQueryObjects: [
        // {
        //   user: null,
        //   repos: null,
        //   page_num: 1,
        // },
      ],
      loading: true,
    };
  },
  mounted() {
    this.$http.defaults.headers.common["Authorization"] =
      this.$store.state.token;
    this.refreshQueryList();
  },
  methods: {
    addNewQuery: function () {
      this.mentionQueryObjects.push({
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

      for (let i = 0; i < this.mentionQueryObjects.length; i++) {
        if (this.mentionQueryObjects[i]._id == searchID) {
          deleteQueryIndex = i;
          break;
        }
      }

      console.log(deleteQueryIndex);
      if (deleteQueryIndex != -1) {
        this.mentionQueryObjects.splice(deleteQueryIndex, 1);
      }
    },
    refreshQueryList: function () {
      this.mentionQueryObjects = [];
      this.$http.get("/api/getusermanagementionqueries").then((response) => {
        if (response.data.success) {
          const returnedQueries = response.data.queries;
          for (let i = 0; i < returnedQueries.length; i++) {
            returnedQueries[i].page_num = 1;
            this.mentionQueryObjects.push({
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