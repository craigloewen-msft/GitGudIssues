<template>
  <div class="issuebox">
    <div class="gh-issue-box col-6">
      <div class="issue-state-box">
        <IssueStateIndicator :state="issueData.state"></IssueStateIndicator>
      </div>
      <div class="issue-info-box" v-on:click="markIssueAsRead">
        <div class="issue-title-box">
          <a
            class="Link--primary"
            :href="
              'https://github.com/' +
              issueData.url.split('https://api.github.com/repos/').pop()
            "
            >{{ issueData.title }}</a
          >
        </div>
        <div class="issue-sub-info-box">
          <p>
            {{ issueData.number }} by {{ issueData.user.login }} created
            {{ getRelativeDate(issueData.created_at) }} updated
            {{ getRelativeDate(issueData.updated_at) }}
          </p>
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
            ></div>
          </div>
        </span>
        <span class="ml-2 flex-1 flex-shrink-0">
          <a :href="issueData.comments_url" class="Link--muted comment-bubble">
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
            <span class="text-small text-bold comment-num">1</span>
          </a>
        </span>
      </div>
    </div>
    <div class="issue-controls-box col-6">
      <p>Issue label lists</p>
      <p>Issue add to list</p>
      <p>Issue is read or unread</p>
      <p v-on:click="markIssueAsUnread">✉️</p>
    </div>
  </div>
</template>

<script>
import IssueStateIndicator from "../components/IssueStateIndicator";
export default {
  name: "IssueInfoBox",
  components: {
    IssueStateIndicator,
  },
  props: {
    issueData: Object,
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
    markIssueAsRead: function() {

    },
    markIssueAsUnread: function() {

    }
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
  justify-content: left;
}

.issue-state-box {
  display: flex;
  padding-left: 16px;
  padding-top: 8px;
  padding-bottom: 8px;
}

.issue-info-box {
  display: flex;
  flex-direction: column;
  padding: 8px;
}

.issue-title-box {
  display: flex;
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
</style>