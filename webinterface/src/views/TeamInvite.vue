<template>
  <div>
    <div v-if="inviteResult == 'in-team'">
      <h3>
        You've been invited to join this GitGudIssues team: {{ teamData.name }}
      </h3>
      <h3>You are already in this team!</h3>
    </div>
    <div v-else-if="inviteResult == 'not-in-team'">
      <h3>You've been invited to join {{ teamData.name }}</h3>
      <button v-on:click="acceptInvite" class="btn btn-secondary" type="button">
        Accept
      </button>
      <button
        v-on:click="declineInvite"
        class="btn btn-secondary"
        type="button"
      >
        Decline
      </button>
    </div>
    <div v-else-if="inviteResult == 'added-to-team'">
      <h3>You've successfully joined the team!</h3>
    </div>
    <div v-else-if="inviteResult == 'error'">
      <h3>There's been a server error</h3>
    </div>
  </div>
</template>

<script>
export default {
  name: "TeamInvite",
  data() {
    return {
      inviteResult: null,
      inviteID: this.$route.params.invitestring,
      teamData: null,
    };
  },
  methods: {
    getInviteStatus: function () {
      this.$http
        .post("/api/getinvitestatus/", { inviteID: this.inviteID })
        .then((response) => {
          if (response.data.success) {
            this.inviteResult = response.data.inviteData.inviteStatus;
            this.teamData = response.data.inviteData.teamData;
          } else {
            console.log(response);
          }
        });
    },
    acceptInvite: function () {
      this.$http
        .post("/api/handleinvite/", {
          inviteID: this.inviteID,
          inviteRequest: "accept",
        })
        .then((response) => {
          if (response.data.success) {
            let inviteResponse = response.data.handleResult;
            this.inviteResult = "added-to-team";
          } else {
            console.log(response);
          }
        });
    },
    declineInvite: function () {
      //TODO: Make invites transient
    },
  },
  mounted() {
    this.getInviteStatus();
  },
};
</script>