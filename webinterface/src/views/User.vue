<template>
    <div>
        <h1>
            User page
        </h1>
        <h3>Username: {{ user.username }}</h3>
        <h3>ihatecryptocoin balance: {{ user.coinAmount }}</h3>
        <h3>Wallet ID: {{ user.walletID }}</h3>
        <p>JSON Token: {{ this.$store.state.token }}</p>
    </div>
</template>

<script>
import router from "../router"

export default {
  name: "About",
  data() {
    return {
        user: this.$store.state.user,
    }
  },
  methods: {    
    
  },
  mounted () {
      this.$http.defaults.headers.common['Authorization'] = this.$store.state.token;
      this.$http.get('/api/user/' + this.$route.params.username + '/').then(response => {
          const someUserData = response.data.user;
          this.user = someUserData;
      });
  },
}
</script>