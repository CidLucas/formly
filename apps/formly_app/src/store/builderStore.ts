import { create } from 'zustand'
import type { Question } from '../lib/api'

interface BuilderState {
  id: string | null
  title: string
  questions: Question[]
  setId: (id: string | null) => void
  setTitle: (title: string) => void
  setQuestions: (questions: Question[]) => void
  addQuestion: (question: Question) => void
  updateQuestion: (index: number, question: Question) => void
  removeQuestion: (index: number) => void
  moveQuestion: (index: number, dir: number) => void
  reset: () => void
}

const initialState = {
  id: null as string | null,
  title: '',
  questions: [] as Question[],
}

export const useBuilderStore = create<BuilderState>((set) => ({
  ...initialState,
  setId: (id) => set({ id }),
  setTitle: (title) => set({ title }),
  setQuestions: (questions) => set({ questions }),
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
  reset: () => set({ ...initialState }),
}))
