<template>
  <div>
    <h3>Top Issue Openers</h3>
    <HighlightBoxBase
      :apiEndpoint="'/api/gettopissueopenershighlight'"
      :inputQuery="inputQuery"
      ref="boxbase"
    />
  </div>
</template>

<script>
import HighlightBoxBase from "./HighlightBoxBase.vue";

export default {
  name: "TopOpenersHighlightBox",
  components: {
    HighlightBoxBase,
  },
  props: {
    inputQuery: Object,
  },
  methods: {
    refreshData: function () {
      this.$refs.boxbase.refreshData();
    },
  },
};
</script>