import { create } from 'zustand'
import type { Question } from '../lib/api'

export type BuilderMode = 'chat' | 'canvas' | 'text'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface BuilderState {
  title: string
  questions: Question[]
  mode: BuilderMode
  chatMessages: ChatMessage[]
  setTitle: (title: string) => void
  setQuestions: (questions: Question[]) => void
  setMode: (mode: BuilderMode) => void
  addQuestion: (question: Question) => void
  updateQuestion: (index: number, question: Question) => void
  removeQuestion: (index: number) => void
  moveQuestion: (index: number, dir: number) => void
  addChatMessage: (message: ChatMessage) => void
  reset: () => void
}

const initialState = {
  title: '',
  questions: [] as Question[],
  mode: 'chat' as BuilderMode,
  chatMessages: [] as ChatMessage[],
}

export const useBuilderStore = create<BuilderState>((set) => ({
  ...initialState,
  setTitle: (title) => set({ title }),
  setQuestions: (questions) => set({ questions }),
  setMode: (mode) => set({ mode }),
  addQuestion: (question) => set((s) => ({ questions: [...s.questions, question] })),
  updateQuestion: (index, question) =>
    set((s) => ({ questions: s.questions.map((q, i) => (i === index ? question : q)) })),
  removeQuestion: (index) => set((s) => ({ questions: s.questions.filter((_, i) => i !== index) })),
  moveQuestion: (index, dir) =>
    set((s) => {
      const target = index + dir
      if (target < 0 || target >= s.questions.length) return s
      const next = [...s.questions]
      const [q] = next.splice(index, 1)
      next.splice(target, 0, q)
      return { questions: next }
    }),
  addChatMessage: (message) => set((s) => ({ chatMessages: [...s.chatMessages, message] })),
  reset: () => set({ ...initialState }),
}))
