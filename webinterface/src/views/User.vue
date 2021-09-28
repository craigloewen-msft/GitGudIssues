<template>
  <div class="pageContent">
    <b-container>
      <h1>User details</h1>
      <h3>Username: {{ user.username }}</h3>
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
        <b-form-input
          size="sm"
          v-model="input.repo"
          @keyup.enter="addUserRepo"
          class="page-number-input"
        ></b-form-input>
      </div>
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
              this.user.repos.splice(repoIndex);
            } else {
              console.log(response);
              // TODO Add in some error catching condition
            }
          });
      }
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