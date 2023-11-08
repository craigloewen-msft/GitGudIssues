<template>
  <div>
    <h2>Closed Issues</h2>
    <PieGraphBase
      :chartEndPoint="'/api/getuserclosedpiegraph'"
      :color="'#6c6c40'"
      :inputQuery="inputQuery"
      ref="graphbase"
    />
  </div>
</template>

<script>
import PieGraphBase from "./PieGraphBase.vue";

export default {
  name: "UserClosedPieGraph",
  components: {
    PieGraphBase,
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