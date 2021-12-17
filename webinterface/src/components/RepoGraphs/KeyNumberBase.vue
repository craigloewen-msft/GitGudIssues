<template>
  <h4>{{ keyNumber }}</h4>
</template>

<script>
export default {
  name: "KeyNumberBase",
  props: {
    inputQuery: Object,
    apiEndpoint: String,
  },
  data() {
    return {
      loading: true,
      keyNumber: null,
    };
  },
  methods: {
    refreshData: function () {
      this.loading = true;
      this.highlightList = [];
      this.$http.post(this.apiEndpoint, this.inputQuery).then((response) => {
        if (response.data.success) {
          const keyNumber = response.data.keyNumber;
          this.keyNumber = keyNumber;
          this.loading = false;
        } else {
          // TODO Add in some error catching condition
          console.log(response);
        }
      });
    },
  },
  mounted() {
    this.refreshData();
  },
};
</script>

<style>
</style>