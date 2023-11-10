<template>
  <div>
    <h2>Comment Activity</h2>
    <GraphBase
      :chartEndPoint="'/api/getcommentactivitygraph'"
      :chartColors="['#f87979']"
      :inputQuery="inputQuery"
      ref="graphbase"
    />
  </div>
</template>

<script>
import GraphBase from "./GraphBase.vue";

export default {
  name: "CommentActivityGraph",
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