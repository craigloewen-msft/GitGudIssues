<template>
  <div class="pageContent">
    <b-container>
      <h1>User details</h1>
      <h3>Username: {{ user.username }}</h3>
      <div class="buttonSelect">
        <router-link
          class="btn btn-primary disabled placeholder"
          to="#"
        ></router-link>
      </div>
    </b-container>
  </div>
</template>

<script>
import router from "../router";

export default {
  name: "About",
  data() {
    return {
      user: this.$store.state.user,
    };
  },
  methods: {},
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
