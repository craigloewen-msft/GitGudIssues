<template>
  <div class="issue-table">
    <div class="title-row-controls">
      <div class="title-row-controls-left">
        <h3 v-if="!editMode">{{ inputQuery.title }}</h3>
        <div v-if="!editMode">
          <b-button size="sm" v-on:click="enterEditMode">Edit</b-button>
        </div>
        <b-form-input v-if="editMode" v-model="inputQuery.title"></b-form-input>
      </div>
      <div v-if="editMode" class="title-row-controls-right">
        <b-button size="sm" v-on:click="saveQuery">Save</b-button>
        <b-button size="sm" v-on:click="deleteQuery">Delete</b-button>
        <b-button size="sm" v-on:click="cancelEditMode">Cancel</b-button>
      </div>
    </div>
    <div class="table-header-buttons">
      <div class="table-header-buttons-group">
        <b-dropdown
          id="dropdown-1"
          text="Repo"
          class="m-md-2"
          size="sm"
          variant="outline-secondary"
        >
          <b-dropdown-form>
            <b-form-input
              placeholder="microsoft/wsl,microsoft/vscode"
              size="sm"
              v-model="inputQuery.repos"
              v-debounce:1s="refreshIssues"
              @keyup.enter="refreshIssues"
            ></b-form-input>
          </b-dropdown-form>
        </b-dropdown>

        <b-dropdown
          id="dropdown-1"
          text="State"
          class="m-md-2"
          size="sm"
          variant="outline-secondary"
        >
          <b-dropdown-item
            :active="inputQuery.state == 'open'"
            v-on:click="setQueryProperty('state', 'open')"
            >Open</b-dropdown-item
          >
          <b-dropdown-item
            :active="inputQuery.state == 'closed'"
            v-on:click="setQueryProperty('state', 'closed')"
            >Closed</b-dropdown-item
          >
          <b-dropdown-item
            :active="inputQuery.state == 'all'"
            v-on:click="setQueryProperty('state', 'all')"
            >All</b-dropdown-item
          >
        </b-dropdown>

        <b-dropdown
          id="dropdown-1"
          text="Sort"
          class="m-md-2"
          size="sm"
          variant="outline-secondary"
        >
          <b-dropdown-item
            :active="inputQuery.sort == 'created'"
            v-on:click="setQueryProperty('sort', 'created')"
            >Created</b-dropdown-item
          >
          <b-dropdown-item
            :active="inputQuery.sort == 'updated'"
            v-on:click="setQueryProperty('sort', 'updated')"
            >Updated</b-dropdown-item
          >
        </b-dropdown>

        <b-dropdown
          id="dropdown-1"
          text="Author"
          class="m-md-2"
          size="sm"
          variant="outline-secondary"
        >
          <b-dropdown-form>
            <b-form-input
              placeholder="Author GH alias"
              size="sm"
              v-model="inputQuery.creator"
              v-debounce:1s="refreshIssues"
              @keyup.enter="refreshIssues"
            ></b-form-input>
          </b-dropdown-form>
        </b-dropdown>

        <b-dropdown
          id="dropdown-1"
          text="Assignee"
          class="m-md-2"
          size="sm"
          variant="outline-secondary"
        >
          <b-dropdown-form>
            <b-form-input
              placeholder="Assignee GH alias"
              size="sm"
              v-model="inputQuery.assignee"
              v-debounce:1s="refreshIssues"
              @keyup.enter="refreshIssues"
              >Created</b-form-input
            >
          </b-dropdown-form>
        </b-dropdown>

        <b-dropdown
          id="dropdown-1"
          text="Labels"
          class="m-md-2"
          size="sm"
          variant="outline-secondary"
        >
          <b-dropdown-form>
            <b-form-input
              placeholder="bug,docs&gpu"
              size="sm"
              v-model="inputQuery.labels"
              v-debounce:1s="refreshIssues"
              @keyup.enter="refreshIssues"
              ></b-form-input
            >
          </b-dropdown-form>
        </b-dropdown>

        <b-dropdown
          id="dropdown-1"
          text="Site Labels"
          class="m-md-2"
          size="sm"
          variant="outline-secondary"
        >
          <b-dropdown-form>
            <b-form-input
              placeholder="debug,test"
              size="sm"
              v-model="inputQuery.siteLabels"
              v-debounce:1s="refreshIssues"
              @keyup.enter="refreshIssues"
              ></b-form-input
            >
          </b-dropdown-form>
        </b-dropdown>

         <b-dropdown
          id="dropdown-1"
          text="Limit"
          class="m-md-2"
          size="sm"
          variant="outline-secondary"
        >
          <b-dropdown-form>
            <b-form-input
              placeholder="debug,test"
              size="sm"
              v-model="inputQuery.limit"
              v-debounce:1s="refreshIssues"
              @keyup.enter="refreshIssues"
              ></b-form-input
            >
          </b-dropdown-form>
        </b-dropdown>
      </div>

      <div class="page-search-box">
        Page
        <b-form-input
          size="sm"
          type="number"
          v-model="inputQuery.page_num"
          v-debounce:1s="refreshIssues"
          @keyup.enter="refreshIssues"
          class="page-number-input"
          min="1"
          :max="Math.ceil(totalIssueCount / inputQuery.limit)"
        ></b-form-input>
        of {{ Math.ceil(totalIssueCount / inputQuery.limit) }} - Total Issues:
        {{ totalIssueCount }}
      </div>
    </div>
    <div v-for="(issue, issueIndex) in newestOpenIssues" :key="issueIndex">
      <IssueInfoBox v-bind:issue="issue"></IssueInfoBox>
    </div>
  </div>
