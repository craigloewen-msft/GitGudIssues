<template>
  <div class="pageContent">
    <b-container class="user-form-box">
      <h1>Register page</h1>
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
        type="text"
        name="email"
        v-model="input.email"
        placeholder="Email"
      />
      <input
        class="form-control"
        type="text"
        name="githubUsername"
        v-model="input.githubUsername"
        placeholder="Github Username"
      />
      <input
        class="form-control"
        type="password"
        name="password"
        v-model="input.password"
        placeholder="Password"
        @keyup.enter="register"
      />
      <input
        class="form-control"
        type="password"
        name="passwordconfirm"
        v-model="input.passwordconfirm"
        placeholder="Confirm Password"
        @keyup.enter="register"
      />
      <br />
      <button class="btn btn-primary btn-lg btn-block" v-on:click="register">
        Register
      </button>
    </b-container>
  </div>
</template>

<script>
import axios from "axios";

let devEndPoint = "/api/";

export default {
  name: "Register",
  data() {
    return {
      failuretext: null,
      input: {
        username: "",
        password: "",
        email: "",
        passwordconfirm: "",
        githubUsername: "",
      },
    };
  },
  components: {
    // HelloWorld
  },
  methods: {
    register: function () {
      if (!this.checkInfo()) {
        return;
      }

      axios
        .post(devEndPoint + "register/", {
          username: this.input.username,
          password: this.input.password,
          email: this.input.email,
          githubUsername: this.input.githubUsername,
        })
        .then((response) => {
          if (response.data.success) {
            // // Success login
            this.$store
              .dispatch("register", {
                token: response.data.token,
                user: response.data.user,
              })
              .then(() => {
                this.$gtag.event("register", {
                  event_category: "userFunctions",
                  event_label: response.data.user.username,
                  value: 50
                });
                this.$router.push("/user/" + response.data.user.username);
              });
          } else {
            // Failure Register
            console.log("Failure to register", response);
            this.failuretext = response.data.log;
          }
          // Add in JWT
        })
        .catch((errors) => {
          console.log("Cannot register");
          console.log(errors);
        });
    },
    validateEmail: function (mail) {
      if (
        /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/.test(
          mail
        )
      ) {
        return true;
      }
      return false;
    },
    checkInfo: function () {
      if (this.input.username.length < 4) {
        this.failuretext = "Username must be more than 4 characters";
        return false;
      }
      if (this.input.password.length < 4) {
        this.failuretext = "Password must be 4 or more characters";
        return false;
      }
      if (!this.validateEmail(this.input.email)) {
        this.failuretext = "Email is invalid";
        return false;
      }
      if (this.input.username.length > 20) {
        this.failuretext = "Username is too long";
        return false;
      }
      if (this.input.githubUsername.length == 0) {
        this.failuretext = "Github username required";
        return false;
      }
      if (this.input.password.length > 30) {
        this.failuretext = "Password is too long";
        return false;
      }
      if (this.input.email.length > 30) {
        this.failuretext = "Email is too long";
        return false;
      }
      if (!(this.input.password == this.input.passwordconfirm)) {
        this.failuretext = "Passwords don't match";
        return false;
      }
      return true;
    },
  },
  mounted: function () {
    this.$gtag.pageview(this.$route);
  },
};
</script>