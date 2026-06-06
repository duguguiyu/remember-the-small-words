<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'

const props = defineProps<{
  seconds: number
  active: boolean
}>()

const emit = defineEmits<{
  done: []
}>()

const remaining = ref(props.seconds)
let timer: ReturnType<typeof setInterval> | null = null

function startTimer() {
  stopTimer()
  remaining.value = props.seconds
  timer = setInterval(() => {
    remaining.value--
    if (remaining.value <= 0) {
      stopTimer()
      emit('done')
    }
  }, 1000)
}

function stopTimer() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

watch(
  () => props.active,
  (val) => {
    if (val) startTimer()
    else stopTimer()
  },
  { immediate: true }
)

onUnmounted(() => stopTimer())
</script>

<template>
  <div class="countdown" :class="{ done: remaining <= 0 }">
    <svg class="countdown-ring" viewBox="0 0 36 36">
      <path
        class="countdown-bg"
        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
      />
      <path
        class="countdown-fill"
        :stroke-dasharray="`${(remaining / seconds) * 100}, 100`"
        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
      />
    </svg>
    <span class="countdown-text">{{ remaining > 0 ? remaining : '✓' }}</span>
  </div>
</template>

<style scoped>
.countdown {
  position: relative;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.countdown-ring {
  position: absolute;
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.countdown-bg {
  fill: none;
  stroke: #eee;
  stroke-width: 3;
}

.countdown-fill {
  fill: none;
  stroke: #4285F4;
  stroke-width: 3;
  stroke-linecap: round;
  transition: stroke-dasharray 1s linear;
}

.countdown.done .countdown-fill {
  stroke: #34A853;
}

.countdown-text {
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.countdown.done .countdown-text {
  color: #34A853;
}
</style>
