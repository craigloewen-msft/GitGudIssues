<template>
  <div class="pageContent">
    <b-container>
      <div>This is an experimental feature</div>

      <h1>{{ inputQuery.repos }}</h1>
      <h2>{{ inputQuery.milestones }}</h2>
      <div class="graph-title-and-controls">
        <div class="table-header-buttons">
          <b-dropdown
            id="dropdown-1"
            text="Repo"
            class="m-md-2"
            size="sm"
            variant="outline-secondary"
          >
            <b-form-input
              placeholder="microsoft/wsl,microsoft/vscode"
              size="sm"
              v-model="inputQuery.repos"
              v-debounce:1s="refreshData"
              @keyup.enter="refreshData"
            ></b-form-input>
          </b-dropdown>
        </div>
        <div class="table-header-buttons">
          <b-form-datepicker
            size="sm"
            v-model="inputQuery.startDate"
            class="mb-2"
            @input="refreshData"
          />
          <b-form-datepicker
            size="sm"
            v-model="inputQuery.endDate"
            class="mb-2"
            @input="refreshData"
          />
        </div>
      </div>
    </b-container>
    <div class="graphBox">
      <div id="graph"></div>
    </div>
  </div>
</template>

<script>
import ForceGraph from "force-graph";

export default {
  name: "RepoIssueGraph",
  data() {
    return {
      loading: false,
      inputQuery: {
        repos: "",
        // startDate: new Date(new Date().setDate(new Date().getDate() - 1)),
        startDate: new Date(new Date().setMonth(new Date().getMonth() - 3)),
        endDate: new Date(new Date().setDate(new Date().getDate() + 1)),
        inputPeriod: 0,
        milestones: "",
      },
      myData: {
        nodes: [
          {
            id: "id1",
            name: "name1",
            val: 1,
          },
          {
            id: "id2",
            name: "name2",
            val: 10,
          },
        ],
        links: [
          {
            source: "id1",
            target: "id2",
          },
        ],
      },
      nodeList: {},
      highlightNodes: new Set(),
      highlightLinks: new Set(),
      hoverNode: null,
      repoList: [],
    };
  },
  methods: {
    getInputRepos: function () {
      this.loading = true;
      this.repoList = [];
      this.$http
        .get("/api/user/" + this.$store.state.user.username + "/")
        .then((response) => {
          const someUserData = response.data.user;
          this.repoList = someUserData.repos;
          this.inputQuery.repos = this.repoList[0].title;
          this.loading = false;
          this.refreshData();
        });
    },
    refreshData: function () {
      this.loading = true;
      this.$http
        .post("/api/getrepoissuegraph", this.inputQuery)
        .then((response) => {
          if (response.data.success) {
            this.myData = response.data.graphData;

            // Get searchable node list
            for (let i = 0; i < this.myData.nodes.length; i++) {
              let nodeVisitor = this.myData.nodes[i];
              this.nodeList[nodeVisitor.id] = nodeVisitor;
            }

            // Get neighbour data
            for (let i = 0; i < this.myData.links.length; i++) {
              let linkVisitor = this.myData.links[i];
              let source = this.nodeList[linkVisitor.source];
              let target = this.nodeList[linkVisitor.target];

              !source.neighbors && (source.neighbors = []);
              source.neighbors.push(target);

              !target.neighbors && (target.neighbors = []);
              target.neighbors.push(source);

              !source.links && (source.links = []);
              source.links.push(linkVisitor);

              !target.links && (target.links = []);
              target.links.push(linkVisitor);
            }

            this.renderGraph();
          } else {
            console.log(response);
          }
        });
    },
    renderGraph: function () {
      let linkColorFunction = function (link) {
        if (this.hoverNode) {
          return this.highlightLinks.has(link)
            ? "rgba(255,255,255,0.30)"
            : "rgba(255,255,255,0.05)";
        } else {
          return "rgba(255,255,255,0.30)";
        }
      }.bind(this);

      const Graph = ForceGraph()(document.getElementById("graph"))
        .graphData(this.myData)
        .nodeAutoColorBy("group")
        .d3AlphaDecay(0.05)
        .d3VelocityDecay(0.2)
        .onNodeHover((node) => {
          this.highlightNodes.clear();
          this.highlightLinks.clear();
          if (node) {
            this.highlightNodes.add(node);
            node.neighbors.forEach((neighbor) =>
              this.highlightNodes.add(neighbor)
            );
            node.links.forEach((link) => this.highlightLinks.add(link));
          }

          this.hoverNode = node || null;
        })
        .nodeCanvasObject((node, ctx) => {
          // add ring just for highlighted nodes
          if (this.hoverNode) {
            if (!this.highlightNodes.has(node)) {
              ctx.beginPath();
              ctx.arc(node.x, node.y, node.val, 0, 2 * Math.PI, false);
              ctx.fillStyle = "rgba(255,255,255,0.10)";
              ctx.fill();
            } else {
              ctx.beginPath();
              ctx.arc(node.x, node.y, node.val, 0, 2 * Math.PI, false);
              ctx.fillStyle = node.color;
              ctx.fill();
            }
          } else {
            ctx.beginPath();
            ctx.arc(node.x, node.y, node.val, 0, 2 * Math.PI, false);
            ctx.fillStyle = node.color;
            ctx.fill();
          }
        })
        .autoPauseRedraw(false) // keep redrawing after engine has stopped
        .onNodeClick((node) => {
          if (node.url) {
            window.open(node.url);
          }
        })
        .linkColor(linkColorFunction);
    },
  },
  mounted: function () {
    this.$gtag.pageview(this.$route);
    this.getInputRepos();
  },
};
</script>


<style>
.graphBox {
  display: flex;
}
</style>