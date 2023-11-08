<template>
  <div>
    <h2>Total Closed Issues</h2>
    <KeyNumberBase
      :apiEndpoint="'/api/getclosedissueskeynumber'"
      :inputQuery="inputQuery"
      ref="keynumberbase"
    />
  </div>
</template>

<script>
import KeyNumberBase from "./KeyNumberBase.vue";

export default {
  name: "ClosedIssuesKeyNumber",
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