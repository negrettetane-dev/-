<script setup lang="ts">
defineProps<{ loading?: boolean; error?: string; empty?: boolean; emptyText?: string }>()
defineEmits(['retry'])
</script>

<template>
  <div v-if="loading" class="state loading-state">
    <span class="state-spinner"></span>
    <div class="skeleton-stack" aria-hidden="true">
      <span></span>
      <span></span>
      <span></span>
    </div>
    <p>正在融合交通、气象与事件数据...</p>
  </div>
  <div v-else-if="error" class="state error">
    <span>{{ error }}</span>
    <button @click="$emit('retry')">重新加载</button>
  </div>
  <div v-else-if="empty" class="state">
    {{ emptyText || '暂无符合条件的数据' }}
  </div>
  <slot v-else />
</template>
