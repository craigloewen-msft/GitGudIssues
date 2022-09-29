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
    <div>
      <br>
      <b-form-group label="Settings" v-slot="{ ariaDescribedby }" role="switch">
        <b-form-checkbox-group
          v-model="selected"
          :options="options"
          :aria-describedby="ariaDescribedby"
          switches
        >
        </b-form-checkbox-group>
        <b-form-input
          placeholder="bug,feature"
          size="sm"
          v-model="inputQuery.graphLabels"
          v-debounce:1s="refreshData"
          @keyup.enter="refreshIssues"
        ></b-form-input>
      </b-form-group>
    </div>
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
      selected: [],
      options: [
        { text: "Labels", value: "labels" },
        // { text: "Comments", value: "comments" },
        // { text: "Reactions", value: "reactions" },
        // { text: "Milestones", value: "milestones" }
      ],
      loading: false,
      inputQuery: {
        repos: "",
        // startDate: new Date(new Date().setDate(new Date().getDate() - 1)),
        startDate: new Date(new Date().setMonth(new Date().getMonth() - 3)),
        endDate: new Date(new Date().setDate(new Date().getDate() + 1)),
        graphLabels: "",
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
      filteredData: {},
      nodeList: {},
      highlightNodes: new Set(),
      highlightLinks: new Set(),
      hoverNode: null,
      repoList: [],
    };
  },
  watch: {
    selected(value) {
      this.applyFilters();
    }
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
            this.prepareDataForGraph();
            this.renderGraph();
          } else {
            console.log(response);
          }
        });
    },
    applyFilters: function () {
      this.prepareDataForGraph();
      this.renderGraph();
    },
    prepareDataForGraph: function () {
      this.filteredData = JSON.parse(JSON.stringify(this.myData));
      this.nodeList = {};
      const isLabelsSelected = this.selected.includes("labels");

      // Get searchable node list
      for (let i = this.filteredData.nodes.length - 1; i >= 0; i--) {
        let nodeVisitor = this.filteredData.nodes[i];
        if (!isLabelsSelected && nodeVisitor.group === "label") {
          this.filteredData.nodes.splice(i, 1);
        } else {
          this.nodeList[nodeVisitor.id] = nodeVisitor;
        }
      }
      
      // Get neighbour data
      for (let i = this.filteredData.links.length - 1; i >= 0; i--) {
        let linkVisitor = this.filteredData.links[i];
        let source = this.nodeList[linkVisitor.source];
        let target = this.nodeList[linkVisitor.target];

        if (!isLabelsSelected && (source === undefined || target === undefined)) {
          this.filteredData.links.splice(i, 1);
          continue;
        }
        
        if (!source.neighbors) {
          source.neighbors = [];
        }
        source.neighbors.push(target);

        if (!target.neighbors) {
          target.neighbors = [];
        }
        target.neighbors.push(source);

        if (!source.links) {
          source.links = [];
        }
        source.links.push(linkVisitor);

        if (!target.links) {
          target.links = [];
        }
        target.links.push(linkVisitor);
      }
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
        .graphData(this.filteredData)
        .nodeAutoColorBy("group")
        .d3AlphaDecay(0.05)
        .d3VelocityDecay(0.2)
        // TODO: How to adjust the nodes to repel more if they are larger??
        .onNodeHover((node) => {
          this.highlightNodes.clear();
          this.highlightLinks.clear();
          if (node) {
            this.highlightNodes.add(node);
            if (node.neighbors) {
              node.neighbors.forEach((neighbor) =>
                this.highlightNodes.add(neighbor)
              );
            }
            if (node.links) {
              node.links.forEach((link) => this.highlightLinks.add(link));
            }
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