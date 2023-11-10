<template>
  <span
    v-if="state == 'open'"
    class="tooltipped tooltipped-e"
    aria-label="Open issue"
  >
    <svg
      class="octicon octicon-issue-opened open"
      viewBox="0 0 16 16"
      version="1.1"
      width="16"
      height="16"
      aria-hidden="true"
    >
      <path d="M8 9.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"></path>
      <path
        fill-rule="evenodd"
        d="M8 0a8 8 0 100 16A8 8 0 008 0zM1.5 8a6.5 6.5 0 1113 0 6.5 6.5 0 01-13 0z"
      ></path>
    </svg>
  </span>
  <span v-else class="tooltipped tooltipped-e" aria-label="Closed issue">
    <svg
      class="octicon octicon-issue-closed closed"
      viewBox="0 0 16 16"
      version="1.1"
      width="16"
      height="16"
      aria-hidden="true"
    >
      <path
        d="M11.28 6.78a.75.75 0 00-1.06-1.06L7.25 8.69 5.78 7.22a.75.75 0 00-1.06 1.06l2 2a.75.75 0 001.06 0l3.5-3.5z"
      ></path>
      <path
        fill-rule="evenodd"
        d="M16 8A8 8 0 110 8a8 8 0 0116 0zm-1.5 0a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z"
      ></path>
    </svg>
  </span>
</template>

<script>
export default {
  name: "IssueStateIndicator",
  props: ["state"],
};
</script>

<style scoped>

.open.octicon {
  color: #3fb950;
}

.closed.octicon {
  color: #f85149;
}
</style>