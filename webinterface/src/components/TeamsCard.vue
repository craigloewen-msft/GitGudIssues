<template>
  <div class="card">
    <div class="card-body">
      <div class="title-row-controls">
        <h3 class="card-title" v-if="!editMode">{{ team.name }}</h3>
        <div
          v-if="!editMode && (team.owner == userid || team.owner._id == userid)"
        >
          <b-button size="sm" v-on:click="enterEditMode">Edit</b-button>
        </div>
        <b-form-input v-if="editMode" v-model="team.name"></b-form-input>
        <div v-if="editMode" class="title-row-controls-right">
          <b-button size="sm" v-on:click="saveTeam">Save</b-button>
          <b-button size="sm" v-on:click="deleteTeam(team)">Delete</b-button>
          <b-button size="sm" v-on:click="cancelEditMode">Cancel</b-button>
        </div>
      </div>
      <div class="row">
        <!-- Members info section -->
        <div class="col-md-6">
          <h3>Members</h3>
          <div v-for="(member, memberIndex) in team.users" :key="memberIndex">
            <div
              class="item-remove-box"
              :class="{ 'item-remove-box-padding': editMode }"
            >
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
          </div>
          <b-button v-if="editMode" v-b-modal="'team-invite-modal' + team._id"
            >Invite Member</b-button
          >
          <b-modal :id="'team-invite-modal' + team._id" title="Invite modal">
            <p>To invite someone to this team please send them this link:</p>
            <p>
              {{
                this.$router.resolve({ path: "/team/invite/" + team._id }).href
              }}
            </p>
            <p>Or copy the address of this link:</p>
            <router-link :to="'/team/invite/' + team._id">Link</router-link>
          </b-modal>
        </div>
        <div class="col-md-6">
          <h3>Repos</h3>
          <div>
            <div
              v-if="editMode && errorText"
              class="alert alert-danger"
              role="alert"
            >
              {{ errorText }}
            </div>
            <div v-for="(repo, repoIndex) in team.repos" :key="repoIndex">
              <div
                class="item-remove-box"
                :class="{ 'item-remove-box-padding': editMode }"
              >
                <div>
                  {{ repo.shortURL }}
                </div>
                <b-button
                  v-if="editMode"
                  size="sm"
                  v-on:click="removeRepo(repo)"
                  >Remove Repo</b-button
                >
              </div>
            </div>
          </div>
          <div class="user-repo-input-box" v-if="editMode">
            <b-form-input
              class="repo-input-form form-control-sm form-control"
              style="width: 60%"
              v-model="repoInput"
            ></b-form-input>
            <b-button size="sm" v-on:click="addRepo(repoInput)"
              >Add Repo</b-button
            >
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: "TeamsCard",
  props: {
    team: Object,
    userRepoList: {
      type: Array,
      required: true,
      default() {
        return [];
      },
    },
    inEditMode: { type: Boolean, required: false, default: false },
  },
  data() {
    return {
      editMode: false,
      loading: true,
      userid: this.$store.state.user.id,
      repoInput: "",
      errorText: "",
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
      // Clear any error text
      this.errorText = "";

      this.$http.post("/api/updateteam/", this.team).then((response) => {
        if (response.data.success) {
          this.cancelEditMode();
        } else {
          this.errorText = "Server error when trying to save team update";
          console.log(response);
        }
      });
      this.$gtag.event("saveTeam", {
        event_category: "teamFunctions",
        event_label: this.team.name,
        value: 1,
      });
    },
    cancelEditMode: function () {
      this.editMode = false;
      this.reposToAddList = [];
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
    addRepo: function (inputRepo) {
      this.$gtag.event("addRepo", {
        event_category: "teamFunctions",
        event_label: this.repoInput,
        value: 1,
      });
      this.errorText = "";
      let inputRepoVisitor = inputRepo;
      let userRepoFind = this.userRepoList.find(
        (userRepo) => userRepo.title == inputRepoVisitor
      );
      if (!userRepoFind) {
        this.errorText =
          "Your repo input isn't valid. Please ensure that you follow each repository \
          (You can do so above) and that each repo name is spelled correctly.";
      } else {
        this.team.repos.push({
          shortURL: userRepoFind.title,
          _id: userRepoFind._id,
        });
        this.repoInput = "";
      }
    },
    removeRepo: function (inputRepo) {
      let removeIndex = this.team.repos.indexOf(inputRepo);
      if (this.removeIndex != -1) {
        this.team.repos.splice(removeIndex, 1);
      }
    },
  },
  mounted() {
    this.editMode = this.inEditMode;
  },
};
</script>

<style>
.item-remove-box {
  display: flex;
  align-items: center;
  justify-content: center;
}

.item-remove-box-padding {
  margin: 10px;
}

.item-remove-box-padding button {
  margin-left: 10px;
}
</style>