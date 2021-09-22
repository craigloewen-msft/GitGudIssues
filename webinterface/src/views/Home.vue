<template>
  <div>
    <div class="jumbotron header-container">
      <div class="header-text-container">
        <h2>WebsiteName</h2>
        <h4>Tagline</h4>
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
        <h2>Why WebsiteName?</h2>
        <p>More tagline</p>
      </header>

      <div class="row">
        <div class="col-md-4 mt-4 mt-lg-0">
          <div class="box">
            <h3>Placeholder content</h3>
            <p>Placeholder content</p>
          </div>
        </div>

        <div class="col-md-4 mt-4 mt-lg-0">
          <div class="box">
            <h3>Placeholder content</h3>
            <p>Placeholder content</p>
          </div>
        </div>

        <div class="col-md-4 mt-4 mt-lg-0">
          <div class="box">
            <h3>Placeholder content</h3>
            <p>Placeholder content</p>
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
  box-shadow: inset 0 0 0 2000px rgba(0, 0, 0, 0.8);
  height: 80vh;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow-x: hidden;
  margin-bottom: 50px;
}

.header-text-container {
  color: #eee;
}

.section-header {
  margin-bottom: 10px;
}

.section-header h2 {
  font-size: 13px;
  letter-spacing: 1px;
  font-weight: 700;
  margin: 0;
  color: #4154f1;
  text-transform: uppercase;
}

.section-header p {
  margin: 10px 0 0 0;
  padding: 0;
  font-size: 38px;
  line-height: 42px;
  font-weight: 700;
  color: #012970;
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
  color: #012970;
}

.card-img {
  padding: 15px 30px;
}

.section-slides {
  margin-bottom: 30px;
}
</style>