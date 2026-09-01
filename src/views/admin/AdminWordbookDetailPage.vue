<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '@/lib/api'
import type { Word } from '@/lib/types'

interface AdminWord extends Word {
  id: string
  sortOrder: number
}

interface Book {
  id: string
  name: string
  category: string
  categoryName: string
  words: AdminWord[]
}

const route = useRoute()
const router = useRouter()
const book = ref<Book | null>(null)
const msg = ref('')
const meta = reactive({ name: '', category: '', categoryName: '' })
const wordForm = reactive({
  english: '',
  chinese: '',
  phonetic: '',
  exampleEn: '',
  exampleCn: '',
  explanation: '',
})
const editing = ref<AdminWord | null>(null)

async function load() {
  book.value = await api<Book>(`/api/admin/wordbooks/${route.params.id}`)
  meta.name = book.value.name
  meta.category = book.value.category
  meta.categoryName = book.value.categoryName
}

onMounted(load)

async function saveMeta() {
  await api(`/api/admin/wordbooks/${route.params.id}`, {
    method: 'PUT',
    body: JSON.stringify(meta),
  })
  msg.value = '词库信息已保存'
  await load()
}

async function uploadCsv(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const data = new FormData()
  data.append('file', file)
  try {
    book.value = await api<Book>(`/api/admin/wordbooks/${route.params.id}/upload`, {
      method: 'POST',
      body: data,
    })
    msg.value = `已导入 ${book.value.words.length} 个词`
  } catch (err: any) {
    msg.value = err.message
  }
  ;(e.target as HTMLInputElement).value = ''
}

async function addWord() {
  await api(`/api/admin/wordbooks/${route.params.id}/words`, {
    method: 'POST',
    body: JSON.stringify(wordForm),
  })
  wordForm.english = ''
  wordForm.chinese = ''
  wordForm.phonetic = ''
  wordForm.exampleEn = ''
  wordForm.exampleCn = ''
  wordForm.explanation = ''
  await load()
}

function startEdit(w: AdminWord) {
  editing.value = { ...w }
}

async function saveWord() {
  if (!editing.value) return
  await api(`/api/admin/wordbooks/${route.params.id}/words/${editing.value.id}`, {
    method: 'PUT',
    body: JSON.stringify(editing.value),
  })
  editing.value = null
  await load()
}

async function removeWord(w: AdminWord) {
  if (!window.confirm(`删除 ${w.english}？`)) return
  await api(`/api/admin/wordbooks/${route.params.id}/words/${w.id}`, { method: 'DELETE' })
  await load()
}
</script>

<template>
  <div v-if="book">
    <button class="back" @click="router.push({ name: 'admin-wordbooks' })">‹ 返回书架</button>
    <header class="head">
      <h1>{{ book.name }}</h1>
      <p>{{ book.words.length }} 词 · {{ book.id }}</p>
    </header>
    <p v-if="msg" class="note">{{ msg }}</p>

    <section class="card block">
      <h2>封面信息</h2>
      <div class="row">
        <input v-model="meta.name" placeholder="名称" />
        <input v-model="meta.category" placeholder="分类 id" />
        <input v-model="meta.categoryName" placeholder="分类显示名" />
        <button class="btn btn-primary" @click="saveMeta">保存</button>
      </div>
      <label class="upload">
        用 CSV 整本替换词条
        <input type="file" accept=".csv,text/csv" @change="uploadCsv" />
      </label>
    </section>

    <section class="card block">
      <h2>加一个词</h2>
      <div class="row wrap">
        <input v-model="wordForm.english" placeholder="english" />
        <input v-model="wordForm.chinese" placeholder="中文" />
        <input v-model="wordForm.phonetic" placeholder="音标" />
        <input v-model="wordForm.exampleEn" placeholder="例句 EN" />
        <input v-model="wordForm.exampleCn" placeholder="例句 CN" />
        <input v-model="wordForm.explanation" placeholder="说明" />
        <button class="btn btn-mint" @click="addWord">添加</button>
      </div>
    </section>

    <section class="card block">
      <h2>词条</h2>
      <table>
        <thead>
          <tr>
            <th>英文</th><th>中文</th><th>音标</th><th>例句</th><th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="w in book.words" :key="w.id">
            <template v-if="editing?.id === w.id && editing">
              <td><input v-model="editing.english" /></td>
              <td><input v-model="editing.chinese" /></td>
              <td><input v-model="editing.phonetic" /></td>
              <td><input v-model="editing.exampleEn" /></td>
              <td>
                <button @click="saveWord">保存</button>
                <button @click="editing = null">取消</button>
              </td>
            </template>
            <template v-else>
              <td>{{ w.english }}</td>
              <td>{{ w.chinese }}</td>
              <td>{{ w.phonetic }}</td>
              <td>{{ w.exampleEn }}</td>
              <td>
                <button @click="startEdit(w)">改</button>
                <button @click="removeWord(w)">删</button>
              </td>
            </template>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>

<style scoped>
.back { background: none; color: var(--ink-soft); font-weight: 700; margin-bottom: 12px; }
.head h1 { font-size: 28px; }
.head p { color: var(--ink-soft); margin-bottom: 12px; }
.note { font-weight: 700; color: var(--p3-deep); margin-bottom: 12px; }
.block { margin-bottom: 16px; }
h2 { font-size: 16px; margin-bottom: 10px; }
.row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.row input, table input {
  padding: 8px 10px;
  border: 2px solid var(--line);
  border-radius: 10px;
  font-weight: 600;
}
.upload {
  display: inline-flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 12px;
  font-size: 13px;
  font-weight: 700;
}
table { width: 100%; border-collapse: collapse; }
th, td { text-align: left; padding: 8px 6px; border-bottom: 1px dashed var(--line); font-size: 13px; vertical-align: top; }
td button {
  background: var(--paper-warm);
  border: 1.5px solid var(--line);
  border-radius: 8px;
  padding: 4px 8px;
  margin-right: 4px;
  font-weight: 700;
  font-size: 12px;
}
</style>
