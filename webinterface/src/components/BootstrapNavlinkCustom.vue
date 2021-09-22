<template>
   <li class="nav-item">
       <router-link class="nav-link" :to="to"><slot></slot></router-link>
   </li> 
</template>

<script>
export default {
    name: "Bootstrapnavlinkcustom",
    props: {
        to: {
            type: String,
        },
    },
};
</script>