import { create } from 'zustand'
import type { Declaration, DeclarationStatus, CreateDeclarationPayload } from 'nalogai-shared/types/declaration.types'
import {
  listDeclarationsApi,
  createDeclarationApi,
  calculateDeclarationApi,
  submitDeclarationApi,
} from '@api/declarations.api'

interface DeclarationStore {
  declarations: Declaration[]
  loading:      boolean
  initialized:  boolean

  fetchDeclarations:    () => Promise<void>
  createDeclaration:    (payload: CreateDeclarationPayload) => Promise<Declaration>
  calculateDeclaration: (id: string) => Promise<Declaration>
  submitDeclaration:    (id: string, signedXml?: string) => Promise<Declaration>
  updateStatus:         (id: string, status: DeclarationStatus, eGovCode?: string) => void
  getById:              (id: string) => Declaration | undefined
}

export const useDeclarationStore = create<DeclarationStore>((set, get) => ({
  declarations: [],
  loading:      false,
  initialized:  false,

  fetchDeclarations: async () => {
    if (get().loading) return
    set({ loading: true })
    try {
      const declarations = await listDeclarationsApi()
      set({ declarations, initialized: true })
    } finally {
      set({ loading: false })
    }
  },

  createDeclaration: async (payload) => {
    const decl = await createDeclarationApi(payload)
    set((s) => ({ declarations: [decl, ...s.declarations] }))
    return decl
  },

  calculateDeclaration: async (id) => {
    const updated = await calculateDeclarationApi(id)
    set((s) => ({
      declarations: s.declarations.map((d) => d.id === id ? updated : d),
    }))
    return updated
  },

  submitDeclaration: async (id, signedXml) => {
    const updated = await submitDeclarationApi(id, signedXml)
    set((s) => ({
      declarations: s.declarations.map((d) => d.id === id ? updated : d),
    }))
    return updated
  },

  // Local-only update for optimistic UI (e.g. after confirmed API call)
  updateStatus: (id, status, eGovCode) =>
    set((s) => ({
      declarations: s.declarations.map((d) =>
        d.id !== id ? d : {
          ...d,
          status,
          eGovConfirmationCode: eGovCode ?? d.eGovConfirmationCode,
          submittedAt: status === 'SUBMITTED' ? new Date().toISOString() : d.submittedAt,
          updatedAt:   new Date().toISOString(),
        },
      ),
    })),

  getById: (id) => get().declarations.find((d) => d.id === id),
}))
