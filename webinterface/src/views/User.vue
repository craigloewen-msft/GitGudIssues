<template>
  <div class="pageContent">
    <b-container>
      <h1>Welcome {{ user.username }} !</h1>
      <h2>Your followed repositories</h2>
      <div class="user-repo-control-box">
        <div class="custom-tag-collection">
          <div
            class="custom-tag-box"
            v-for="(repoTitle, repoTitleIndex) in user.repos"
            :key="repoTitleIndex"
          >
            {{ repoTitle }}
            <a
              class="custom-tag-box-link"
              href="#"
              v-on:click="removeUserRepo(repoTitle)"
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
              this.user.repos.push(this.input.repo);
              this.input.repo = "";
            } else {
              console.log(response);
              // TODO Add in some error catching condition
            }
          });
      }
    },
    removeUserRepo: function (inputRepo) {
      let repoIndex = this.user.repos.indexOf(inputRepo);
      if (repoIndex != -1) {
        this.$http
          .post("/api/removeuserrepo", {
            repo: inputRepo,
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
        } else {
          console.log(response);
          // TODO Add in some error catching condition
        }
      });
    },
  },
  mounted() {
    this.$http.defaults.headers.common["Authorization"] =
      this.$store.state.token;
    this.$http
      .get("/api/user/" + this.$route.params.username + "/")
      .then((response) => {
        const someUserData = response.data.user;
        this.user = someUserData;
      });
  },
};
</script>

<style>
.user-repo-control-box {
  display: flex;
  justify-content: center;
}
</style>