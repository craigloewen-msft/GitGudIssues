import Vue from 'vue'
import App from './App.vue'
import router from './router'
import {BootstrapVue, IconsPlugin} from 'bootstrap-vue'
import store from './store.js'
import Axios from 'axios'

import 'bootstrap/dist/css/bootstrap.css'
import 'bootstrap-vue/dist/bootstrap-vue.css'

Vue.prototype.$http = Axios;

Vue.config.productionTip = false

Vue.use(BootstrapVue);
Vue.use(IconsPlugin);

new Vue({
  router,
  store,
  render: h => h(App)
}).$mount('#app')
