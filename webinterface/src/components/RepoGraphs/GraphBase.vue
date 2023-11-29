<template>
  <LineChart  v-if="!loading" :data="chartData" />
</template>

<script>
import 'chart.js/auto';
import { Line as LineChart } from "vue-chartjs";

export default {
  name: "GraphBase",
  components: {
    LineChart,
  },
  props: {
    inputQuery: Object,
    chartEndPoint: String,
    chartColors: Array,
  },
  data() {
    return {
      loading: true,
      chartData: null,
    };
  },
  methods: {
    refreshData: function () {
      this.loading = true;
      this.labels = [];
      this.datasets = {};
      this.$http
        .post(this.chartEndPoint, this.inputQuery)
        .then((response) => {
          if (response.data.success) {
            const graphData = response.data.graphData;

            let newChartData = {};

            newChartData.labels = graphData.labels;
            newChartData.datasets = graphData.datasets;
            newChartData.options = { responsive: true, maintainAspectRatio: false, scales: null }

            // If the user is looking at a milestone, we're gonna set the min
            // value to 0, so the burndown is a bit clearer. Otherwise, just
            // clear that out.
            if (this.inputQuery.milestones) {
              newChartData.options.scales = { "yAxes": [{ ticks: { "beginAtZero": true } }] };
            }
            else {
              newChartData.options.scales = null;
            }

            for (let i = 0; i < newChartData.datasets.length; i++) {
              let datasetItem = newChartData.datasets[i];
              
              // Set the line color
              datasetItem.borderColor = this.chartColors[i % this.chartColors.length];
              
              // Set the fill color
              datasetItem.backgroundColor = this.chartColors[i % this.chartColors.length] + '80'; // add transparency to the fill color
              
              // If there's a ton of data, the points on the graph only add
              // noise. Setting this to line will remove the points altogether.
              if (datasetItem.data.length > 50) {
                datasetItem.pointStyle = 'line';
              }
            }

            this.chartData = newChartData;

            this.loading = false;
          } else {
            // TODO Add in some error catching condition
            console.log(response);
          }
        });
    }
  },
  mounted() {
    this.refreshData();
  },
};
</script>
