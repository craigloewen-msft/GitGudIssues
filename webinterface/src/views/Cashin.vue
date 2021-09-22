<template>
  <div>
    <h1>Transfer your ihatecryptocoin to this site!</h1>
    <h3>Step 1 - Send crypto to this site</h3>
    <p>How much would you like to send?</p>
    <input type="number" v-model="input.sendAmount" />
    <p>Next run this command on your multichain instance</p>
    <p class="code">
      multichain-cli ihatecryptocoin sendwithmetadata
      19PuNHAYzi6WgX1CRMrKzqCnAhaMtsp7j2XjfH '{"ihatecryptocoin":
      {{ input.sendAmount }}}'
      {{ convertASCIIToHex(this.$store.state.user.username) }}
    </p>
    <p class="explanation">
      Explanation: You are sending your ihatecryptocoin to this site's wallet,
      and are adding metadata that is a hex code encoded version of your
      username so the site can properly identify you
    </p>
    <p>The output of the command will be your transaction ID. Enter your transaction id here</p>
    <p v-if="failuretext">{{ failuretext }}</p>
    <p v-if="successtext">{{ successtext }}</p>
    <div>
      <input
        type="text"
        name="transactionID"
        v-model="input.transactionID"
        placeholder="Transaction ID"
      /><br /><br />
      <button class="btn btn-primary" v-on:click="cashout">Cash in</button>
    </div>
  </div>
</template>

<script>
export default {
  name: "Cashin",
  data() {
    return {
      minetimeoutcounter: 0,
      failuretext: null,
      successtext: "",
      input: {
        transactionID: "",
        sendAmount: 5,
      },
    };
  },
  methods: {
    cashout: function () {
      this.$http
        .post("api/cashin/", {
          transactionID: this.input.transactionID,
        })
        .then((response) => {
          if (response.data.success) {
            // Success cash sent
            // Update user account
            this.successtext = "Transaction Complete";
            this.$store.dispatch("refreshUserInfo", response.data.user);
          } else {
            // Failure
            console.log("Failure to send coins", response);
            this.failuretext = response.data.log;
          }
        })
        .catch((errors) => {
          console.log("Cannot cashin");
          console.log(errors);
        });
    },
    convertASCIIToHex: function (inputString) {
      //ref: https://www.tutorialspoint.com/converting-ascii-to-hexadecimal-in-javascript
      const res = [];
      const { length: len } = inputString;
      for (let n = 0, l = len; n < l; n++) {
        const hex = Number(inputString.charCodeAt(n)).toString(16);
        res.push(hex);
      }
      return res.join("");
    },
  },
};
</script>
