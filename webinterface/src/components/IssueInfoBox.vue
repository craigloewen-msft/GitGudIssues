<template>
  <div class="issuebox">
    <div class="gh-issue-box col-8">
      <div class="issue-state-and-info-box">
        <div class="issue-state-box">
          <IssueStateIndicator :state="issue.state"></IssueStateIndicator>
        </div>
        <div
          class="issue-info-box"
          v-bind:class="{ 'read-issue': issue.readByUser }"
          v-on:click="markIssueAsRead"
          v-on:click.middle="markIssueAsRead"
        >
          <div class="issue-title-box">
            <a class="Link--primary" :href="getUrl">{{ issue.title }}</a>
            <span
              class="gh-issue-label"
              v-for="(ghIssueLabel, ghIssueLabelIndex) in issue.labels"
              :key="ghIssueLabelIndex"
              v-bind:style="{
                backgroundColor: shadeColor('#' + ghIssueLabel.color, -75),
              }"
            >
              {{ ghIssueLabel.name }}
            </span>
            <span
              class="gh-issue-label"
              v-for="(ghIssueLabel, ghIssueLabelIndex) in issue.aiLabels"
              :key="ghIssueLabelIndex"
              v-bind:style="{
                backgroundColor: shadeColor('#' + ghIssueLabel.color, -75),
              }"
            >
              ✨{{ ghIssueLabel.name }}
            </span>
          </div>
          <div class="issue-sub-info-box">
            <p v-if="!isMention">
              {{ issue.number }} by {{ issue.user.login }} created
              {{ getRelativeDate(issue.created_at) }} updated
              {{ getRelativeDate(issue.updated_at) }}
            </p>
            <p v-else>
              {{ issue.number }} by {{ issue.mentionAuthor }} mentioned
              {{ getRelativeDate(issue.mentionedAt) }}
            </p>
          </div>
        </div>
      </div>

      <div class="issue-comment-box col-2 text-right">
        <span class="ml-2 flex-1 flex-shrink-0"> </span>
        <span class="ml-2 flex-1 flex-shrink-0">
          <div class="AvatarStack AvatarStack--right ml-2 flex-1 flex-shrink-0">
            <div
              class="
                AvatarStack-body
                tooltipped
                tooltipped-sw
                tooltipped-multiline
                tooltipped-align-right-1
                mt-1
              "
              aria-label="Assigned to "
            >
              <div
                v-if="issue.assignee"
                class="
                  AvatarStack-body
                  tooltipped
                  tooltipped-sw
                  tooltipped-multiline
                  tooltipped-align-right-1
                  mt-1
                "
              >
                <a
                  class="avatar avatar-user"
                  :href="getUserAssignedIssuesURL(issue.assignee.login)"
                >
                  <img
                    class="from-avatar avatar-user"
                    :src="issue.assignee.avatar_url"
                    width="20"
                    height="20"
                    :alt="issue.assignee.login"
                  />
                </a>
              </div>
            </div>
          </div>
        </span>
        <span class="ml-2 flex-1 flex-shrink-0">
          <a :href="getUrl" class="Link--muted comment-bubble">
            <svg
              aria-hidden="true"
              height="16"
              viewBox="0 0 16 16"
              version="1.1"
              width="16"
              data-view-component="true"
              class="octicon octicon-comment v-align-middle"
            >
              <path
                fill-rule="evenodd"
                d="M2.75 2.5a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h2a.75.75 0 01.75.75v2.19l2.72-2.72a.75.75 0 01.53-.22h4.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25H2.75zM1 2.75C1 1.784 1.784 1 2.75 1h10.5c.966 0 1.75.784 1.75 1.75v7.5A1.75 1.75 0 0113.25 12H9.06l-2.573 2.573A1.457 1.457 0 014 13.543V12H2.75A1.75 1.75 0 011 10.25v-7.5z"
              ></path>
            </svg>
            <span class="text-small text-bold comment-num">{{
              issue.comments
            }}</span>
          </a>
        </span>
      </div>
    </div>
    <div class="issue-controls-box col-4">
      <div class="custom-tag-collection">
        <div
          class="custom-tag-box"
          v-for="(siteIssueLabel, siteIssueLabelIndex) in issue.siteLabels"
          :key="siteIssueLabelIndex"
        >
          {{ siteIssueLabel }}
          <a
            class="custom-tag-box-link"
            href="#"
            v-on:click="removeIssueLabel(siteIssueLabel)"
            >&times;</a
          >
        </div>
      </div>
      <div class="site-controls-box">
        <b-form-input
          size="sm"
          v-model="input.label"
          @keyup.enter="addIssueLabel"
          class="page-number-input"
        ></b-form-input>
        <p v-on:click="markIssueAsUnread">✉️</p>
      </div>
    </div>
  </div>
</template>

