<template>
  <h1>See ya!</h1>
</template>

<script>
export default {
  name: "Logout",
  mounted: function () {
    this.$gtag.pageview(this.$route);
      this.$gtag.event("logout", {
        event_category: "userFunctions",
        event_label: "user",
        value: 1,
      });
    this.$store.dispatch("logout").then(() => {
      this.$router.push("/");
    });
  },
};
</script>