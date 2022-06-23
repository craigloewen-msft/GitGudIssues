<template>
  <div class="pageContent">
    <b-container>
      <h1>Welcome {{ user.username }} !</h1>
      <div v-if="errorText">
        <p>{{ errorText }}</p>
      </div>
      <div class="tutorial-box" v-if="showTutorialCheck()">
        <h2>
          To get started input the name of a repository you're interested in
          below and hit enter.
        </h2>
        <h2>For example enter: <code>microsoft/wsl</code> and press enter.</h2>
      </div>
      <h2 v-if="showRepoTitleInfoCheck()">Your followed repositories</h2>
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
        <div v-if="loading" class="custom-tag-collection" style="display: flex">
          <div
            class="placeholder col-3 repo-placeholder"
            style="width: 100px"
          ></div>
          <div
            class="placeholder col-3 repo-placeholder"
            style="width: 100px"
          ></div>
          <div
            class="placeholder col-3 repo-placeholder"
            style="width: 100px"
          ></div>
        </div>
        <div class="user-repo-input-box">
          <div class="small-input-form-box">
            <b-form-input
              size="sm"
              v-model="input.repo"
              @keyup.enter="addUserRepo"
              class="repo-input-form"
            ></b-form-input>
          </div>
          <button
            v-on:click="addUserRepo"
            class="btn btn-secondary"
            type="button"
          >
            Add Repo
          </button>
        </div>
      </div>
      <div class="user-button-list" v-if="!showTutorialCheck()">
        <p class="text-muted">
          You can add repos that you're interested in here by typing them in
          above and pressing enter.
        </p>
        <router-link class="btn btn-primary" to="/manageissues"
          >Start triaging issues!</router-link
        >
        <b-button class="btn btn-primary" v-on:click="refreshRepos"
          >Refresh repos</b-button
        >
      </div>
      <TeamsView :userRepoList="getRepoList()" v-if="!showTutorialCheck()" />
    </b-container>
  </div>
</template>

<script>
import router from "../router";
import TeamsView from "../components/TeamsView.vue";

export default {
  name: "User",
  components: {
    TeamsView,
  },
  data() {
    return {
      user: this.$store.state.user,
      input: {
        repo: "",
      },
      loading: true,
      errorText: "",
    };
  },
  methods: {
    addUserRepo: function () {
      let repoIndex = this.user.repos.indexOf(this.input.repo);
      if (repoIndex == -1) {
        this.$gtag.event("addRepo", {
          event_category: "repoFunctions",
          event_label: this.input.repo,
          value: 10,
        });
        this.$http
          .post("/api/setuserrepo", {
            repo: this.input.repo,
          })
          .then((response) => {
            if (response.data.success) {
              this.refreshUserInfoUntilNonUpdated();
              this.input.repo = "";
            } else {
              this.errorText = response.data.log;
            }
          });
      }
    },
    removeUserRepo: function (inputRepoIndex) {
      let repoIndex = inputRepoIndex;
      if (repoIndex != -1) {
        this.$gtag.event("removeRepo", {
          event_category: "repoFunctions",
          event_label: this.user.repos[repoIndex].title,
          value: 1,
        });
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
      this.loading = true;
      this.user.repos = [];
      this.$http.get("/api/refreshrepos").then((response) => {
        if (response.data.success) {
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
          this.loading = false;
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
              5000
            );
          }
        }
      }.bind(this);

      if (this.$route.name == "User") {
        this.refreshUserInfo(refreshFunction);
      }
    },
    showTutorialCheck: function () {
      if (this.user.repos) {
        return !this.loading && this.user.repos.length == 0;
      } else {
        return false;
      }
    },
    showRepoTitleInfoCheck: function () {
      if (this.loading) {
        return true;
      } else {
        if (this.user.repos) {
          if (this.user.repos.length == 0) {
            return false;
          }
        }
      }

      return true;
    },
    getRepoList: function () {
      if (this.user) {
        return this.user.repos;
      } else {
        return [];
      }
    },
  },
  mounted() {
    this.refreshUserInfoUntilNonUpdated();
    this.$gtag.pageview(this.$route);
  },
};
</script>

<style>
.user-repo-control-box {
  display: flex;
  justify-content: center;
}

.repo-placeholder {
  margin: 0px 10px;
}

.user-repo-input-box {
  display: flex;
  align-items: center;
  justify-content: center;
}

.repo-input-form {
  background-color: #ffffff;
}

.user-button-list {
  margin-bottom: 50px;
}
</style>