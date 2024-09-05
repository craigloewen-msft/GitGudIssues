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
        <b-dropdown id="dropdown-1" text="Repo" class="m-md-2" size="sm" variant="outline-secondary">
          <b-form-input placeholder="microsoft/wsl,microsoft/vscode" size="sm" v-model="inputQuery.repos"
            v-debounce:1s="refreshIssues" @keyup.enter="refreshIssues"></b-form-input>
        </b-dropdown>

        <b-dropdown id="dropdown-1" text="State" class="m-md-2" size="sm" variant="outline-secondary">
          <b-dropdown-item :active="inputQuery.state == 'open'"
            v-on:click="setQueryProperty('state', 'open')">Open</b-dropdown-item>
          <b-dropdown-item :active="inputQuery.state == 'closed'"
            v-on:click="setQueryProperty('state', 'closed')">Closed</b-dropdown-item>
          <b-dropdown-item :active="inputQuery.state == 'all'"
            v-on:click="setQueryProperty('state', 'all')">All</b-dropdown-item>
        </b-dropdown>

        <b-dropdown id="dropdown-1" text="Sort" class="m-md-2" size="sm" variant="outline-secondary" v-if="!isMention">
          <b-dropdown-item :active="inputQuery.sort == 'created'"
            v-on:click="setQueryProperty('sort', 'created')">Created</b-dropdown-item>
          <b-dropdown-item :active="inputQuery.sort == 'updated'"
            v-on:click="setQueryProperty('sort', 'updated')">Updated</b-dropdown-item>
        </b-dropdown>

        <b-dropdown id="dropdown-1" text="Author" class="m-md-2" size="sm" variant="outline-secondary">
          <b-form-input placeholder="Author GH alias" size="sm" v-model="inputQuery.creator"
            v-debounce:1s="refreshIssues" @keyup.enter="refreshIssues"></b-form-input>
        </b-dropdown>

        <b-dropdown id="dropdown-1" text="Number" class="m-md-2" size="sm" variant="outline-secondary">
          <b-form-input placeholder="10,243,etc." size="sm" v-model="inputQuery.number"
            v-debounce:1s="refreshIssues"></b-form-input>
        </b-dropdown>

        <b-dropdown id="dropdown-1" text="Assignee" class="m-md-2" size="sm" variant="outline-secondary">
          <b-form-input placeholder="Assignee GH alias" size="sm" v-model="inputQuery.assignee"
            v-debounce:1s="refreshIssues" @keyup.enter="refreshIssues">Created</b-form-input>
        </b-dropdown>

        <b-dropdown id="dropdown-1" text="Commented" class="m-md-2" size="sm" variant="outline-secondary">
          <b-form-input placeholder="Commented GH Alias" size="sm" v-model="inputQuery.commentedAliases"
            v-debounce:1s="refreshIssues" @keyup.enter="refreshIssues">Created</b-form-input>
        </b-dropdown>

        <b-dropdown id="dropdown-1" text="Labels" class="m-md-2" size="sm" variant="outline-secondary">
          <b-form-input placeholder="bug,docs&gpu" size="sm" v-model="inputQuery.labels" v-debounce:1s="refreshIssues"
            @keyup.enter="refreshIssues"></b-form-input>
        </b-dropdown>

        <b-dropdown id="dropdown-1" text="Site Labels" class="m-md-2" size="sm" variant="outline-secondary">
          <b-form-input placeholder="debug,test" size="sm" v-model="inputQuery.siteLabels" v-debounce:1s="refreshIssues"
            @keyup.enter="refreshIssues"></b-form-input>
        </b-dropdown>

        <b-dropdown id="dropdown-1" text="Limit" class="m-md-2" size="sm" variant="outline-secondary">
          <b-form-input placeholder="debug,test" size="sm" v-model="inputQuery.limit" v-debounce:1s="refreshIssues"
            @keyup.enter="refreshIssues"></b-form-input>
        </b-dropdown>

        <b-dropdown id="dropdown-1" text="Read" class="m-md-2" size="sm" variant="outline-secondary">
          <b-dropdown-item :active="inputQuery.read == 'all'"
            v-on:click="setQueryProperty('read', 'all')">All</b-dropdown-item>
          <b-dropdown-item :active="inputQuery.read == 'Unread'"
            v-on:click="setQueryProperty('read', 'unread')">Unread</b-dropdown-item>
          <b-dropdown-item :active="inputQuery.read == 'read'"
            v-on:click="setQueryProperty('read', 'read')">Read</b-dropdown-item>
        </b-dropdown>

        <b-dropdown id="dropdown-1" text="Milestone" class="m-md-2" size="sm" variant="outline-secondary">
          <b-form-input placeholder="milestone" size="sm" v-model="inputQuery.milestones" v-debounce:1s="refreshIssues"
            @keyup.enter="refreshIssues"></b-form-input>
        </b-dropdown>
      </div>


      <div class="page-search-box">
        Page
        <b-form-input size="sm" type="number" v-model="inputQuery.page_num" v-debounce:1s="refreshIssues"
          @keyup.enter="refreshIssues" class="page-number-input" min="1"
          :max="Math.ceil(totalIssueCount / inputQuery.limit)"></b-form-input>
        of {{ Math.ceil(totalIssueCount / inputQuery.limit) }} - Total
        {{ isMention ? "Mentions" : "Issues" }}:
        {{ totalIssueCount }}
      </div>
    </div>
    <div v-for="(issue, issueIndex) in newestOpenIssues" :key="issueIndex">
      <IssueInfoBox v-bind:issue="issue" v-bind:isMention="isMention" v-bind:showAILabels="showAILabels"></IssueInfoBox>
    </div>
    <div v-if="loading">
      <div class="placeholder" style="width: 300px"></div>
      <br />
      <div class="placeholder" style="width: 300px"></div>
      <br />
      <div class="placeholder" style="width: 300px"></div>
      <br />
    </div>
  </div>
