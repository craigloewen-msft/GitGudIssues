<template>
  <div>
    <div class="title-row-controls">
      <h3 v-if="!editMode">{{ team.name }}</h3>
      <div v-if="!editMode && (team.owner == userid || team.owner._id == userid)">
        <b-button size="sm" v-on:click="enterEditMode">Edit</b-button>
      </div>
      <b-form-input v-if="editMode" v-model="team.name"></b-form-input>
      <div v-if="editMode" class="title-row-controls-right">
        <b-button size="sm" v-on:click="saveTeam">Save</b-button>
        <b-button size="sm" v-on:click="cancelEditMode">Cancel</b-button>
        <b-button size="sm" v-on:click="deleteTeam(team)">Delete</b-button>
      </div>
    </div>
    <h3>Members</h3>
    <div v-for="(member, memberIndex) in team.users" :key="memberIndex">
      <div>
        {{ member.githubUsername }}
      </div>
      <b-button
        v-if="editMode && member._id != userid"
        size="sm"
        v-on:click="removeTeamMember(member)"
        >Remove</b-button
      >
    </div>
    <b-button v-b-modal="'team-invite-modal' + team._id"
      >Invite Member</b-button
    >
    <b-modal :id="'team-invite-modal' + team._id" title="Invite modal">
      <p>To invite someone to this team please send them this link:</p>
      <p>
        {{ this.$router.resolve({ path: "/team/invite/" + team._id }).href }}
      </p>
      <p>Or copy the address of this link:</p>
      <router-link :to="'/team/invite/' + team._id">Link</router-link>
    </b-modal>
    <h3>Repos</h3>
    <p v-for="(repo, repoIndex) in team.repos" :key="repoIndex">
      {{ repo.shortURL }}
    </p>
  </div>
</template>

<script>
export default {
  name: "TeamsCard",
  props: {
    team: Object,
    inEditMode: { type: Boolean, required: false, default: false },
  },
  data() {
    return {
      editMode: false,
      loading: true,
      userid: this.$store.state.user.id,
    };
  },
  methods: {
    deleteTeam: function (inTeam) {
      this.$http
        .post("/api/deleteteam/", { teamID: inTeam._id })
        .then((response) => {
          if (response.data.success) {
            this.$emit("deleteTeamsEvent", response.data.teamsList);
          }
        });
    },
    saveTeam: function () {
      this.$http.post("/api/updateteam/", this.team).then((response) => {
        if (response.data.success) {
          this.cancelEditMode();
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
    removeTeamMember: function (inMember) {
      let filteredTeamList = this.team.users.filter(
        (user) => user._id != inMember._id
      );
      this.team.users = filteredTeamList;
    },
  },
  mounted() {
    this.editMode = this.inEditMode;
  },
};
</script>