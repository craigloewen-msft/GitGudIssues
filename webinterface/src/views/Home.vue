<template>
  <div>
    <div class="jumbotron header-container">
      <div class="header-text-container">
        <h2>GitGudIssues</h2>
        <h4>Manage your Github presence</h4>
        <img
          src="/GitGudIssuesGIF.gif"
          class="img-fluid cover-gif"
          alt="GitGudIssuesPromo"
        />
        <div v-if="!this.$store.getters.isLoggedIn" class="loginSelect">
          <router-link class="btn btn-primary" to="/login">Login</router-link>
          <router-link class="btn btn-primary" to="/register"
            >Register</router-link
          >
        </div>
        <div v-if="this.$store.getters.isLoggedIn" class="loginSelect">
          <router-link class="btn btn-primary" :to="'/user/' + user.username"
            >My Profile
          </router-link>
        </div>
      </div>
    </div>

    <b-container class="section-slides">
      <header class="section-header">
        <p>How it works</p>
      </header>

      <div class="row">
        <div class="col-md-4 mt-4 mt-lg-0">
          <div class="box">
            <h3>
              The goal of this project is to never have to use email to manage
              Github Issues ever again
            </h3>
            <p>
              Managing Github issues from email simply sucks. This project was
              created to make an easy to use interface to keep track of all your
              Github issues on repos that you maintain, as well as any mentions
              that you'd have from these repos. It's goal is to make it so you
              spend less time searching through Github, and more time actually
              triaging and responding to the right issues.
            </p>
          </div>
        </div>

        <div class="col-md-4 mt-4 mt-lg-0">
          <div class="box">
            <h3>This project only uses public APIs, no Auth required</h3>
            <p>
              GitGudIssues uses the public APIs on Github to create a database
              of the issues in repos that you care about. This allows you to
              mark issues as read or unread, assign personal tags to them, and
              create your own custom queries all in the same page, so you don't
              have to look around on different repos. One of the main goals is
              to make it easy to sign up and use, which is why you don't need to
              auth to your GitHub account to use this tool!
            </p>
          </div>
        </div>

        <div class="col-md-4 mt-4 mt-lg-0">
          <div class="box">
            <h3>How to get started</h3>
            <p>
              To get started simply register using the links above. Once you've
              registered you can then input the Github accounts that you'd like
              to track your issues with. From there the issues and comments in
              these accounts will automatically populate on the site, and you'll
              be able to search, query and manage them easily.
            </p>
          </div>
        </div>
      </div>
    </b-container>
  </div>
</template>

<script>
// @ is an alias to /src
// import HelloWorld from '@/components/HelloWorld.vue'

export default {
  name: "Home",
  components: {
    // HelloWorld
  },
  computed: {
    user: function () {
      return this.$store.state.user;
    },
  },
  mounted: function () {
    this.$gtag.pageview(this.$route);
  },
};
</script>

<style>
.loginSelect {
  display: flex;
  justify-content: center;
  margin-top: 30px;
}

.loginSelect a {
  margin-left: 15px;
  margin-right: 15px;
}

.header-container {
  background: url(../../public/bg.jpg);
  background-position-x: center;
  background-position-y: center;
  background-attachment: fixed;
  background-repeat: no-repeat;
  background-size: cover;
  box-shadow: inset 0 0 0 2000px rgba(0, 0, 0, 0.925);
  height: 80vh;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow-x: hidden;
  overflow-y: hidden;
  margin-bottom: 50px;
}

.header-text-container {
  color: #eee;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  justify-items: center;
}

.section-header {
  margin-bottom: 10px;
}

.section-header h2 {
  font-size: 13px;
  letter-spacing: 1px;
  font-weight: 700;
  margin: 0;
  text-transform: uppercase;
}

.section-header p {
  margin: 10px 0 0 0;
  padding: 0;
  font-size: 38px;
  line-height: 42px;
  font-weight: 700;
}

.box {
  border: 1px solid #e2eefd;
  padding: 30px 20px;
  transition: all ease-in-out 0.3s;
  height: 100%;
}

.box h3 {
  transition: all ease-in-out 0.3s;
}

.box:hover {
  border-color: #fff;
  box-shadow: 0px 0 25px 0 rgb(16 110 234 / 10%);
}

.box:hover h3 {
  color: #adadad;
}

.card-img {
  padding: 15px 30px;
}

.section-slides {
  margin-bottom: 30px;
}

.cover-gif {
  max-height: 60%;
}
</style>