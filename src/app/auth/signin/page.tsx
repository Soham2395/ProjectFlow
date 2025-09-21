import { getProviders } from "next-auth/react"
import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/auth"
import SignIn from "../../../components/signin"

export default async function SignInPage() {
  const session = await getServerSession(authOptions)
  
  // If the user is already logged in, redirect to the dashboard
  if (session) {
    redirect('/dashboard')
  }

  const providers = await getProviders()
  
  return <SignIn providers={providers} mode="signin" />
}