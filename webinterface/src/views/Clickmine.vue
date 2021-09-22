<template>
  <div>
    <h1>Click to mine!</h1>
    <p>You can mine a new ihatecryptocoin every 10 seconds</p>
    <p>{{ minetimeoutcounter }}</p>
    <div class="item html">
      <svg
        :width="circleradius * 4"
        :height="circleradius * 4"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g>
          <title>Layer 1</title>
          <circle
            id="circle"
            class="circle"
            v-bind:class="{ circle_animation: animating }"
            :r="circleradius"
            :cy="circleradius * 2"
            :cx="circleradius * 2"
            :stroke-width="circleradius * 2"
            stroke="#6fdb6f"
            fill="none"
            v-bind:style="{
              'stroke-dashoffset':
                animationPercent * ((circleradius * 2 * 3.14159) / 100),
              'stroke-dasharray': circleradius * 2 * 3.14159,
            }"
          />
        </g>
      </svg>
    </div>
    <div>
        <br/>
      <button class="btn btn-primary" v-on:click="minecoin">
        Mine 1 ihatecryptocoin
      </button>
    </div>
  </div>
</template>

<script>
export default {
  name: "Clickmine",
  data() {
    return {
      minetimeoutcounter: 0,
      animating: false,
      minetimeout: 5,
      circleradius: 10,
      animationPercent: 100,
    };
  },
  methods: {
    minecoin: function () {
      if (this.checkIfCanMine()) {
        this.startCountdown();
        this.$http.get("/api/clickmine/").then((response) => {
          if (response.data.success) {
            this.$store.dispatch("refreshUserInfo", response.data.user);
          }
        });
      }
    },
    countDownTimer: function () {
      if (this.minetimeoutcounter > 0) {
        setTimeout(() => {
          this.minetimeoutcounter -= 1;
          if (this.animationPercent > 0) {
            this.animationPercent =
              ((this.minetimeoutcounter - 1) * 100) / this.minetimeout;
          } else {
            this.animating = false;
          }
          this.countDownTimer();
        }, 1000);
      } else {
        // Do nothing
      }
    },
    startCountdown: function () {
      this.minetimeoutcounter = this.minetimeout;
      this.startAnimation();
      this.countDownTimer();
    },
    checkIfCanMine: function () {
      if (this.minetimeoutcounter > 0) {
        return false;
      } else {
        return true;
      }
    },
    startAnimation: function () {
      this.animating = false;
      this.animationPercent = 100;
      setTimeout(() => {
        this.animating = true;
        this.animationPercent =
          ((this.minetimeoutcounter - 1) * 100) / this.minetimeout;
      }, 50);
    },
  },
};
</script>

<style scoped>
.item h2 {
  text-align: center;
  position: absolute;
  line-height: 125px;
  width: 100%;
}

svg {
  -webkit-transform: rotate(-90deg);
  transform: rotate(-90deg);
}

.circle_animation {
  transition: all 1s linear;
}
</style>