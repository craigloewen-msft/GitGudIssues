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
    component: () =>import('../views/Register.vue'),
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
    path: '/clickmine',
    name: 'Clickmine',
    component: () => import('../views/Clickmine.vue'),
    meta: {
      requiresAuth: true
    }
  },
  {
    path: '/cashout',
    name: 'Cashout',
    component: () => import('../views/Cashout.vue'),
    meta: {
      requiresAuth: true
    }
  },
  {
    path: '/cashin',
    name: 'Cashin',
    component: () => import('../views/Cashin.vue'),
    meta: {
      requiresAuth: true
    }
  },
]

const router = new VueRouter({
  mode: 'history',
  base: process.env.BASE_URL,
  routes
})

router.beforeEach((to, from, next) => {
    if(to.matched.some(record => record.meta.requiresAuth)) {
        if (!store.getters.isLoggedIn) {
            next({
                path: '/login',
                params: { nextUrl: to.fullPath }
            })
        } else {
            next()
        }
    } else if(to.matched.some(record => record.meta.guestonly)) {
        if(!store.getters.isLoggedIn){
            next()
        }
        else{
            next({ name: 'Home'})
        }
    }else {
        next()
    }
});


export default router
