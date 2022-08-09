import Vue from 'vue'
import App from './App.vue'
import router from './router'
import { BootstrapVue, IconsPlugin } from 'bootstrap-vue'
import store from './store.js'
import Axios from 'axios'
import vueDebounce from 'vue-debounce'
import VueGtag from "vue-gtag"
import VueMeta from 'vue-meta'

// import 'bootstrap/dist/css/bootstrap.css'
// import 'bootstrap-vue/dist/bootstrap-vue.css'

import './style/darkStyle.scss'

Vue.prototype.$http = Axios;

Vue.config.productionTip = false

Vue.use(BootstrapVue);
Vue.use(IconsPlugin);

Vue.use(vueDebounce, {
  listenTo: 'input'
});

Vue.use(VueGtag, {
  config: { id: "G-RGZMG4RTH7" }
});

Vue.use(VueMeta);

new Vue({
  router,
  store,
  render: h => h(App)
}).$mount('#app')
