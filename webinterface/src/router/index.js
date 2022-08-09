import Vue from 'vue'
import VueRouter from 'vue-router'
import Home from '../views/Home.vue'
import store from "../store.js"

Vue.use(VueRouter)

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home
  },
  {
    path: '/about',
    name: 'About',
    // route level code-splitting
    // this generates a separate chunk (about.[hash].js) for this route
    // which is lazy-loaded when the route is visited.
    component: () => import(/* webpackChunkName: "about" */ '../views/About.vue')
  },
  {
    path: '/manageissues',
    name: 'Manage Issues',
    // route level code-splitting
    // this generates a separate chunk (about.[hash].js) for this route
    // which is lazy-loaded when the route is visited.
    component: () => import(/* webpackChunkName: "about" */ '../views/ManageIssues.vue'),
    meta: {
      requiresAuth: true
    }
  },
  {
    path: '/managementions',
    name: 'Manage Mentions',
    // route level code-splitting
    // this generates a separate chunk (about.[hash].js) for this route
    // which is lazy-loaded when the route is visited.
    component: () => import(/* webpackChunkName: "about" */ '../views/ManageMentions.vue'),
    meta: {
      requiresAuth: true
    }
  },
  {
    path: '/repographs',
    name: 'Repo Graphs',
    // route level code-splitting
    // this generates a separate chunk (about.[hash].js) for this route
    // which is lazy-loaded when the route is visited.
    component: () => import(/* webpackChunkName: "about" */ '../views/RepoGraphs.vue'),
    meta: {
      requiresAuth: true
    }
  },
  {
    path: '/usergraphs',
    name: 'User Graphs',
    component: () => import(/* webpackChunkName: "about" */ '../views/UserGraphs.vue'),
    meta: {
      requiresAuth: true
    }
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import(/* webpackChunkName: "about" */ '../views/Login.vue'),
    meta: {
      guestonly: true
    }
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('../views/Register.vue'),
    meta: {
      guestonly: true
    }
  },
  {
    path: '/logout',
    name: 'Logout',
    component: () => import('../views/Logout.vue'),
    meta: {
      requiresAuth: true
    }
  },
  {
    path: '/user/:username',
    name: 'User',
    component: () => import(/* webpackChunkName: "about" */ '../views/User.vue'),
    meta: {
      requiresAuth: true
    }
  },
  {
    path: '/team/invite/:invitestring',
    name: 'Team Invite',
    component: () => import(/* webpackChunkName: "about" */ '../views/TeamInvite.vue'),
    meta: {
      requiresAuth: true
    }
  },
  {
    path: '/team/triage/',
    name: 'Team Triage Selection',
    component: () => import(/* webpackChunkName: "about" */ '../views/TeamTriageSelector.vue'),
    meta: {
      requiresAuth: true
    }
  },
  {
    path: '/team/triage/:teamid',
    name: 'Team Triage',
    component: () => import(/* webpackChunkName: "about" */ '../views/TeamTriage.vue'),
    meta: {
      requiresAuth: true
    }
  },
  {
    path: '/repoissuegraph/',
    name: 'Repo Issue Graph',
    component: () => import(/* webpackChunkName: "about" */ '../views/RepoIssueGraph.vue'),
    meta: {
      requiresAuth: true
    }
  },
]

const router = new VueRouter({
  // mode: 'history',
  base: process.env.BASE_URL,
  linkActiveClass: "active",
  routes
})

router.beforeEach(async (to, from, next) => {

  let loginCheckPromise = null;

  if (store.getters.isLoggedIn) {
    let lastLoginDate = store.getters.lastLoginDate;
    let expireLoginDate = new Date(lastLoginDate);
    expireLoginDate = new Date(expireLoginDate.setDate(expireLoginDate.getDate() + 7));
    if (new Date() > expireLoginDate) {
      //Logout
      store.dispatch("logout");
      // this.$store.dispatch("logout").then(() => {
      //   this.$router.push("/");
      // });
    }
  }

  if (loginCheckPromise) {
    await loginCheckPromise;
  }

  if (to.matched.some(record => record.meta.requiresAuth)) {
    if (!store.getters.isLoggedIn) {
      next({
        path: '/login',
        params: { nextUrl: to.fullPath }
      })
    } else {
      next()
    }
  } else if (to.matched.some(record => record.meta.guestonly)) {
    if (!store.getters.isLoggedIn) {
      next()
    }
    else {
      next({ name: 'Home' })
    }
  } else {
    next()
  }
});


export default router
