<template>
  <div>
    <h1>Click to cash out!</h1>
    <p>Send this amount of coins to this wallet {{ input.coinamount }}</p>
    <p v-if="failuretext">{{ failuretext }}</p>
    <p v-if="successtext">{{ successtext }}</p>
    <div>
      <input
        type="text"
        name="walletID"
        v-model="input.walletid"
        placeholder="WalletID"
      /><br /><br />
      <input
        type="number"
        name="Amount"
        v-model="input.coinamount"
        placeholder="Amount"
      /><br /><br />
      <button class="btn btn-primary" v-on:click="cashout">Cash out</button>
    </div>
  </div>
</template>

<script>
export default {
  name: "Cashout",
  data() {
    return {
      minetimeoutcounter: 0,
      successtext: null,
      failuretext: null,
      input: {
        walletid: this.$store.state.user.walletID,
        coinamount: 0,
      },
    };
  },
  methods: {
    cashout: function () {
      this.$http
        .post("api/cashout/", {
          inputWallet: this.input.walletid,
          coinAmount: this.input.coinamount,
        })
        .then((response) => {
          if (response.data.success) {
            // Success cash sent
            // Update user account
            this.successtext = "Transaction complete!";
            this.$store.dispatch("refreshUserInfo", response.data.user);
          } else {
            // Failure
            console.log("Failure to send coins", response);
            this.failuretext = response.data.log;
          }
        })
        .catch((errors) => {
          console.log("Cannot login");
          console.log(errors);
        });
    },
  },
};
</script>
