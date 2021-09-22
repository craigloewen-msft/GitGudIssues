<template>
    <h1>See ya!</h1>
</template>

<script>
export default {
    name: 'Logout',
    mounted: function() {
        this.$store.dispatch('logout')
        .then(() => {
            this.$router.push('/')
        })
    }
}
</script>