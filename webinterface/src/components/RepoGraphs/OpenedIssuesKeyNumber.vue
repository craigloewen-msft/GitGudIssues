<template>
  <div>
    <h2>Total Opened Issues</h2>
    <KeyNumberBase
      :apiEndpoint="'/api/getopenedissueskeynumber'"
      :inputQuery="inputQuery"
      ref="keynumberbase"
    />
  </div>
</template>

<script>
import KeyNumberBase from "./KeyNumberBase.vue";

export default {
  name: "OpenedIssuesKeyNumber",
  components: {
    KeyNumberBase,
  },
  props: {
    inputQuery: Object,
  },
  methods: {
    refreshData: function () {
      this.$refs.keynumberbase.refreshData();
    },
  },
};
</script>