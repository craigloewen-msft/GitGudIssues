<template>
  <div class="pageContent">
    <b-container>
      <h1>Welcome {{ user.username }} !</h1>
      <h2>Your followed repositories</h2>
      <div class="user-repo-control-box">
        <div class="custom-tag-collection">
          <div
            class="custom-tag-box"
            v-for="(repoInfo, repoIndex) in user.repos"
            :key="repoIndex"
          >
            {{ repoInfo.title }} {{ !repoInfo.updating ? "" : " - Updating" }}
            <a
              class="custom-tag-box-link"
              href="#"
              v-on:click="removeUserRepo(repoIndex)"
              >&times;</a
            >
          </div>
        </div>
        <div class="small-input-form-box">
          <b-form-input
            size="sm"
            v-model="input.repo"
            @keyup.enter="addUserRepo"
          ></b-form-input>
        </div>
      </div>
      <p class="text-muted">
        You can add repos that you're interested in here by typing them in above
        and pressing enter.
      </p>
      <router-link class="btn btn-primary" to="/manageissues"
        >Start triaging issues!</router-link
      >
      <b-button class="btn btn-primary" v-on:click="refreshRepos"
        >Refresh repos</b-button
      >
    </b-container>
  </div>
</template>

<script>
import router from "../router";

export default {
  name: "User",
  data() {
    return {
      user: this.$store.state.user,
      input: {
        repo: "",
      },
    };
  },
  methods: {
    addUserRepo: function () {
      if (this.user.repos.indexOf(this.input.repo) == -1) {
        this.$http
          .post("/api/setuserrepo", {
            repo: this.input.repo,
          })
          .then((response) => {
            if (response.data.success) {
              this.refreshUserInfoUntilNonUpdated();
              this.input.repo = "";
            } else {
              console.log(response);
              // TODO Add in some error catching condition
            }
          });
      }
    },
    removeUserRepo: function (inputRepoIndex) {
      let repoIndex = inputRepoIndex;
      if (repoIndex != -1) {
        this.$http
          .post("/api/removeuserrepo", {
            repo: this.user.repos[repoIndex].title,
          })
          .then((response) => {
            if (response.data.success) {
              this.user.repos.splice(repoIndex, 1);
            } else {
              console.log(response);
              // TODO Add in some error catching condition
            }
          });
      }
    },
    refreshRepos: function () {
      this.$http.get("/api/refreshrepos").then((response) => {
        if (response.data.success) {
          console.log("Success!");
          this.refreshUserInfoUntilNonUpdated();
        } else {
          console.log(response);
          // TODO Add in some error catching condition
        }
      });
    },
    refreshUserInfo: function (callback) {
      this.$http
        .get("/api/user/" + this.$route.params.username + "/")
        .then((response) => {
          const someUserData = response.data.user;
          this.user = someUserData;
          callback();
        });
    },
    refreshUserInfoUntilNonUpdated: function () {
      let refreshFunction = function () {
        if (this.user) {
          let reposStillUpdating = false;

          for (let i = 0; i < this.user.repos.length; i++) {
            if (this.user.repos[i].updating) {
              reposStillUpdating = true;
              break;
            }
          }

          if (reposStillUpdating) {
            setTimeout(
              function () {
                this.refreshUserInfoUntilNonUpdated();
              }.bind(this),
              3000
            );
          }
        }
      }.bind(this);

      this.refreshUserInfo(refreshFunction);
    },
  },
  mounted() {
    this.$http.defaults.headers.common["Authorization"] =
      this.$store.state.token;
    this.refreshUserInfoUntilNonUpdated();
  },
};
</script>

<style>
.user-repo-control-box {
  display: flex;
  justify-content: center;
}
</style>