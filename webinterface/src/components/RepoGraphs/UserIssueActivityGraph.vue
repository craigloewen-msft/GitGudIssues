<template>
  <div>
    <h2>Issue Activity</h2>
    <BarLineGraphBase
      :chartEndPoint="'/api/getuseractivitygraph'"
      :positiveColor="'#5e994b'"
      :negativeColor="'#814795'"
      :inputQuery="inputQuery"
      ref="graphbase"
    />
  </div>
</template>

<script>
import BarLineGraphBase from "./BarLineGraphBase.vue";

export default {
  name: "IssueActivityGraph",
  components: {
    BarLineGraphBase,
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