<template>
  <div class="shell">
    <div class="hud">
      <header class="topbar">
        <div class="brand">
          <div class="logo" aria-hidden="true"></div>
          <div class="titles">
            <div class="title">JARVIS Mk2</div>
            <div class="subtitle">Local Assistant • Ollama</div>
          </div>
        </div>

        <div class="status">
          <span class="dot" :class="statusOnline ? 'ok' : 'bad'"></span>
          <span class="label">{{ statusOnline ? 'ONLINE' : 'OFFLINE' }}</span>
          <span class="pill">{{ statusOnline ? 'API' : 'NO LINK' }}</span>
        </div>
      </header>

      <section class="panel">
        <div class="panel-head">
          <div class="panel-title">Conversation</div>

          <div class="panel-meta">
            <button
              v-for="b in quickButtons"
              :key="b.key"
              class="qbtn"
              type="button"
              @click="handleQuick(b)"
              :title="b.href || ''"
            >
              <span class="qkey">{{ b.key }}</span>
              <span class="qname">{{ b.label }}</span>
            </button>
          </div>
        </div>

        <div class="messages" ref="messagesContainer">
          <div
            v-for="msg in messages"
            :key="msg.id"
            class="msg"
            :class="msg.sender"
          >
            <div class="frame">
              <div class="meta">
                <div class="who">{{ msg.sender === 'user' ? 'YOU' : 'JARVIS' }}</div>
                <div class="time">{{ formatTime(msg.timestamp) }}</div>
              </div>
              <div class="body">{{ msg.text }}</div>
            </div>
          </div>

          <div v-if="isTyping" class="msg jarvis">
            <div class="frame">
              <div class="meta">
                <div class="who">JARVIS</div>
                <div class="time">…</div>
              </div>
              <div class="typing">
                <span></span><span></span><span></span>
              </div>
            </div>
          </div>
        </div>

        <footer class="composer">
          <div class="inputwrap">
            <span class="scan" aria-hidden="true"></span>
            <input
              v-model="inputMessage"
              @keyup.enter="handleSendMessage"
              placeholder="Ask Jarvis…"
              :disabled="isTyping"
            />
          </div>

          <button class="send" @click="handleSendMessage" :disabled="!inputMessage.trim() || isTyping">
            <span class="send-ico" aria-hidden="true"></span>
            SEND
          </button>
        </footer>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useJarvis } from '~/composables/useJarvis'

interface Message {
  id: number
  sender: 'user' | 'jarvis'
  text: string
  timestamp: Date
}

type QuickButton = {
  key: '1' | '2' | '3' | '4' | '5'
  label: string
  href?: string
  action?: 'link' | 'noop'
}

const quickButtons = ref<QuickButton[]>([
  { key: '1', label: 'YOUTUBE', href: 'https://youtube.com', action: 'link' },
  { key: '2', label: 'GITHUB', href: 'https://github.com', action: 'link' },
  { key: '3', label: 'DOCS', href: 'https://nuxt.com', action: 'link' },
  { key: '4', label: 'MOODLE', href: 'https://moodle25.iscte-iul.pt/my/courses.php', action: 'link' },
  { key: '5', label: 'OKTA', href: 'https://login.iscte-iul.pt/app/UserHome', action: 'link' },
])

const handleQuick = (b: QuickButton) => {
  if (b.action === 'link' && b.href) {
    window.open(b.href, '_blank', 'noopener,noreferrer')
    return
  }
}

const messages = ref<Message[]>([
  { id: 0, sender: 'jarvis', text: 'Good day, Sir. How may I assist you today?', timestamp: new Date() }
])

const inputMessage = ref('')
const isTyping = ref(false)
const statusOnline = ref(false)
const messagesContainer = ref<HTMLElement | null>(null)
let messageId = 1

onMounted(async () => {
  try {
    const { getStatus } = useJarvis()
    await getStatus()
    statusOnline.value = true
  } catch {
    statusOnline.value = false
  }
})

const scrollBottom = async () => {
  await nextTick()
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

const handleSendMessage = async () => {
  if (!inputMessage.value.trim() || isTyping.value) return

  const text = inputMessage.value.trim()

  messages.value.push({
    id: messageId++,
    sender: 'user',
    text,
    timestamp: new Date()
  })

  inputMessage.value = ''
  isTyping.value = true
  await scrollBottom()

  try {
    const { sendMessage } = useJarvis()
    const res = await sendMessage(text)

    messages.value.push({
      id: messageId++,
      sender: 'jarvis',
      text: res.response,
      timestamp: new Date(res.timestamp)
    })
  } catch {
    messages.value.push({
      id: messageId++,
      sender: 'jarvis',
      text: 'Backend not connected. Start the Django server on :8000.',
      timestamp: new Date()
    })
  } finally {
    isTyping.value = false
    await scrollBottom()
  }
}

const formatTime = (date: Date) =>
  new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }).format(date)
