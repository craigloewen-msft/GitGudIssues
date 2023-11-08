<script>
import { Doughnut } from "vue-chartjs";

export default {
  extends: Doughnut,
  name: "PieGraphBase",
  props: {
    inputQuery: Object,
    chartEndPoint: String,
    color: String,
  },
  data() {
    return {
      loading: true,
      labels: ["January", "February", "March", "April", "May", "June", "July"],
      datasets: [
        {
          label: "Data One",
          backgroundColor: "#f87979",
          data: [40, 39, 10, 40, 39, 80, 40],
        },
      ],
    };
  },
  methods: {
    startRender: function () {
      this.renderChart(
        {
          labels: this.labels,
          datasets: this.datasets,
        },
        { responsive: true, maintainAspectRatio: false }
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
          this.labels = graphData.labels;
          this.datasets = graphData.datasets;

          let shadeAmount = 50;
          let repoCount = this.datasets.length;

          if (repoCount) {
            shadeAmount = 90 / repoCount;
          }

          for (let i = 0; i < this.datasets.length; i++) {
            let datasetItem = this.datasets[i];
            let repoNumber = i;
            let backgroundColorArray = [];

            for (let j = 0; j < datasetItem.data.length; j++) {
              backgroundColorArray.push(
                this.shadeColor(this.color, j * shadeAmount)
              );
            }

            datasetItem.backgroundColor = backgroundColorArray;
          }

          this.loading = false;
          this.startRender();
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