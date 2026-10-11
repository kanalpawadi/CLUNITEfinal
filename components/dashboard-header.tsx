"use client"

import { useEffect, useState } from "react"
import type { User as DbUser } from '@/lib/supabase';
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"
import { getUserFromDatabase } from "@/lib/sync-user"
import { Bell, Search, Plus, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"

export function DashboardHeader() {
  const { user: authUser, signOut } = useAuth()
  const [userData, setUserData] = useState<DbUser | null>(null)

  useEffect(() => {
    async function loadUserData() {
      if (authUser) {
        const dbUser = await getUserFromDatabase(authUser.id)
        setUserData(dbUser)
      }
    }
    loadUserData()
  }, [authUser])

  const userName = userData?.full_name || authUser?.user_metadata?.full_name || "User"
  const userEmail = authUser?.email || "user@example.com"
  const userInitials = userName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
        {/* Left side - Search */}
        <div className="hidden sm:flex items-center space-x-4 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search events, clubs..."
              className="pl-10 bg-background border-border focus:bg-card transition-colors"
            />
          </div>
        </div>

        {/* Right side - Actions */}
        <div className="flex items-center space-x-4">
          {/* Host Event Button */}
          <Button asChild className="font-semibold">
            <Link href="/dashboard/organizer/host/verify" prefetch>
              <Plus className="h-4 w-4 sm:mr-2" aria-hidden />
              <span className="sr-only sm:not-sr-only">Host Event</span>
            </Link>
          </Button>



          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0">
                <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold text-sm">
                  {userInitials}
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{userName}</p>
                  <p className="text-xs leading-none text-muted-foreground">{userEmail}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/dashboard/student">Student Dashboard</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/dashboard/organizer">Organizer Dashboard</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/profile">Profile</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/profile/id-card">My ID card</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={async (e) => {
                  e.preventDefault()
                  await signOut()
                }} 
                className="text-destructive cursor-pointer"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