</script>

<style scoped>
/* ---------- palette ---------- */
.shell {
  min-height: 100vh;
  background:
    radial-gradient(900px 500px at 20% 10%, rgba(0, 217, 255, 0.18), transparent 60%),
    radial-gradient(800px 450px at 85% 20%, rgba(0, 120, 255, 0.16), transparent 60%),
    radial-gradient(700px 400px at 50% 90%, rgba(0, 255, 170, 0.08), transparent 60%),
    linear-gradient(180deg, #050814 0%, #070b1b 40%, #050814 100%);
  color: rgba(235, 245, 255, 0.92);
  position: relative;
  overflow: hidden;
}

/* schematic grid */
.shell::before {
  content: "";
  position: absolute;
  inset: 0;
  background:
    linear-gradient(rgba(0, 217, 255, 0.10) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 217, 255, 0.10) 1px, transparent 1px);
  background-size: 44px 44px;
  mask-image: radial-gradient(circle at 50% 40%, rgba(0,0,0,1) 0%, rgba(0,0,0,0.15) 55%, rgba(0,0,0,0) 80%);
  pointer-events: none;
}

.hud {
  position: relative;
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px 18px;
}

/* ---------- topbar ---------- */
.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 14px 16px;
  border: 1px solid rgba(0, 217, 255, 0.25);
  background: rgba(7, 14, 36, 0.65);
  backdrop-filter: blur(10px);
  box-shadow:
    0 0 0 1px rgba(0, 217, 255, 0.08) inset,
    0 18px 55px rgba(0, 0, 0, 0.35);
  border-radius: 14px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  border: 1px solid rgba(0, 217, 255, 0.35);
  background:
    radial-gradient(circle at 30% 30%, rgba(0, 217, 255, 0.8), rgba(0, 217, 255, 0.05) 60%),
    linear-gradient(135deg, rgba(0, 217, 255, 0.15), rgba(0, 140, 255, 0.05));
  box-shadow: 0 0 22px rgba(0, 217, 255, 0.25);
}

.titles .title {
  font-weight: 800;
  letter-spacing: 0.08em;
  color: rgba(150, 240, 255, 0.95);
  text-transform: uppercase;
  font-size: 16px;
}

.titles .subtitle {
  font-size: 13px;
  letter-spacing: 0.12em;
  opacity: 0.75;
  text-transform: uppercase;
}

.status {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: rgba(255, 80, 80, 0.9);
  box-shadow: 0 0 14px rgba(255, 80, 80, 0.35);
}
.dot.ok {
  background: rgba(0, 255, 170, 0.95);
  box-shadow: 0 0 16px rgba(0, 255, 170, 0.35);
}
.label {
  font-size: 12px;
  opacity: 0.9;
}
.pill {
  font-size: 11px;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid rgba(0, 217, 255, 0.25);
  background: rgba(0, 217, 255, 0.08);
}

/* ---------- panel ---------- */
.panel {
  margin-top: 16px;
  border-radius: 18px;
  border: 1px solid rgba(0, 217, 255, 0.22);
  background: rgba(6, 12, 30, 0.62);
  backdrop-filter: blur(10px);
  box-shadow:
    0 0 0 1px rgba(0, 217, 255, 0.06) inset,
    0 18px 60px rgba(0, 0, 0, 0.38);
  overflow: hidden;
}

.panel-head {
  padding: 14px 16px;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: baseline;
  border-bottom: 1px solid rgba(0, 217, 255, 0.14);
  background: linear-gradient(180deg, rgba(0, 217, 255, 0.06), transparent);
}

.panel-title {
  font-weight: 800;
  letter-spacing: 0.10em;
  text-transform: uppercase;
  color: rgba(170, 245, 255, 0.95);
}

.panel-meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

/* quick buttons */
.qbtn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 999px;
  border: 1px solid rgba(0, 217, 255, 0.22);
  background: rgba(0, 217, 255, 0.06);
  color: rgba(200, 250, 255, 0.92);
  cursor: pointer;
  transition: transform 0.12s ease, box-shadow 0.12s ease, background 0.12s ease;
  user-select: none;
}

