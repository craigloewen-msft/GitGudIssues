<template>
  <div class="pageContent">
    <div class="container issues-container">
      <div class="page-header">
        <h2>Manage Mentions</h2>
        <b-button v-on:click="refreshQueryList">Refresh Mentions</b-button>
      </div>
      <MentionTable
        v-for="(mentionQuery, mentionQueryIndex) in mentionQueryObjects"
        :key="mentionQueryIndex"
        v-bind:mentionQuery="mentionQuery.query"
        @deleteQueryEvent="deleteQuery(mentionQuery)"
        v-bind:inEditMode="mentionQuery.startEdit"
      >
      </MentionTable>
      <!-- Mention Table -->
    </div>
  </div>
</template>

<script>
import MentionTable from "../components/MentionTable";

export default {
  name: "ManageMentions",
  components: {
    MentionTable,
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
    };
  },
  mounted() {
    // this.refreshQueryList();
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
</style>