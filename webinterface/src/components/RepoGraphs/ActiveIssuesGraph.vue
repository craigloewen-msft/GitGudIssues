<template>
  <div>
  <h2>{{inputQuery.milestones? inputQuery.milestones : "Active Issues"}}</h2>
    <GraphBase
      :chartEndPoint="'/api/getactiveissuesgraph'"
      :chartColors="['#f87979']"
      :inputQuery="inputQuery"
      ref="graphbase"
    />
  </div>
</template>

<script>
import GraphBase from "./GraphBase.vue";

export default {
  name: "ActiveIssuesGraph",
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
