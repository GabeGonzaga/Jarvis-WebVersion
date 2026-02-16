<template>
  <div class="jarvis-container">
    <div class="chat-header">
      <h1>JARVIS Mk2</h1>
      <div class="status">
        <span :class="['status-indicator', statusOnline ? 'online' : 'offline']"></span>
        <span>{{ statusOnline ? 'Online' : 'Offline' }}</span>
      </div>
    </div>

    <div class="chat-messages" ref="messagesContainer">
      <div 
        v-for="msg in messages" 
        :key="msg.id"
        :class="['message', msg.sender]"
      >
        <div class="message-content">
          <div class="sender-label">{{ msg.sender === 'user' ? 'You' : 'JARVIS' }}</div>
          <div class="text">{{ msg.text }}</div>
          <div class="timestamp">{{ formatTime(msg.timestamp) }}</div>
        </div>
      </div>
      
      <div v-if="isTyping" class="message jarvis typing">
        <div class="message-content">
          <div class="sender-label">JARVIS</div>
          <div class="typing-indicator">
            <span></span><span></span><span></span>
          </div>
        </div>
      </div>
    </div>

    <div class="chat-input">
      <input
        v-model="inputMessage"
        @keyup.enter="handleSendMessage"
        placeholder="Ask Jarvis anything..."
        :disabled="isTyping"
      />
      <button @click="handleSendMessage" :disabled="!inputMessage.trim() || isTyping">
        Send
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { useJarvis } from '~/composables/useJarvis' 

interface Message {
  id: number
  sender: 'user' | 'jarvis'
  text: string
  timestamp: Date
}

const messages = ref<Message[]>([
  {
    id: 0,
    sender: 'jarvis',
    text: 'Good day, Sir. How may I assist you today?',
    timestamp: new Date()
  }
])

const inputMessage = ref('')
const isTyping = ref(false)
const statusOnline = ref(false)
const messagesContainer = ref<HTMLElement | null>(null)
let messageId = 1

// Check status on mount
onMounted(async () => {
  try {
    const { getStatus } = useJarvis()
    await getStatus()
    statusOnline.value = true
  } catch (error) {
    statusOnline.value = false
    console.warn('Backend not available')
  }
})

const handleSendMessage = async () => {
  if (!inputMessage.value.trim() || isTyping.value) return

  const userMessage: Message = {
    id: messageId++,
    sender: 'user',
    text: inputMessage.value,
    timestamp: new Date()
  }

  messages.value.push(userMessage)
  const messageText = inputMessage.value
  inputMessage.value = ''
  isTyping.value = true

  // Scroll to bottom
  await nextTick()
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }

  try {
    const { sendMessage } = useJarvis()
    const response = await sendMessage(messageText)
    
    const jarvisMessage: Message = {
      id: messageId++,
      sender: 'jarvis',
      text: response.response,
      timestamp: new Date(response.timestamp)
    }

    messages.value.push(jarvisMessage)
  } catch (error) {
    console.error('Error:', error)
    const errorMessage: Message = {
      id: messageId++,
      sender: 'jarvis',
      text: 'I apologize, Sir. The backend is not connected yet. Please start the Django server.',
      timestamp: new Date()
    }
    messages.value.push(errorMessage)
  } finally {
    isTyping.value = false
    
    // Scroll to bottom
    await nextTick()
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  }
}

const formatTime = (date: Date) => {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: 'numeric',
    hour12: true
  }).format(date)
}
</script>

<style scoped>
.jarvis-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  max-width: 1200px;
  margin: 0 auto;
  background: #0a0e27;
  color: #fff;
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 2rem;
  background: linear-gradient(135deg, #1a1f3a 0%, #0f1729 100%);
  border-bottom: 2px solid #00d9ff;
}

.chat-header h1 {
  font-size: 2rem;
  font-weight: 700;
  color: #00d9ff;
  margin: 0;
}

.status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
}

.status-indicator {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #ff4444;
}

.status-indicator.online {
  background: #00ff88;
  box-shadow: 0 0 10px #00ff88;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.message {
  display: flex;
  animation: slideIn 0.3s ease-out;
}

.message.user {
  justify-content: flex-end;
}

.message.jarvis {
  justify-content: flex-start;
}

.message-content {
  max-width: 70%;
  padding: 1rem 1.5rem;
  border-radius: 1rem;
  background: #1a1f3a;
  border: 1px solid #2a3154;
}

.message.user .message-content {
  background: linear-gradient(135deg, #00d9ff 0%, #0088cc 100%);
  border: none;
}

.sender-label {
  font-size: 0.8rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  opacity: 0.8;
}

.text {
  font-size: 1rem;
  line-height: 1.5;
  word-wrap: break-word;
}

.timestamp {
  font-size: 0.75rem;
  margin-top: 0.5rem;
  opacity: 0.6;
}

.typing-indicator {
  display: flex;
  gap: 0.3rem;
  padding: 0.5rem 0;
}

.typing-indicator span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #00d9ff;
  animation: bounce 1.4s infinite ease-in-out;
}

.typing-indicator span:nth-child(1) {
  animation-delay: -0.32s;
}

.typing-indicator span:nth-child(2) {
  animation-delay: -0.16s;
}

.chat-input {
  display: flex;
  gap: 1rem;
  padding: 1.5rem 2rem;
  background: #0f1729;
  border-top: 2px solid #00d9ff;
}

.chat-input input {
  flex: 1;
  padding: 1rem 1.5rem;
  background: #1a1f3a;
  border: 2px solid #2a3154;
  border-radius: 0.5rem;
  color: #fff;
  font-size: 1rem;
  outline: none;
  transition: border-color 0.3s;
}

.chat-input input:focus {
  border-color: #00d9ff;
}

.chat-input input::placeholder {
  color: #6b7a99;
}

.chat-input button {
  padding: 1rem 2rem;
  background: linear-gradient(135deg, #00d9ff 0%, #0088cc 100%);
  border: none;
  border-radius: 0.5rem;
  color: #fff;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.chat-input button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 5px 20px rgba(0, 217, 255, 0.4);
}

.chat-input button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes bounce {
  0%, 80%, 100% {
    transform: scale(0);
  }
  40% {
    transform: scale(1);
  }
}
</style>