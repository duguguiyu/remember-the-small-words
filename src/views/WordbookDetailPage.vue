<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useWordbooksStore } from '@/stores/wordbooks'
import { speakEnglish } from '@/lib/tts'
import type { Wordbook, Word } from '@/lib/types'

const route = useRoute()
const router = useRouter()
const wordbooksStore = useWordbooksStore()
const book = ref<Wordbook | null>(null)

onMounted(async () => {
  await wordbooksStore.load()
  const id = route.params.id as string
  book.value = wordbooksStore.getWordbookById(id) || null
})

function goBack() {
  router.push('/wordbook')
}

function speakWord(word: Word) {
  void speakEnglish(word.english, { rate: 0.85 })
}

function speakExample(word: Word) {
  if (!word.exampleEn?.trim()) return
  void speakEnglish(word.exampleEn, { rate: 0.88 })
}
</script>

<template>
  <div class="detail-page">
    <header class="detail-header">
      <button class="btn-back" @click="goBack">‹ 返回</button>
      <h2 v-if="book">{{ book.name }}</h2>
    </header>

    <div v-if="!book" class="empty-state">
      <p>词库未找到</p>
    </div>

    <template v-else>
      <div class="book-info">
        <span class="info-tag">{{ book.categoryName }}</span>
        <span class="info-tag">{{ book.words.length }} 词</span>
      </div>

      <div class="word-list">
        <div v-for="(word, idx) in book.words" :key="idx" class="word-card">
          <div class="word-main">
            <span class="word-en">{{ word.english }}</span>
            <span v-if="word.phonetic" class="word-phonetic">{{ word.phonetic }}</span>
            <button
              type="button"
              class="btn-speak"
              aria-label="朗读单词"
              @click.stop="speakWord(word)"
            >🔊</button>
          </div>
          <div class="word-cn">{{ word.chinese }}</div>
          <div v-if="word.explanation" class="word-explanation">{{ word.explanation }}</div>
          <div v-if="word.exampleEn" class="word-example">
            <div class="example-row">
              <div class="example-en">{{ word.exampleEn }}</div>
              <button
                type="button"
                class="btn-speak btn-speak-sm"
                aria-label="朗读例句"
                @click.stop="speakExample(word)"
              >🔊</button>
            </div>
            <div v-if="word.exampleCn" class="example-cn">{{ word.exampleCn }}</div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.detail-page {
  padding: 16px;
  padding-top: max(16px, env(safe-area-inset-top));
  padding-bottom: 80px;
}

.detail-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.detail-header h2 {
  font-size: 20px;
  font-weight: 700;
  color: var(--ink);
}

.btn-back {
  font-size: 16px;
  font-weight: 600;
  color: var(--p1);
  background: none;
  border: none;
  padding: 4px 8px;
  cursor: pointer;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: var(--ink-light);
  font-size: 16px;
}

.book-info {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.info-tag {
  font-size: 12px;
  font-weight: 600;
  color: var(--ink-soft);
  background: var(--line);
  padding: 4px 10px;
  border-radius: 10px;
}

.word-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.word-card {
  background: var(--paper);
  border: 2px solid var(--line);
  border-radius: var(--r-md);
  padding: 14px 16px;
}

.word-main {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 4px;
}

.btn-speak {
  flex-shrink: 0;
  margin-left: auto;
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 6px;
}

.btn-speak-sm {
  font-size: 16px;
  margin-left: 0;
}

.btn-speak:active {
  transform: scale(0.92);
}

.example-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.example-row .example-en {
  flex: 1;
}

.word-en {
  font-size: 17px;
  font-weight: 700;
  color: var(--ink);
}

.word-phonetic {
  font-size: 13px;
  color: var(--ink-light);
}

.word-cn {
  font-size: 14px;
  font-weight: 600;
  color: var(--ink-soft);
  margin-bottom: 6px;
}

.word-explanation {
  font-size: 12.5px;
  color: var(--ink-soft);
  line-height: 1.5;
  margin-top: 4px;
  padding: 4px 8px;
  background: #f5f0ea;
  border-radius: 6px;
}

.word-example {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1.5px dashed var(--line);
}

.example-en {
  font-size: 13px;
  color: var(--ink);
  font-style: italic;
  line-height: 1.5;
}

.example-cn {
  font-size: 12px;
  color: var(--ink-light);
  margin-top: 2px;
}
</style>
