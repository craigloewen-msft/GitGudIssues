<template>
  <div class="pageContent">
    <b-container fluid>
      <h1 class="pb-2">
        <span class="font-weight-lighter">repo:</span>
        {{ inputQuery.repos }}
      </h1>
      <h2>{{ inputQuery.milestones }}</h2>
      <div>
        <div>
          <b-button
            v-b-toggle.collapse-1
            variant="outline-secondary"
            size="sm"
            class="font-weight-bold"
          >
            <b-icon icon="gear-fill" aria-hidden="true"></b-icon> Settings
          </b-button>
          <b-collapse id="collapse-1" class="mt-2">
            <b-form-select
              size="md"
              class="text-center w-50"
              variant="outline-secondary"
              v-model="inputQuery.repos"
              v-debounce:1s="refreshData"
              @change="refreshData"
              v-b-tooltip.hover.rightbottom.v-primary="'Change repo'"
            >
              <b-form-select-option
              :value="null"
              disabled
              >
              Select a repo:
              </b-form-select-option>
              <b-form-select-option
                v-for="repo in this.repoList"
                :key="repo.id"
                :value="repo.title"
              >
              {{ repo.title }}
              </b-form-select-option>
            </b-form-select>
            <b-form-group
              v-slot="{ ariaDescribedby }"
              role="switch"
              class="pt-2"
            >
              <b-form-checkbox-group
                v-model="selected"
                :options="options"
                :aria-describedby="ariaDescribedby"
                switches
              >
              </b-form-checkbox-group>
            </b-form-group>
            <b-row class="pb-2 mx-auto" style="width: 475px">
              <b-col class="mx-auto">
                <b-input-group>
                  <b-form-input
                    type="search"
                    placeholder="Search labels"
                  ></b-form-input>
                  <b-input-group-append>
                    <b-button
                      size="sm"
                      type="submit"
                      variant="outline-secondary"
                      ><b-icon-search
                    /></b-button>
                  </b-input-group-append>
                </b-input-group>
              </b-col>
            </b-row>
            <b-row class="pb-2 mx-auto" style="width: 475px">
              <b-col class="mx-auto">
                <b-input-group>
                  <b-form-input
                    type="search"
                    placeholder="Search milestones"
                  ></b-form-input>
                  <b-input-group-append>
                    <b-button
                      size="sm"
                      type="submit"
                      variant="outline-secondary"
                      ><b-icon-search
                    /></b-button>
                  </b-input-group-append>
                </b-input-group>
              </b-col>
            </b-row>
          </b-collapse>
        </div>
      </div>
    </b-container>

    <b-container>
      <b-row>
        <b-col>
          <label for="graph-start-date" class="font-weight-bold"
            >Start Date:</label
          >
          <b-form-datepicker
            id="graph-start-date"
            v-model="inputQuery.startDate"
            class="mb-2"
            @input="refreshData"
            menu-class="w-100"
            calendar-width="100%"
          >
          </b-form-datepicker>
        </b-col>
        <b-col>
          <label for="graph-end-date" class="font-weight-bold">End Date:</label>
          <b-form-datepicker
            id="graph-end-date"
            v-model="inputQuery.endDate"
            class="mb-2"
            @input="refreshData"
            menu-class="w-100"
            calendar-width="100%"
          >
          </b-form-datepicker>
        </b-col>
      </b-row>
      <b-row>
      </b-row>
    </b-container>

    <b-container class="fixed-bottom">
      <div v-if="hoverNode">
        <div v-if="hoverNode.group == 'issue'">
          <p>Node Type: Issue<br>
            <span class="font-weight-bold text-info">{{ hoverNode.totalVal }}</span>
            total interactions or
            <span class="font-weight-bold text-info">{{ ((hoverNode.totalVal * 100.0) / totalInteractions).toFixed(2) }}%</span>
            of all during this time.<br>
            <span class="font-weight-bold text-info">{{ getNodeWithLinkedIssuesSize(hoverNode) }}</span>
            total including directly linked issues or
            <span class="font-weight-bold text-info">{{ ((getNodeWithLinkedIssuesSize(hoverNode) * 100.0) / totalInteractions).toFixed(2) }}%.</span>
          </p>
        </div>
        <div v-else-if="hoverNode.group == 'label'">
          <p>Node Type: Label<br>
            <span class="font-weight-bold text-info">{{ hoverNode.totalVal }}</span>
            total interactions or
            <span class="font-weight-bold text-info">{{ ((hoverNode.totalVal * 100.0) / totalInteractions).toFixed(2) }}%</span>
            of all during this time.<br>
            <span class="font-weight-bold text-info">{{ getLabelNodeWithLinkedIssuesSize(hoverNode) }}</span>
            total including directly linked issues or
            <span class="font-weight-bold text-info">{{ ((getLabelNodeWithLinkedIssuesSize(hoverNode) * 100.0) / totalInteractions).toFixed(2) }}%.</span>
          </p>
        </div>
        <div v-else-if="hoverNode.group == 'comment'">
          <p>Node Type: Comment<br>
            <span class="font-weight-bold text-info">{{ hoverNode.totalVal }}</span>
            total interactions or
            <span class="font-weight-bold text-info">{{ ((hoverNode.totalVal * 100.0) / totalInteractions).toFixed(2) }}%</span>
            of all during this time.
          </p>
        </div>
      </div>
      <p class="h5 pb-3 font-weight-light">
        Total Interactions:
        <span class="font-weight-bold text-info">{{ totalInteractions }}</span>
      </p>
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
      selected: ["labels"],
      options: [
        { text: "Labels", value: "labels" },
        { text: "Comments", value: "comments" },
        { text: "Reactions", value: "reactions" },
        { text: "Milestones", value: "milestones" },
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
      totalInteractions: 0,
      repoList: [],
      graphElement: null,
    };
  },
  watch: {
    selected(value) {
      this.applyFilters();
    },
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
      this.totalInteractions = 0;
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

        // If it's an issue count the total interactions
        if (nodeVisitor.group === "issue") {
          this.totalInteractions += nodeVisitor.totalVal;
        }
      }

      // Get neighbour data
      for (let i = this.filteredData.links.length - 1; i >= 0; i--) {
        let linkVisitor = this.filteredData.links[i];
        let source = this.nodeList[linkVisitor.source];
        let target = this.nodeList[linkVisitor.target];

        if (
          !isLabelsSelected &&
          (source === undefined || target === undefined)
        ) {
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

        if (!target.linkFromList) {
          target.linkFromList = [];
        }
        target.linkFromList.push(source);
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

      this.graphElement
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
    getNodeWithLinkedIssuesSize(inNode) {
      let totalSize = 0;
      totalSize += inNode.totalVal;
      if (inNode.linkFromList) {
        inNode.linkFromList.forEach((neighbor) => {
          if (neighbor.group === "issue") {
            totalSize += neighbor.totalVal;
          }
        });
      }
      return totalSize;
    },
    getLabelNodeWithLinkedIssuesSize(inNode) {
      let totalSize = 0;
      if (inNode.linkFromList) {
        inNode.linkFromList.forEach((neighbor) => {
          if (neighbor.group === "issue") {
            totalSize += this.getNodeWithLinkedIssuesSize(neighbor);
          }
        });
      }
      return totalSize;
    },
  },
  mounted: function () {
    this.graphElement = ForceGraph()(document.getElementById("graph"));
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