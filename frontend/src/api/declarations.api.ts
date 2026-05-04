import { api } from './axios'
import type {
  Declaration,
  CreateDeclarationPayload,
  DeclarationListParams,
} from 'nalogai-shared/types/declaration.types'
import type { ApiSuccess } from 'nalogai-shared/types/api.types'

// ── List declarations ──────────────────────────────────────────────────────────
export async function listDeclarationsApi(
  params?: DeclarationListParams,
): Promise<Declaration[]> {
  const { data } = await api.get<ApiSuccess<Declaration[]>>('/declarations', { params })
  return data.data
}

// ── Create a new declaration ───────────────────────────────────────────────────
export async function createDeclarationApi(
  payload: CreateDeclarationPayload,
): Promise<Declaration> {
  const { data } = await api.post<ApiSuccess<Declaration>>('/declarations', payload)
  return data.data
}

// ── Get a single declaration ───────────────────────────────────────────────────
export async function getDeclarationApi(id: string): Promise<Declaration> {
  const { data } = await api.get<ApiSuccess<Declaration>>(`/declarations/${id}`)
  return data.data
}

// ── Download generated Form 910.00 PDF ────────────────────────────────────────
export async function downloadDeclarationPdfApi(id: string): Promise<Blob> {
  const { data } = await api.get<Blob>(`/declarations/${id}/pdf`, {
    responseType: 'blob',
  })
  return data
}

// ── Trigger tax calculation ────────────────────────────────────────────────────
export async function calculateDeclarationApi(id: string): Promise<Declaration> {
  const { data } = await api.post<ApiSuccess<Declaration>>(`/declarations/${id}/calculate`)
  return data.data
}

// ── Submit declaration to eGov ─────────────────────────────────────────────────
// signedXml: XMLDSig-signed declaration XML from NCALayer.
// If omitted, the server submits unsigned XML (only valid for testing).
export async function submitDeclarationApi(
  id: string,
  signedXml?: string,
): Promise<Declaration> {
  const { data } = await api.post<ApiSuccess<Declaration>>(
    `/declarations/${id}/submit`,
    signedXml != null ? { signedXml } : {},
  )
  return data.data
}

// ── Soft-delete a declaration ──────────────────────────────────────────────────
export async function deleteDeclarationApi(id: string): Promise<void> {
  await api.delete(`/declarations/${id}`)
}