</template>

<script>
import IssueInfoBox from "../components/IssueInfoBox";
export default {
  name: "IssueTable",
  components: {
    IssueInfoBox,
  },
  props: {
    inputQuery: Object,
    inEditMode: { type: Boolean, required: false, default: false },
    getIssuesEndpoint: String,
    modifyIssuesEndpoint: String,
    isMention: { type: Boolean, required: false, default: false },
    showAILabels: { type: Boolean, required: false, default: false },
  },
  data() {
    return {
      newestOpenIssues: [],
      totalIssueCount: 0,
      editMode: false,
      loading: true,
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
    refreshIssues: async function () {
      this.loading = true;
      this.newestOpenIssues = [];
      let response = await this.$http.post(this.getIssuesEndpoint, this.inputQuery);

      if (response.data.success) {
        if (this.showAILabels) {
          // For each issue add the AI labels to it
          for (let i = 0; i < response.data.queryData.issueData.length; i++) {
            const issue = response.data.queryData.issueData[i];

            let aiLabelsResponse = await this.$http.post("/api/getailabels", {
              issueID: issue._id,
            });

            if (aiLabelsResponse.data.success) {
              issue.aiLabels = aiLabelsResponse.data.aiLabels;
            }
          }
        }

        console.log(response.data.queryData.issueData);
        const returnedIssueList = response.data.queryData.issueData;
        const returnedCount = response.data.queryData.count;
        this.newestOpenIssues = returnedIssueList;
        this.totalIssueCount = returnedCount;
        this.loading = false;
      } else {
        // TODO Add in some error catching condition
        console.log(response);
      }

    },
    saveQuery: function () {
      let tagEventName = null;
      if (this.isMention) {
        tagEventName = "saveMentionQuery";
      } else {
        tagEventName = "saveIssueQuery";
      }
      this.$gtag.event(tagEventName, {
        event_category: "queryFunctions",
        event_label: this.inputQuery.title,
        value: 5,
      });
      this.$http
        .post(this.modifyIssuesEndpoint, {
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
      let tagEventName = null;
      if (this.isMention) {
        tagEventName = "deleteMentionQuery";
      } else {
        tagEventName = "deleteIssueQuery";
      }
      this.$gtag.event(tagEventName, {
        event_category: "queryFunctions",
        event_label: this.inputQuery.title,
        value: 2,
      });
      this.$http
        .post(this.modifyIssuesEndpoint, {
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

<style></style>