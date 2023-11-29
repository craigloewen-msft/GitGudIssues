<template>
  <Doughnut v-if="!loading" :data="chartData" />
</template>

<script>
import 'chart.js/auto';
import { Doughnut } from "vue-chartjs";

export default {
  name: "PieGraphBase",
  components: {
    Doughnut,
  },
  props: {
    inputQuery: Object,
    chartEndPoint: String,
    color: String,
  },
  data() {
    return {
      loading: true,
      chartData: null,
    };
  },
  methods: {
    shadeColor: function (color, percent) {
      // Credit to this Stack overflow https://stackoverflow.com/questions/5560248/programmatically-lighten-or-darken-a-hex-color-or-rgb-and-blend-colors
      // Thank you Pablo! :)
      var R = parseInt(color.substring(1, 3), 16);
      var G = parseInt(color.substring(3, 5), 16);
      var B = parseInt(color.substring(5, 7), 16);

      R = parseInt((R * (100 + percent)) / 100);
      G = parseInt((G * (100 + percent)) / 100);
      B = parseInt((B * (100 + percent)) / 100);

      R = R < 255 ? R : 255;
      G = G < 255 ? G : 255;
      B = B < 255 ? B : 255;

      var RR =
        R.toString(16).length == 1 ? "0" + R.toString(16) : R.toString(16);
      var GG =
        G.toString(16).length == 1 ? "0" + G.toString(16) : G.toString(16);
      var BB =
        B.toString(16).length == 1 ? "0" + B.toString(16) : B.toString(16);

      return "#" + RR + GG + BB;
    },
    refreshData: function () {
      this.loading = true;
      this.labels = [];
      this.datasets = {};

      this.$http.post(this.chartEndPoint, this.inputQuery).then((response) => {
        if (response.data.success) {
          const graphData = response.data.graphData;

          let newChartData = {};

          newChartData.labels = graphData.labels;
          newChartData.datasets = graphData.datasets;

          let shadeAmount = 50;
          let repoCount = this.datasets.length;

          if (repoCount) {
            shadeAmount = 90 / repoCount;
          }

          for (let i = 0; i < newChartData.datasets.length; i++) {
            let datasetItem = newChartData.datasets[i];
            let repoNumber = i;
            let backgroundColorArray = [];

            for (let j = 0; j < datasetItem.data.length; j++) {
              backgroundColorArray.push(
                this.shadeColor(this.color, j * shadeAmount)
              );
            }

            datasetItem.backgroundColor = backgroundColorArray;
          }

          this.chartData = newChartData;

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