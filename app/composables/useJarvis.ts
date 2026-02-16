export const useJarvis = () => {
  const config = useRuntimeConfig()
  const apiBase = config.public.apiBase

  const sendMessage = async (message: string) => {
    try {
      const response = await $fetch<{
        response: string
        command_executed: string | null
        timestamp: string
      }>(`${apiBase}/api/jarvis/chat/`, {
        method: 'POST',
        body: { message }
      })
      return response
    } catch (error) {
      console.error('Error sending message:', error)
      throw error
    }
  }

  const getStatus = async () => {
    try {
      const response = await $fetch<{
        status: string
        model: string
        conversations_count: number
      }>(`${apiBase}/api/jarvis/status/`)
      return response
    } catch (error) {
      console.error('Error fetching status:', error)
      throw error
    }
  }

  return {
    sendMessage,
    getStatus
  }
}