.qbtn:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 22px rgba(0, 217, 255, 0.12);
  background: rgba(0, 217, 255, 0.10);
}

.qbtn:active {
  transform: translateY(0);
}

.qkey {
  width: 18px;
  height: 18px;
  display: inline-grid;
  place-items: center;
  border-radius: 6px;
  border: 1px solid rgba(0, 217, 255, 0.35);
  background: rgba(0, 217, 255, 0.08);
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.06em;
}

.qname {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.14em;
}

/* ---------- messages ---------- */
.messages {
  height: calc(100vh - 260px);
  overflow-y: auto;
  padding: 18px 16px 10px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* custom scroll */
.messages::-webkit-scrollbar { width: 10px; }
.messages::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.2); }
.messages::-webkit-scrollbar-thumb {
  background: rgba(0, 217, 255, 0.18);
  border: 1px solid rgba(0, 217, 255, 0.22);
  border-radius: 999px;
}

.msg {
  display: flex;
}
.msg.user { justify-content: flex-end; }
.msg.jarvis { justify-content: flex-start; }

.frame {
  width: min(760px, 92%);
  border-radius: 16px;
  position: relative;
  padding: 12px 14px;
  border: 1px solid rgba(0, 217, 255, 0.18);
  background: rgba(8, 16, 40, 0.65);
  box-shadow:
    0 0 0 1px rgba(0, 217, 255, 0.05) inset,
    0 10px 28px rgba(0, 0, 0, 0.25);
}

.msg.user .frame {
  border-color: rgba(0, 217, 255, 0.26);
  background: linear-gradient(135deg, rgba(0, 217, 255, 0.24), rgba(0, 140, 255, 0.10));
}

.meta {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  opacity: 0.85;
}

.who {
  color: rgba(170, 245, 255, 0.95);
}
.time {
  opacity: 0.75;
}

.body {
  font-size: 16px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

/* typing */
.typing {
  display: flex;
  gap: 8px;
  padding: 6px 0 2px;
}
.typing span {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: rgba(0, 217, 255, 0.9);
  box-shadow: 0 0 14px rgba(0, 217, 255, 0.25);
  animation: pulse 1.2s infinite ease-in-out;
}
.typing span:nth-child(2) { animation-delay: 0.15s; }
.typing span:nth-child(3) { animation-delay: 0.3s; }

@keyframes pulse {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; }
  40% { transform: scale(1); opacity: 1; }
}

/* ---------- composer ---------- */
.composer {
  display: flex;
  gap: 12px;
  padding: 14px 16px;
  border-top: 1px solid rgba(0, 217, 255, 0.14);
  background: linear-gradient(180deg, transparent, rgba(0, 217, 255, 0.05));
}

.inputwrap {
  flex: 1;
  position: relative;
  border-radius: 14px;
  border: 1px solid rgba(0, 217, 255, 0.22);
  background: rgba(6, 12, 30, 0.65);
  box-shadow: 0 0 0 1px rgba(0, 217, 255, 0.05) inset;
}

.scan {
  position: absolute;
  inset: 0;
  border-radius: 14px;
  pointer-events: none;
  background: linear-gradient(90deg, transparent, rgba(0, 217, 255, 0.10), transparent);
  transform: translateX(-100%);
  animation: scan 3.2s linear infinite;
  opacity: 0.55;
}
@keyframes scan {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

.inputwrap input {
  width: 100%;
  padding: 14px 14px 14px 14px;
  background: transparent;
  border: none;
  outline: none;
  color: rgba(235, 245, 255, 0.92);
  font-size: 16px;
}
.inputwrap input::placeholder {
  color: rgba(155, 185, 210, 0.65);
  letter-spacing: 0.02em;
}

.send {
  width: 130px;
  border-radius: 14px;
  border: 1px solid rgba(0, 217, 255, 0.35);
  background: linear-gradient(135deg, rgba(0, 217, 255, 0.25), rgba(0, 140, 255, 0.10));
  color: rgba(200, 250, 255, 0.95);
  font-weight: 900;
  letter-spacing: 0.16em;
  cursor: pointer;
  transition: transform 0.12s ease, box-shadow 0.12s ease, opacity 0.12s ease;
  position: relative;
}

.send:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 10px 28px rgba(0, 217, 255, 0.18);
}

.send:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.send-ico {
  display: inline-block;
  width: 10px;
  height: 10px;
  margin-right: 10px;
  border-radius: 2px;
  border: 1px solid rgba(0, 217, 255, 0.55);
  box-shadow: 0 0 12px rgba(0, 217, 255, 0.22);
}
</style>
