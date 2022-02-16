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
      options: {
        // We always want responsive: true,maintainAspectRatio: false.
        responsive: true,
        maintainAspectRatio: false,
        // If the user is looking at a milestone, we're gonna set the min value
        // to 0, so the burndown is a bit clearer.
        scales: null,
      }
    };
  },
  methods: {
    startRender: function () {
      console.log(this.options);
      this.renderChart(
        {
          labels: this.labels,
          datasets: this.datasets,
        },
        this.options
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

            // If the user is looking at a milestone, we're gonna set the min
            // value to 0, so the burndown is a bit clearer. Otherwise, just
            // clear that out.
            if (this.inputQuery.milestones) {
              this.options.scales = { "yAxes":[ { ticks: { "beginAtZero": true }} ] };
            }
            else{
              this.options.scales = null;
            }

            for (let i = 0; i < this.datasets.length; i++) {
              let datasetItem = this.datasets[i];
              datasetItem.backgroundColor = this.chartColors[i % this.chartColors.length];

              // If there's a ton of data, the points on the graph only add
              // noise. Setting this to line will remove the points altogether.
              if (datasetItem.data.length > 50) {
                datasetItem.pointStyle='line';
              }
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
