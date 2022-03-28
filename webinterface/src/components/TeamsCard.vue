<template>
  <div>
    <div class="title-row-controls">
      <h3 v-if="!editMode">{{ team.name }}</h3>
      <div v-if="!editMode">
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
    <p v-for="(member, memberIndex) in team.users" :key="memberIndex">
      {{ member.githubUsername }}
    </p>
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
    saveTeam: function() {
      this.$http
        .post("/api/updateteam/", this.team)
        .then((response) => {
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
  },
  mounted() {
    this.editMode = this.inEditMode;
  },
};
</script>