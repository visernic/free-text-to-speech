"use client"

import type React from "react"

// Adapted from https://github.com/shadcn-ui/ui/blob/main/apps/www/registry/default/ui/use-toast.ts
import { useState, useCallback } from "react"

const TOAST_LIMIT = 1
const TOAST_REMOVE_DELAY = 1000000

type ToastActionElement = React.ReactElement

export type Toast = {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
  variant?: "default" | "destructive"
}

let count = 0

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return count.toString()
}

type UseToastOptions = {
  duration?: number
}

export function useToast(options?: UseToastOptions) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((toastId?: string) => {
    setToasts((toasts) => {
      if (toastId) {
        return toasts.filter((t) => t.id !== toastId)
      }
      return []
    })
  }, [])

  const toast = useCallback(
    ({ ...props }: Omit<Toast, "id">) => {
      const id = genId()
      const newToast = { id, ...props }

      setToasts((toasts) => [...toasts, newToast].slice(-TOAST_LIMIT))

      setTimeout(() => {
        dismiss(id)
      }, options?.duration || 5000)

      return id
    },
    [dismiss, options?.duration],
  )

  return {
    toast,
    dismiss,
    toasts,
  }
}

export type ToasterToast = Toast & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
}
