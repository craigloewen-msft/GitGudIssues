<template>
    <div>
        <h1>Login page</h1>
        <p v-if="failuretext">{{ failuretext }}</p>
        <input type="text" name="username" v-model="input.username" placeholder="Username" /><br/><br/>
        <input type="password" name="password" v-model="input.password" placeholder="Password" /><br/><br/>
        <button class="btn btn-primary" v-on:click="login">Click me to login!</button>
    </div>
</template>

<script>
let APIEndpoint = 'https://api.coindesk.com/v1/bpi/currentprice.json';
let devEndPoint = '/api/';

export default {
  name: 'Login',
  data() {
      return {
          failuretext: null,
          input: {
              username: "",
              password: ""
          }
      }
  },
  components: {
    // HelloWorld
  },
  methods: {
      login: function() {
          this.userdata = "Loading!";
          this.$http.post(devEndPoint + 'login/', { username: this.input.username,
            password: this.input.password }).then(response => {
                if (response.data.success) {
                    // Success login
                    this.$store.dispatch('login', {token: response.data.token, user: response.data.user})
                    .then(() => {
                        this.$router.push('/user/' + response.data.user.username);
                    })
                } else {
                    // Failure login
                    console.log("Failure to login",response);
                    this.failuretext = response.data.log;
                }
                // Add in JWT
            }).catch(errors => {
                console.log("Cannot login");
                console.log(errors);
            });
        //   axios.get(devEndPoint).then(response => (this.userdata = response.data));
      }
  }
}
</script>