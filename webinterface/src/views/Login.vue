<template>
  <div class="pageContent">
    <b-container class="user-form-box">
      <h1>Please sign in</h1>
      <p v-if="failuretext">{{ failuretext }}</p>
      <input
        class="form-control"
        type="text"
        name="username"
        v-model="input.username"
        placeholder="Username"
      />
      <input
        class="form-control"
        type="password"
        name="password"
        v-model="input.password"
        placeholder="Password"
        @keyup.enter="login"
      />
      <br />
      <button class="btn btn-lg btn-primary btn-block" v-on:click="login">
        Sign in
      </button>
    </b-container>
  </div>
</template>

<script>
let APIEndpoint = "https://api.coindesk.com/v1/bpi/currentprice.json";
let devEndPoint = "/api/";

export default {
  name: "Login",
  data() {
    return {
      failuretext: null,
      input: {
        username: "",
        password: "",
      },
    };
  },
  components: {
    // HelloWorld
  },
  methods: {
    login: function () {
      this.userdata = "Loading!";
      this.$http
        .post(devEndPoint + "login/", {
          username: this.input.username,
          password: this.input.password,
        })
        .then((response) => {
          if (response.data.success) {
            // Success login
            this.$store
              .dispatch("login", {
                token: response.data.token,
                user: response.data.user,
              })
              .then(() => {
                this.$gtag.event("login", {
                  event_category: "userFunctions",
                  event_label: response.data.user.username,
                  value: 1
                });
                this.$router.push("/user/" + response.data.user.username);
              });
          } else {
            // Failure login
            console.log("Failure to login", response);
            this.failuretext = response.data.log;
          }
          // Add in JWT
        })
        .catch((errors) => {
          console.log("Cannot login");
          console.log(errors);
        });
      //   axios.get(devEndPoint).then(response => (this.userdata = response.data));
    },
  },
  mounted: function () {
    this.$gtag.pageview(this.$route);
  },
};
</script>

<style>
.user-form-box {
  max-width: 330px;
}

.btn-block {
  width: 100%;
}
</style>