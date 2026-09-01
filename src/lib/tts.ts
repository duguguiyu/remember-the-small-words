import { useSettingsStore } from '@/stores/settings'

let cachedVoice: SpeechSynthesisVoice | null = null
let voicesReady: Promise<SpeechSynthesisVoice[]> | null = null

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return Promise.resolve([])
  }
  if (!voicesReady) {
    voicesReady = new Promise((resolve) => {
      const existing = speechSynthesis.getVoices()
      if (existing.length) {
        resolve(existing)
        return
      }
      const done = () => {
        speechSynthesis.removeEventListener('voiceschanged', done)
        resolve(speechSynthesis.getVoices())
      }
      speechSynthesis.addEventListener('voiceschanged', done)
      // Some browsers never fire voiceschanged; don't hang forever.
      setTimeout(() => resolve(speechSynthesis.getVoices()), 500)
    })
  }
  return voicesReady
}

function scoreEnglishVoice(voice: SpeechSynthesisVoice): number {
  const lang = voice.lang.replace('_', '-').toLowerCase()
  if (!lang.startsWith('en')) return -1000

  let score = 10
  if (lang === 'en-us' || lang.startsWith('en-us')) score += 30
  else if (lang === 'en-gb' || lang.startsWith('en-gb')) score += 20
  else score += 5

  const name = voice.name.toLowerCase()
  // Prefer natural / enhanced voices when available.
  if (name.includes('google')) score += 40
  if (name.includes('microsoft') && (name.includes('natural') || name.includes('online'))) score += 35
  if (name.includes('samantha') || name.includes('alex') || name.includes('daniel')) score += 25
  if (name.includes('enhanced') || name.includes('premium') || name.includes('neural')) score += 20
  // Deprioritize compact / novelty voices that sound robotic.
  if (name.includes('compact') || name.includes('whisper') || name.includes('zarvox')) score -= 30
  if (voice.localService) score += 5
  return score
}

async function pickEnglishVoice(): Promise<SpeechSynthesisVoice | null> {
  if (cachedVoice) return cachedVoice
  const voices = await loadVoices()
  const ranked = voices
    .map((v) => ({ v, score: scoreEnglishVoice(v) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
  cachedVoice = ranked[0]?.v ?? null
  return cachedVoice
}

export async function speakEnglish(text: string, opts?: { rate?: number }) {
  const trimmed = text?.trim()
  if (!trimmed || !('speechSynthesis' in window)) return

  try {
    const settings = useSettingsStore()
    if (!settings.ttsEnabled) return
  } catch {
    // Pinia may be unavailable outside app context; still speak.
  }

  const utterance = new SpeechSynthesisUtterance(trimmed)
  utterance.lang = 'en-US'
  utterance.rate = opts?.rate ?? 0.9
  utterance.pitch = 1

  const voice = await pickEnglishVoice()
  if (voice) {
    utterance.voice = voice
    utterance.lang = voice.lang || 'en-US'
  }

  speechSynthesis.cancel()
  speechSynthesis.speak(utterance)
}
