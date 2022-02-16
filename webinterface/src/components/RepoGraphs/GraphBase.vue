<script>
import { Line } from "vue-chartjs";

export default {
  extends: Line,
  name: "GraphBase",
  props: {
    inputQuery: Object,
    chartEndPoint: String,
    chartColors: Array,
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
    refreshData: function () {
      this.loading = true;
      this.labels = [];
      this.datasets = {};
      this.$http
        .post(this.chartEndPoint, this.inputQuery)
        .then((response) => {
          if (response.data.success) {
            const graphData = response.data.graphData;
            this.labels = graphData.labels;
            this.datasets = graphData.datasets;

            for (let i = 0; i < this.datasets.length; i++) {
              let datasetItem = this.datasets[i];
              datasetItem.backgroundColor = this.chartColors[i % this.chartColors.length];
              // If there's a ton of data, the points on the graph only add noise
              if (datasetItem.data.length > 50) { datasetItem.pointStyle='line'; /* datasetItem.tension=0; */ }
            }

            this.loading = false;
            this.startRender();
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
