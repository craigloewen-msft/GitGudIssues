import Vue from 'vue'
import Vuex from 'vuex'

Vue.use(Vuex)

export default new Vuex.Store({
    state: {
        status: '',
        token: localStorage.getItem('token') || '',
        user: JSON.parse(localStorage.getItem('user')) || {},
        lastLoginDate: localStorage.getItem('lastLoginDate') || null
    },
    mutations: {
        auth_request(state) {
            state.status = "Loading..."
        },
        auth_success(state, authdata) {
            state.status = "Success";
            state.token = authdata.token;
            state.user = authdata.user;
            state.lastLoginDate = new Date();
        },
        auth_error(state) {
            state.status = "Error";
        },
        logout(state) {
            state.status = "";
            state.token = "";
            state.lastLoginDate = null;
        },
        refresh_user_info(state, refresheduser) {
            state.user = refresheduser;
        }

    },
    actions: {

        login({ commit }, logindata) {
            return new Promise((resolve, reject) => {
                commit('auth_request');
                localStorage.setItem('token', logindata.token);
                localStorage.setItem('user', JSON.stringify(logindata.user));
                localStorage.setItem('lastLoginDate', new Date());

                Vue.prototype.$http.defaults.headers.common['Authorization'] = logindata.token;
                commit('auth_success', { token: logindata.token, user: logindata.user });
                resolve("Success!");
            })
        },
        register({ commit }, registerdata) {
            return new Promise((resolve, reject) => {
                commit('auth_request');
                localStorage.setItem('token', registerdata.token);
                localStorage.setItem('user', JSON.stringify(registerdata.user));
                localStorage.setItem('lastLoginDate', new Date());

                Vue.prototype.$http.defaults.headers.common['Authorization'] = registerdata.token;
                commit('auth_success', { token: registerdata.token, user: registerdata.user });
                resolve("Succses!");
            })
        },
        logout({ commit }) {
            return new Promise((resolve, reject) => {
                commit('logout');
                localStorage.removeItem('token')
                localStorage.removeItem('user');
                localStorage.removeItem('lastLoginDate');
                delete Vue.prototype.$http.defaults.headers.common['Authorization'];
                resolve();
            })
        },
        refreshUserInfo({ commit }, refresheduser) {
            return new Promise((resolve, reject) => {
                localStorage.setItem('user',JSON.stringify(refresheduser));
                commit('refresh_user_info', refresheduser);
            });
        },

    },
    getters: {
        isLoggedIn: state => !!state.token,
        authStatus: state => state.status,
    }
})