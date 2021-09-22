<template>
  <div id="app">
    <div id="nav">
      <router-link to="/">Home</router-link> |
      <router-link to="/about">About</router-link> |
      <div v-if="isLoggedIn">
        <router-link to="/clickmine">Mine Coin</router-link> |
        <router-link to="/cashout">Cash out</router-link> | 
        <router-link to="/cashin">Cash In</router-link> | 
        <router-link :to="'/user/' + user.username">{{
          user.username
        }} ({{ user.coinAmount }})</router-link>
        |
        <router-link to="/logout">Logout</router-link>
      </div>
      <div v-if="!isLoggedIn">
        <router-link to="/login">Login</router-link> |
        <router-link to="/register">Register</router-link>
      </div>
    </div>
    <router-view />
  </div>
</template>

<script>
export default {
  computed: {
    isLoggedIn: function () {
      return this.$store.getters.isLoggedIn;
    },
    user: function () {
      return this.$store.state.user;
    },
  },
  created: function () {
    // Handle expired tokens case
    const storeRef = this.$store;
    const routerRef = this.$router;

    var errorResponseFunc = function (err) {
      var returnPromiseFunc = function (storeRef, routerRef) {
        return new Promise(function (resolve, reject) {
          if (err.response.status === 401) {
            storeRef.dispatch("logout");
            routerRef.push("/");
          }
        });
      };

      return returnPromiseFunc(storeRef, routerRef);
    };

    this.$http.interceptors.response.use(
      undefined,
      errorResponseFunc.bind(this)
    );
  },
};
</script>


<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
}

#nav {
  padding: 30px;
}

#nav a {
  font-weight: bold;
  color: #2c3e50;
}

#nav a.router-link-exact-active {
  color: #42b983;
}
</style>