<script>
import IssueStateIndicator from "../components/IssueStateIndicator";
export default {
  name: "IssueInfoBox",
  data() {
    return {
      input: {
        label: "",
      },
    };
  },
  components: {
    IssueStateIndicator,
  },
  props: {
    issue: Object,
    isMention: { type: Boolean, required: false, default: false },
  },
  methods: {
    getRelativeDate: function (inDate) {
      var inputDate = Date.parse(inDate);
      var delta = Math.round((+new Date() - inputDate) / 1000);

      var minute = 60,
        hour = minute * 60,
        day = hour * 24,
        week = day * 7;

      var fuzzy;

      if (delta < 30) {
        fuzzy = "Just now";
      } else if (delta < minute) {
        fuzzy = delta + " seconds ago.";
      } else if (delta < 2 * minute) {
        fuzzy = "A minute ago";
      } else if (delta < hour) {
        fuzzy = Math.floor(delta / minute) + " minutes ago";
      } else if (Math.floor(delta / hour) == 1) {
        fuzzy = "1 hour ago";
      } else if (delta < day) {
        fuzzy = Math.floor(delta / hour) + " hours ago";
      } else if (delta < day * 2) {
        fuzzy = "Yesterday";
      } else if (delta < day * 30) {
        fuzzy = Math.floor(delta / day) + " days ago";
      } else {
        fuzzy = new Date(inputDate).toLocaleDateString("en-us", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
      }

      return fuzzy;
    },
    getUserAssignedIssuesURL: function (inLogin) {
      var returnString =
        "https://github.com/MicrosoftDocs/WSL/issues?q=assignee%3A" +
        inLogin +
        "+is%3Aopen";
      return returnString;
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
    markIssueAsRead: function () {
      if (!this.issue.readByUser) {
        this.issue.readByUser = true;
        this.$gtag.event("readIssue", {
          event_category: "issueFunctions",
          event_label: this.getUrl,
          value: 1,
        });
        this.$http
          .post("/api/setissueread", { issueID: this.issue._id })
          .then((response) => {
            if (!response.data.success) {
              // TODO Add in some error catching condition
              console.log(response);
              this.issue.readByUser = false;
            }
          });
      }
    },
    markIssueAsUnread: function () {
      if (this.issue.readByUser) {
        this.$gtag.event("unreadIssue", {
          event_category: "issueFunctions",
          event_label: this.getUrl,
          value: 1,
        });
        this.$http
          .post("/api/setissueunread", { issueID: this.issue._id })
          .then((response) => {
            if (response.data.success) {
              this.issue.readByUser = false;
            } else {
              console.log(response);
              // TODO Add in some error catching condition
            }
          });
      }
    },
    addIssueLabel: function () {
      if (this.issue.siteLabels.indexOf(this.input.label) == -1) {
        this.$gtag.event("addIssueLabel", {
          event_category: "issueLabelFunctions",
          event_label: this.input.label,
          value: 1,
        });
        this.$http
          .post("/api/setissuelabel", {
            issueID: this.issue._id,
            setLabel: this.input.label,
          })
          .then((response) => {
            if (response.data.success) {
              this.issue.siteLabels.push(this.input.label);
              this.input.label = "";
            } else {
              console.log(response);
              // TODO Add in some error catching condition
            }
          });
      }
    },
    removeIssueLabel: function (inIssueLabel) {
      var indexOfIssueLabel = this.issue.siteLabels.indexOf(inIssueLabel);
      if (indexOfIssueLabel != -1) {
        this.$gtag.event("removeIssueLabel", {
          event_category: "issueLabelFunctions",
          event_label: inIssueLabel,
          value: 1,
        });
        this.$http
          .post("/api/removeissuelabel", {
            issueID: this.issue._id,
            setLabel: inIssueLabel,
          })
          .then((response) => {
            if (response.data.success) {
              this.issue.siteLabels.splice(indexOfIssueLabel, 1);
            } else {
              console.log(response);
              // TODO Add in some error catching condition
            }
          });
      }
    },
  },
  computed: {
    getUrl() {
      if (this.isMention) {
        return this.issue.html_url;
      } else {
        return (
          "https://github.com/" +
          this.issue.url.split("https://api.github.com/repos/").pop()
        );
      }
    },
  },
};
</script>

<style>
.issuebox p {
  margin-bottom: 0px;
}

.issuebox a {
  text-decoration: none;
}

.issuebox {
  display: flex;
  justify-content: space-between;
  border: 1px solid black;
}

.gh-issue-box {
  display: flex;
  justify-content: space-between;
}

.issue-state-box {
  display: flex;
  padding-left: 16px;
  padding-top: 8px;
  padding-bottom: 8px;
}

.issue-state-and-info-box {
  display: flex;
}

.issue-info-box {
  display: flex;
  flex-direction: column;
  padding: 8px;
}

.issue-title-box {
  display: inline-block;
  font-weight: 600;
  font-size: 16px;
}

.issue-sub-info-box {
  display: flex;
  font-size: 12px;
  margin-top: 4px;
  color: #8b949e;
}

.issue-comment-box {
  display: flex;
}

.issue-controls-box {
  display: flex;
  justify-content: space-between;
}

.ml-2 {
  margin-left: 8px;
}

.flex-shrink-0 {
  flex-shrink: 0;
}

.flex-1 {
  flex: 1;
}

.Link--muted {
  color: #8b949e;
}

.text-bold {
  font-weight: 600;
}

.text-small {
  font-size: 12px;
}

.text-right {
  text-align: right;
}

.comment-num {
  margin-left: 3px;
}

.octicon {
  display: inline-block;
  overflow: visible !important;
  vertical-align: text-bottom;
  fill: currentColor;
}

.comment-bubble {
  display: flex;
  margin-top: 15px;
  margin-right: 5px;
}

.read-issue a {
  color: #9ba3aa;
  font-weight: 100;
}

.gh-issue-label {
  padding: 0 7px;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
  border: 1px solid transparent;
  border-radius: 2em;
  padding-top: 2px;
  margin-left: 4px;
  display: inline-block;
}

.avatar-user {
  border-radius: 50%;
}

.gh-issue-label-box {
  display: inline;
}

.site-controls-box {
  display: flex;
}
</style>