<template>
  <div>
    <h2>Total Comments</h2>
    <KeyNumberBase
      :apiEndpoint="'/api/getcommentskeynumber'"
      :inputQuery="inputQuery"
      ref="keynumberbase"
    />
  </div>
</template>

<script>
import KeyNumberBase from "./KeyNumberBase.vue";

export default {
  name: "CommentsKeyNumber",
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