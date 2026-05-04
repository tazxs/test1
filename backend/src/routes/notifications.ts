/**
 * Notification settings and test endpoint.
 *
 * PATCH /api/notifications/settings — update per-channel preferences
 * POST  /api/notifications/test     — fire a test notification via all enabled channels
 */

import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '@middleware/auth'
import { validate } from '@middleware/validate'
import { sendSuccess } from '@utils/response'
import { prisma } from '@utils/prisma'
import { sendTestNotification } from '@services/NotificationService'

export const notificationsRouter = Router()
notificationsRouter.use(requireAuth)

// ── PATCH /api/notifications/settings ────────────────────────────────────────

const settingsSchema = z.object({
  emailNotifications:    z.boolean().optional(),
  telegramNotifications: z.boolean().optional(),
  telegramChatId:        z.string().max(64).nullable().optional(),
  notifyDaysBefore:      z
    .array(z.number().int().min(1).max(90))
    .min(1)
    .max(10)
    .optional(),
})

notificationsRouter.patch(
  '/settings',
  validate(settingsSchema),
  async (req, res, next) => {
    try {
      const body = req.body as z.infer<typeof settingsSchema>

      const updated = await prisma.user.update({
        where: { id: req.user!.sub },
        data: {
          ...(body.emailNotifications    != null && { emailNotifications:    body.emailNotifications }),
          ...(body.telegramNotifications != null && { telegramNotifications: body.telegramNotifications }),
          ...(body.telegramChatId        !== undefined && { telegramChatId:  body.telegramChatId }),
          ...(body.notifyDaysBefore      != null && { notifyDaysBefore:      body.notifyDaysBefore }),
        },
        select: {
          emailNotifications:    true,
          telegramNotifications: true,
          telegramChatId:        true,
          notifyDaysBefore:      true,
        },
      })

      sendSuccess(res, updated)
    } catch (err) {
      next(err)
    }
  },
)

// ── POST /api/notifications/test ─────────────────────────────────────────────

notificationsRouter.post('/test', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where:  { id: req.user!.sub },
      select: {
        fullName:              true,
        email:                 true,
        telegramChatId:        true,
        emailNotifications:    true,
        telegramNotifications: true,
        preferredLanguage:     true,
      },
    })

    if (!user) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Пользователь не найден' } })
      return
    }

    const result = await sendTestNotification({
      userId:                req.user!.sub,
      fullName:              user.fullName,
      email:                 user.email,
      telegramChatId:        user.telegramChatId,
      emailNotifications:    user.emailNotifications,
      telegramNotifications: user.telegramNotifications,
      language:              user.preferredLanguage as never,
    })

    sendSuccess(res, result)
  } catch (err) {
    next(err)
  }
})
