<template>
    <div>
        <h1>Register page</h1>
        <p v-if="failuretext">{{ failuretext }}</p>
        <input type="text" name="username" v-model="input.username" placeholder="Username" /><br/><br/>
        <input type="text" name="email" v-model="input.email" placeholder="email" /><br/><br/>
        <input type="password" name="password" v-model="input.password" placeholder="Password" /><br/><br/>
        <button class="btn btn-primary" v-on:click="register">Register</button>
    </div>
</template>

<script>
import axios from 'axios';

let devEndPoint = '/api/';

export default {
  name: 'Register',
  data() {
      return {
          failuretext: null,
          input: {
              username: "",
              password: "",
              email: "",
          }
      }
  },
  components: {
    // HelloWorld
  },
  methods: {
      register: function() {
          axios.post(devEndPoint + 'register/', { username: this.input.username,
            password: this.input.password }).then(response => {
                if (response.data.success) {
                    // // Success login
                    this.$store.dispatch('register', {token: response.data.token, user: response.data.user})
                    .then(() => {
                        this.$router.push('/user/' + response.data.user.username);
                    })
                } else {
                    // Failure Register
                    console.log("Failure to register",response);
                    this.failuretext = response.data.log;
                }
                // Add in JWT
            }).catch(errors => {
                console.log("Cannot register");
                console.log(errors);
            });
      }
  }
}
</script>