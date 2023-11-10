<template>
  <div>
    <h2>Opened Issues</h2>
    <PieGraphBase
      :chartEndPoint="'/api/getuseropenedpiegraph'"
      :color="'#6c4040'"
      :inputQuery="inputQuery"
      ref="graphbase"
    />
  </div>
</template>

<script>
import PieGraphBase from "./PieGraphBase.vue";

export default {
  name: "UserOpenedPieGraph",
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