<template>
  <div class="pageContent">
    <div class="container issues-container">
      <h3>Newest Open Issues</h3>
      <IssueTable v-bind:inputQuery="newestOpenIssuesQuery"></IssueTable>

      <h3>Recently Updated Issues</h3>
      <IssueTable v-bind:inputQuery="newestAllIssuesQuery"></IssueTable>
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
      newestOpenIssuesQuery: {
        repo: "microsoftdocs/wsl",
        state: "open",
        sort: "created",
        limit: 5,
        creator: null,
        assignee: null,
        labels: null,
        page_num: 1,
      },
      newestAllIssuesQuery: {
        repo: "microsoftdocs/wsl",
        state: "all",
        sort: "updated",
        limit: 5,
        creator: null,
        assignee: null,
        labels: null,
        page_num: 1,
      },
    }
  },
};
</script>

<style>

.issues-container {
  text-align: left;
}

</style>