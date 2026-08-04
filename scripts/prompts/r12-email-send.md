# R12 — Envio por e-mail real (Send) + endpoint de disparo no backend

Repo: /home/ec2-user/formly — `apps/formly_app/src/pages/Send.tsx` + `services/formly/app/api/`.

## Contexto

O usuário relatou: **o envio por e-mail não está funcionando.** Causa: `Send.tsx` linha ~90, `send()` é um **mock** — `setTimeout(() => navigate('/dashboard/{id}'), 1500)`. Não envia nada.

O protótipo (`send.html`) mostra: seleção de contatos (busca, todos/selecionados, checkboxes), CSV, mensagem opcional, botão "Enviar questionário →".

## Tarefa — implementar envio real

### 1. Backend: endpoint de disparo (mock de entrega, sem provedor externo)

Criar `services/formly/app/api/distribute.py` (ou adicionar em surveys.py):

```
POST /api/surveys/{survey_id}/distribute
Body: { "contact_ids": [...], "emails": [...], "message": "..." }
```

Comportamento (sem depender de Resend/SMTP — **Fase 1**):
- Valida survey (dono via `get_user_id`)
- Cria registros de "envio" na tabela `sendings` (se existir) OU retorna um resumo simulado:
  ```json
  { "status": "sent", "total": N, "sent": N, "failed": 0, "message": "N e-mails enviados" }
  ```
- Se não houver infra de e-mail configurada, retorna 200 com `"mode": "simulated"` + `"public_link": "http://.../s/{slug}"` — o frontend mostra o link público como alternativa de distribuição
- Registrar em `main.py` (prefix `/api`)

**Importante:** não inventar integração SMTP. Se houver env var `RESEND_API_KEY` → usar Resend (verificar lib). Senão → modo simulado com link público. Documentar no código.

### 2. Frontend: `Send.tsx` — chamar o endpoint

- `send()` passa a chamar `POST /api/surveys/{id}/distribute` com `{ contact_ids: [...selected], emails: [...csvEmails], message }`
- Estados: "Enviando..." (spinner no botão, desabilitado) → sucesso → navega `/dashboard/{id}`
- Erro → toast/mensagem inline, botão reabilitado
- Se o retorno tem `mode: simulated` + `public_link`, mostrar um **banner verde** pós-envio: "E-mail simulado (sem provedor configurado). Compartilhe o link público: [copiar]"
- Adicionar `distribute` no `lib/api.ts` (ex: `surveys.distribute(id, data)`)

### 3. Sem contatos selecionados
- Se `selected.size === 0 && csvEmails.length === 0` → mostrar aviso "Selecione ao menos um contato ou importe um CSV" (não enviar)

## Verificação
- `npx tsc --noEmit` → exit 0 (frontend) + `py_compile` backend
- Manual: builder → Enviar → Send → selecionar contato (ou CSV) → "Enviar questionário →" → navega ao dashboard; banner com link público aparece se simulado
- NÃO COMMITAR
