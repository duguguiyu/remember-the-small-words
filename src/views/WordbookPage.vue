<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useWordbooksStore } from '@/stores/wordbooks'

const router = useRouter()
const wordbooksStore = useWordbooksStore()

onMounted(async () => {
  await wordbooksStore.load()
})

function openBook(id: string) {
  router.push(`/wordbook/${id}`)
}

const groupedWordbooks = computed(() => {
  const groups: Record<string, { categoryName: string; books: typeof wordbooksStore.wordbooks }> = {}
  for (const book of wordbooksStore.wordbooks) {
    if (!groups[book.category]) {
      groups[book.category] = { categoryName: book.categoryName, books: [] }
    }
    groups[book.category].books.push(book)
  }
  for (const g of Object.values(groups)) {
    g.books.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
  }
  return groups
})
</script>

<template>
  <div class="wordbook-page">
    <header class="page-header">
      <h2>词库</h2>
    </header>

    <div v-if="wordbooksStore.wordbooks.length === 0" class="empty-state">
      <p>暂无词库数据</p>
      <p class="hint">词库将从服务端自动同步</p>
    </div>

    <div v-for="(group, category) in groupedWordbooks" :key="category" class="category-group">
      <h3 class="category-title">{{ group.categoryName }}</h3>
      <div class="book-list">
        <div v-for="book in group.books" :key="book.id" class="book-item" @click="openBook(book.id)">
          <div class="book-name">{{ book.name }}</div>
          <div class="book-meta">
            <div class="book-count">{{ book.words.length }} 词</div>
            <span class="book-arrow">›</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wordbook-page {
  padding: 16px;
  padding-top: max(16px, env(safe-area-inset-top));
}

.page-header {
  margin-bottom: 20px;
}

.page-header h2 {
  font-size: 22px;
  font-weight: 700;
  color: var(--ink);
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: var(--ink-light);
}

.empty-state p {
  font-size: 16px;
  font-weight: 600;
}

.empty-state .hint {
  font-size: 13px;
  margin-top: 8px;
  color: var(--ink-light);
}

.category-group {
  margin-bottom: 24px;
}

.category-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--ink-soft);
  margin-bottom: 10px;
  padding-left: 4px;
  text-transform: uppercase;
  letter-spacing: .5px;
}

.book-list {
  background: var(--paper);
  border-radius: var(--r-lg);
  overflow: hidden;
  box-shadow: var(--shadow-card);
  border: 2.5px solid var(--line);
}

.book-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px;
  border-bottom: 2px solid var(--line);
  cursor: pointer;
  transition: background .15s;
}

.book-item:active {
  background: var(--line);
}

.book-item:last-child {
  border-bottom: none;
}

.book-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.book-arrow {
  font-size: 20px;
  color: var(--ink-light);
  font-weight: 300;
}

.book-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--ink);
}

.book-count {
  font-size: 13px;
  font-weight: 600;
  color: var(--p3-deep);
  background: #E0F7F5;
  padding: 3px 10px;
  border-radius: 12px;
}
</style>
