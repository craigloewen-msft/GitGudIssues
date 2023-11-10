<template>
  <div>
    <h3>Top Issue Commenters</h3>
    <HighlightBoxBase
      :apiEndpoint="'/api/gettopissuecommentershighlight'"
      :inputQuery="inputQuery"
      ref="boxbase"
    />
  </div>
</template>

<script>
import HighlightBoxBase from "./HighlightBoxBase.vue";

export default {
  name: "TopCommentersHighlightBox",
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