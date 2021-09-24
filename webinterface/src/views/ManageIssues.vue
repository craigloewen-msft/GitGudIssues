<template>
  <div class="pageContent">
    <div class="container issues-container">
      <h3>Newest Open Issues</h3>
      <IssueTable></IssueTable>
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
  
};
</script>

<style>

.issues-container {
  text-align: left;
}

</style>