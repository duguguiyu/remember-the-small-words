<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@/lib/api'

interface BookRow {
  id: string
  name: string
  category: string
  categoryName: string
  wordCount: number
  updatedAt: string
}

const router = useRouter()
const books = ref<BookRow[]>([])
const error = ref('')
const form = reactive({
  id: '',
  name: '',
  category: '',
  categoryName: '',
})

async function load() {
  books.value = await api<BookRow[]>('/api/admin/wordbooks')
}

onMounted(load)

async function createBook() {
  error.value = ''
  try {
    const created = await api<{ id: string }>('/api/admin/wordbooks', {
      method: 'POST',
      body: JSON.stringify({
        id: form.id || undefined,
        name: form.name,
        category: form.category,
        categoryName: form.categoryName,
      }),
    })
    form.id = ''
    form.name = ''
    form.category = ''
    form.categoryName = ''
    await load()
    router.push({ name: 'admin-wordbook-detail', params: { id: created.id } })
  } catch (e: any) {
    error.value = e.message
  }
}

async function removeBook(book: BookRow) {
  if (!window.confirm(`删除词库「${book.name}」？词条会一起删掉。`)) return
  await api(`/api/admin/wordbooks/${book.id}`, { method: 'DELETE' })
  await load()
}
</script>

<template>
  <div>
    <header class="head">
      <h1>词库书架</h1>
      <p>全员共用同一套词库。上传 CSV 或在详情页逐条改。</p>
    </header>

    <form class="card create" @submit.prevent="createBook">
      <h2>新开一本</h2>
      <div class="row">
        <input v-model="form.id" placeholder="ID（可选，如 ket3_0801）" />
        <input v-model="form.name" placeholder="名称" required />
        <input v-model="form.category" placeholder="分类 id，如 ket3" required />
        <input v-model="form.categoryName" placeholder="分类显示名" required />
        <button class="btn btn-primary">创建</button>
      </div>
      <p v-if="error" class="error">{{ error }}</p>
    </form>

    <div class="grid">
      <article v-for="b in books" :key="b.id" class="card book" @click="router.push({ name: 'admin-wordbook-detail', params: { id: b.id } })">
        <small>{{ b.categoryName }}</small>
        <h3>{{ b.name }}</h3>
        <p>{{ b.wordCount }} 词 · {{ b.id }}</p>
        <button class="danger" @click.stop="removeBook(b)">删除</button>
      </article>
    </div>
  </div>
</template>

<style scoped>
.head h1 { font-size: 28px; margin-bottom: 6px; }
.head p { color: var(--ink-soft); margin-bottom: 22px; }
.create { margin-bottom: 22px; }
.create h2 { font-size: 16px; margin-bottom: 12px; }
.row { display: flex; gap: 10px; flex-wrap: wrap; }
.row input {
  padding: 10px 12px;
  border: 2px solid var(--line);
  border-radius: 12px;
  font-weight: 600;
  min-width: 160px;
}
.error { color: var(--bad); margin-top: 8px; font-weight: 700; }
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 14px;
}
.book { cursor: pointer; position: relative; }
.book small { color: var(--p3-deep); font-weight: 700; }
.book h3 { margin: 6px 0; }
.book p { color: var(--ink-light); font-size: 13px; }
.danger {
  margin-top: 12px;
  background: #FFEBEB;
  color: var(--bad);
  border: 1.5px solid var(--bad);
  border-radius: 10px;
  padding: 6px 10px;
  font-weight: 700;
  font-size: 12px;
}
</style>
