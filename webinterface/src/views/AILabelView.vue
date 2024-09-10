<template>
  <div class="pageContent">
    <div class="container issues-container">
      <div class="page-header">
        <h2>Manage Issue Queries</h2>
      </div>
      <IssueTable v-for="(issueQuery, issueQueryIndex) in issueQueryObjects" :key="issueQueryIndex"
        v-bind:inputQuery="issueQuery.query" @deleteQueryEvent="deleteQuery(issueQuery)"
        v-bind:inEditMode="issueQuery.startEdit" v-bind:getIssuesEndpoint="'/api/getissues'"
        v-bind:modifyIssuesEndpoint="'/api/modifyusermanageissuequery'"
        v-bind:showAILabels="true">
      </IssueTable>
      <div v-if="loading">
        <div class="placeholder" style="width: 300px"></div>
        <br />
        <div class="placeholder" style="width: 300px"></div>
        <br />
        <div class="placeholder" style="width: 300px"></div>
        <br />
      </div>
    </div>
  </div>
</template>

<script>
import IssueTable from "../components/IssueTable";

export default {
  name: "AILabelView",
  components: {
    IssueTable,
  },
  data() {
    return {
      issueQueryObjects: [],
      loading: true,
    };
  },
  mounted() {
    this.issueQueryObjects.push({
      query: {
        title: "Newest Issues",
        repos: "microsoftdocs/wsl",
        state: "open",
        sort: "created",
        limit: 5,
        creator: null,
        assignee: null,
        labels: null,
        page_num: 1,
      },
    }
    );
    this.$gtag.pageview(this.$route);
    this.loading = false;
  },
};
</script>