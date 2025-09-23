"use client"

import { useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

export default function AuthErrorPage() {
  const searchParams = useSearchParams()
  const error = searchParams?.get("error") ?? null

  useEffect(() => {
    if (error) {
      console.error("Authentication error:", error)
    }
  }, [error])

  const errorMessage =
    error === "AccessDenied"
      ? "You do not have permission to sign in."
      : "An error occurred during authentication. Please try again."

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Alert variant="destructive" className="max-w-md">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Authentication Error</AlertTitle>
        <AlertDescription>{errorMessage}</AlertDescription>
      </Alert>
    </div>
  )
}