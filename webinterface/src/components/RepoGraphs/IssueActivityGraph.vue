<template>
  <div>
    <h2>Issue Activity</h2>
    <GraphBase
      :chartEndPoint="'/api/getissueactivitygraph'"
      :chartColors="['#99F879','#D879F8']"
      :inputQuery="inputQuery"
      ref="graphbase"
    />
  </div>
</template>

<script>
import GraphBase from "./GraphBase.vue";

export default {
  name: "IssueActivityGraph",
  components: {
    GraphBase,
  },
  props: {
    inputQuery: Object,
  },
  methods: {
    refreshData: function () {
      this.$refs.graphbase.refreshData();
    },
  },
};
</script>