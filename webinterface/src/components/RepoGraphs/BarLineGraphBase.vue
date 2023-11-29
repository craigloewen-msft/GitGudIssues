<template>
  <Bar v-if="!loading" :data="chartData" />
</template>

<script>
import 'chart.js/auto';
import { Bar } from "vue-chartjs";

export default {
  name: "BarLineGraphBase",
  components: {
    Bar,
  },
  props: {
    inputQuery: Object,
    chartEndPoint: String,
    positiveColor: String,
    negativeColor: String,
  },
  data() {
    return {
      loading: true,
      chartData: null,
    };
  },
  methods: {
    startRender: function () {
      this.renderChart(
        {
          labels: this.labels,
          datasets: this.datasets,
        },
        {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            yAxes: [
              {
                stacked: true,
              },
              {
                id: "line-y-axis",
                display: false,
              },
            ],
            xAxes: [
              {
                stacked: true,
              },
            ],
          },
        }
      );
    },
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
          newChartData.options = {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              yAxes: [
                {
                  stacked: true,
                },
                {
                  id: "line-y-axis",
                  display: false,
                },
              ],
              xAxes: [
                {
                  stacked: true,
                },
              ],
            },
          };

          let shadeAmount = 50;
          // let repoCount = (this.datasets.length - 3) / 2;
          let repoCount = this.datasets.length / 2;

          if (repoCount > 2) {
            shadeAmount = 90 / repoCount;
          }

          for (let i = 0; i < newChartData.datasets.length; i++) {
            let datasetItem = newChartData.datasets[i];
            // Magic number here: 3 datasets are already processed (opened, closed, net) and we divide it by 2 to account for open and closed
            // let repoNumber = Math.floor((i - 3) / 2);
            let repoNumber = Math.floor(i / 2);
            if (!datasetItem.type) {
              if (datasetItem.label.includes("closed")) {
                datasetItem.backgroundColor = this.shadeColor(
                  this.negativeColor,
                  repoNumber * shadeAmount
                );
              }
              if (datasetItem.label.includes("opened")) {
                datasetItem.backgroundColor = this.shadeColor(
                  this.positiveColor,
                  repoNumber * shadeAmount
                );
              }
            } else {
              let inputColor = "#FFFFFF";
              if (datasetItem.label == "Total opened") {
                inputColor = "#FFFFFF";
              } else if (datasetItem.label == "Total closed") {
                inputColor = "#333333";
              } else {
                inputColor = "#666666";
              }
              datasetItem.borderColor = inputColor;
            }
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