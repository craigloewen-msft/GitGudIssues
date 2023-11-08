<template>
  <ul class="highlight-list">
    <li
      v-for="(highlightName, highlightIndex) in highlightList"
      :key="highlightIndex"
    >
      <div v-if="highlightName.url">
      <a :href="highlightName.url">{{ highlightName._id }}</a> - {{ highlightName.count }}
      </div>
      <div v-else>
      {{ highlightName._id }} - {{ highlightName.count }}
        </div>
    </li>
  </ul>
</template>

<script>
export default {
  name: "HighlightBoxBase",
  props: {
    inputQuery: Object,
    apiEndpoint: String,
  },
  data() {
    return {
      loading: true,
      highlightList: [1, 2, 3, 4, 5],
    };
  },
  methods: {
    refreshData: function () {
      this.loading = true;
      this.highlightList = [];
      this.$http.post(this.apiEndpoint, this.inputQuery).then((response) => {
        if (response.data.success) {
          const highlightData = response.data.highlightData;
          this.highlightList = highlightData;
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

.highlight-list {
  list-style-type: none;
}

</style>