</template>

<script>
import IssueInfoBox from "../components/IssueInfoBox";
export default {
  name: "MentionTable",
  components: {
    IssueInfoBox,
  },
  props: {
    inputQuery: Object,
    inEditMode: { type: Boolean, required: false, default: false}
  },
  data() {
    return {
      newestOpenIssues: [],
      totalIssueCount: 0,
      editMode: false,
    };
  },
  mounted() {
    this.refreshIssues();
    this.editMode = this.inEditMode;
  },
  methods: {
    setQueryProperty: function (inProperty, inValue) {
      this.inputQuery[inProperty] = inValue;
      this.refreshIssues();
    },
    refreshIssues: function () {
      this.$http.post("/api/getissues", this.inputQuery).then((response) => {
        if (response.data.success) {
          const returnedIssueList = response.data.queryData.issueData;
          const returnedCount = response.data.queryData.count;
          this.newestOpenIssues = returnedIssueList;
          this.totalIssueCount = returnedCount;
        } else {
          // TODO Add in some error catching condition
        }
      });
    },
    saveQuery: function () {
      this.$http
        .post("/api/modifyusermanageissuequery", {
          action: "save",
          query: this.inputQuery,
        })
        .then((response) => {
          if (response.data.success) {
            this.inputQuery._id = response.data.issueID;
            this.cancelEditMode();
          } else {
            console.log(response);
          }
        });
    },
    deleteQuery: function () {
      this.$http
        .post("/api/modifyusermanageissuequery", {
          action: "delete",
          query: this.inputQuery,
        })
        .then((response) => {
          if (response.data.success) {
            this.$emit("deleteQueryEvent");
          } else {
            console.log(response);
          }
        });
    },
    cancelEditMode: function () {
      this.editMode = false;
    },
    enterEditMode: function () {
      this.editMode = true;
    },
  },
};
</script>

<style>
.table-header-buttons {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.page-search-box {
  display: flex;
}

.page-number-input {
  height: 10px;
  width: 55px;
}

.title-row-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.title-row-controls-left {
  display: flex;
  align-items: center;
}

.title-row-controls-right {
  display: inline-block;
}

.title-row-controls button {
  margin-left: 5px;
}
</style>