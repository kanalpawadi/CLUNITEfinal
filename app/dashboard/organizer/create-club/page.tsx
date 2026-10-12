"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { Loader2, Building2, Mail, User, Calendar, Shield, Image as ImageIcon, Upload, X } from "lucide-react"
import { getErrorMessage } from '@/lib/utils';

export default function CreateClubPage() {
  const router = useRouter()
  const { user: authUser, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [bannerUrl, setBannerUrl] = useState("")
  const [formData, setFormData] = useState({
    name: "",
    tagline: "",
    description: "",
    vision: "",
    category: "",
    college: "",
    founding_date: "",
    contact_email: "",
    official_email: "",
    faculty_in_charge: "",
    hod_name: "",
    president_name: "",
    president_email: "",
    president_phone: "",
  })

  const categories = [
    "Technical",
    "Cultural",
    "Sports",
    "Literary",
    "Social Service",
    "Entrepreneurship",
    "Arts",
    "Music",
    "Dance",
    "Drama",
    "Photography",
    "Other"
  ]

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size should be less than 5MB')
      return
    }

    setUploading(true)
    try {
      // Convert image to base64 and store temporarily (don't upload to database yet)
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64String = reader.result as string
        setBannerUrl(base64String) // Show preview
        // Store file info for later upload
        sessionStorage.setItem('pendingBannerFile', JSON.stringify({
          data: base64String,
          type: file.type,
          name: file.name
        }))
        toast.success('Banner ready! Will be uploaded after verification.')
        setUploading(false)
      }
      reader.onerror = () => {
        toast.error('Failed to read image file')
        setUploading(false)
      }
      reader.readAsDataURL(file)
    } catch (error) {
      console.error('Upload error:', error)
      toast.error(`Failed to process banner: ${getErrorMessage(error)}`)
      setUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Validate required fields
      if (!formData.name || !formData.category || !formData.college || !formData.official_email) {
        toast.error("Please fill all required fields")
        setLoading(false)
        return
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(formData.official_email)) {
        toast.error("Please enter a valid email address")
        setLoading(false)
        return
      }

      // Check authentication
      if (!authUser) {
        toast.error("You must be logged in to create a club")
        setLoading(false)
        return
      }

      // The server generates the PIN and emails it to the official address; the PIN never reaches the browser
      const response = await fetch('/api/clubs/pending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          official_email: formData.official_email,
          president_name: formData.president_name,
          president_email: formData.president_email,
          president_phone: formData.president_phone,
          club: {
            name: formData.name,
            tagline: formData.tagline,
            description: formData.description,
            vision: formData.vision,
            category: formData.category,
            college: formData.college,
            founding_date: formData.founding_date,
            faculty_in_charge: formData.faculty_in_charge,
            hod_name: formData.hod_name,
          },
        }),
      })
      const result: { id?: string; emailed?: boolean; devPin?: string; error?: string } = await response
        .json()
        .catch(() => ({}))

      if (!response.ok || !result.id) {
        toast.error(result.error || 'Failed to prepare club data. Please try again.')
        setLoading(false)
        return
      }

      sessionStorage.setItem('pendingClubId', result.id)

      if (result.emailed) {
        toast.success(`Verification PIN sent to ${formData.official_email}.`, { duration: 8000 })
      } else if (result.devPin) {
        toast.info(`Dev mode (email not configured): your PIN is ${result.devPin}`, { duration: 20000 })
      } else {
        toast.warning('Club saved, but the PIN email could not be sent. Check the email configuration.', { duration: 8000 })
      }

      // Redirect to PIN verification page
      setTimeout(() => {
        router.push(`/dashboard/organizer/verify-club`)
      }, 2000)

    } catch (error) {
      console.error('Error creating club:', error)
      const errorMessage = getErrorMessage(error, "Unknown error occurred")
      toast.error(`Failed to create club: ${errorMessage}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="container max-w-5xl mx-auto">
        {/* Header Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-primary rounded-3xl mb-4 shadow-soft-lg">
            <Building2 className="h-10 w-10 text-primary-foreground" />
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-3">
            Create Your Club
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Register your club and receive an 8-digit PIN via email to unlock organizer access
          </p>
        </div>

        <Card className="border border-border shadow-soft">
          <CardContent className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-border">
                <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-primary-foreground" />
                </div>
                <h3 className="text-xl font-bold text-foreground">Basic Information</h3>
              </div>
              
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-semibold text-foreground">Club Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Tech Innovators Club"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="h-12 border-2 focus:border-primary focus:ring-ring"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category" className="text-sm font-semibold text-foreground">Category *</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                    required
                  >
                    <SelectTrigger className="h-12 border-2 focus:border-primary focus:ring-ring">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tagline" className="text-sm font-semibold text-foreground">Tagline</Label>
                <Input
                  id="tagline"
                  placeholder="A short catchy phrase about your club"
                  value={formData.tagline}
                  onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                  className="h-12 border-2 focus:border-primary focus:ring-ring"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm font-semibold text-foreground">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe your club's mission and activities"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                  className="border-2 focus:border-primary focus:ring-ring resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vision" className="text-sm font-semibold text-foreground">Vision</Label>
                <Textarea
                  id="vision"
                  placeholder="Your club's long-term vision and goals"
                  value={formData.vision}
                  onChange={(e) => setFormData({ ...formData, vision: e.target.value })}
                  rows={3}
                  className="border-2 focus:border-primary focus:ring-ring resize-none"
                />
              </div>

              {/* Club Banner Upload */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-primary" />
                  Club Banner (Optional)
                </Label>
                
                {bannerUrl ? (
                  <div className="relative group">
                    <img 
                      src={bannerUrl} 
                      alt="Club banner" 
                      className="w-full h-48 object-cover rounded-xl border-2 border-primary/20"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => setBannerUrl("")}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-primary/40 rounded-xl p-8 text-center hover:border-primary transition-colors bg-primary/50">
                    <input
                      type="file"
                      id="banner-upload"
                      accept="image/*"
                      onChange={handleBannerUpload}
                      className="hidden"
                      disabled={uploading}
                    />
                    <label 
                      htmlFor="banner-upload" 
                      className="cursor-pointer flex flex-col items-center gap-3"
                    >
                      <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center">
                        <Upload className="h-8 w-8 text-primary-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {uploading ? 'Uploading...' : 'Click to upload club banner'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          PNG, JPG up to 5MB (Recommended: 1200x400px)
                        </p>
                      </div>
                    </label>
                  </div>
                )}
              </div>
            </div>

            {/* College & Contact */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-border">
                <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                  <Mail className="h-5 w-5 text-primary-foreground" />
                </div>
                <h3 className="text-xl font-bold text-foreground">College & Contact Information</h3>
              </div>
              
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="college" className="text-sm font-semibold text-foreground">College/University *</Label>
                  <Input
                    id="college"
                    placeholder="e.g., MIT, Stanford"
                    value={formData.college}
                    onChange={(e) => setFormData({ ...formData, college: e.target.value })}
                    required
                    className="h-12 border-2 focus:border-primary focus:ring-ring"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="founding_date" className="text-sm font-semibold text-foreground">Founding Date</Label>
                  <Input
                    id="founding_date"
                    type="date"
                    value={formData.founding_date}
                    onChange={(e) => setFormData({ ...formData, founding_date: e.target.value })}
                    className="h-12 border-2 focus:border-primary focus:ring-ring"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="official_email" className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Mail className="h-4 w-4 text-primary" />
                  Official Club Email * (PIN will be sent here)
                </Label>
                <Input
                  id="official_email"
                  type="email"
                  placeholder="club@college.edu"
                  value={formData.official_email}
                  onChange={(e) => setFormData({ ...formData, official_email: e.target.value })}
                  required
                  className="h-12 border-2 focus:border-primary focus:ring-ring"
                />
                <p className="text-sm text-primary font-medium">
                  This email will receive the 8-digit PIN for club verification
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="faculty_in_charge" className="text-sm font-semibold text-foreground">Faculty Coordinator</Label>
                <Input
                  id="faculty_in_charge"
                  placeholder="Prof. John Doe"
                  value={formData.faculty_in_charge}
                  onChange={(e) => setFormData({ ...formData, faculty_in_charge: e.target.value })}
                  className="h-12 border-2 focus:border-primary focus:ring-ring"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="hod_name" className="text-sm font-semibold text-foreground">Head of Department (HOD)</Label>
                <Input
                  id="hod_name"
                  placeholder="Dr. Jane Smith"
                  value={formData.hod_name}
                  onChange={(e) => setFormData({ ...formData, hod_name: e.target.value })}
                  className="h-12 border-2 focus:border-primary focus:ring-ring"
                />
                <p className="text-xs text-muted-foreground">Printed with the faculty coordinator on participation certificates.</p>
              </div>
            </div>

            {/* President Information */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-border">
                <div className="w-10 h-10 bg-success rounded-lg flex items-center justify-center">
                  <User className="h-5 w-5 text-primary-foreground" />
                </div>
                <h3 className="text-xl font-bold text-foreground">President Information</h3>
              </div>
              
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="president_name" className="text-sm font-semibold text-foreground">President Name</Label>
                  <Input
                    id="president_name"
                    placeholder="Full name"
                    value={formData.president_name}
                    onChange={(e) => setFormData({ ...formData, president_name: e.target.value })}
                    className="h-12 border-2 focus:border-primary focus:ring-ring"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="president_email" className="text-sm font-semibold text-foreground">President Email</Label>
                  <Input
                    id="president_email"
                    type="email"
                    placeholder="president@email.com"
                    value={formData.president_email}
                    onChange={(e) => setFormData({ ...formData, president_email: e.target.value })}
                    className="h-12 border-2 focus:border-primary focus:ring-ring"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="president_phone" className="text-sm font-semibold text-foreground">President Phone</Label>
                <Input
                  id="president_phone"
                  type="tel"
                  placeholder="+1 234 567 8900"
                  value={formData.president_phone}
                  onChange={(e) => setFormData({ ...formData, president_phone: e.target.value })}
                  className="h-12 border-2 focus:border-primary focus:ring-ring"
                />
              </div>
            </div>

            {/* Submit */}
            <div className="space-y-4 pt-6">
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-14 bg-primary hover:bg-primary text-lg font-semibold shadow-soft-lg hover:shadow-soft-lg transition-all duration-300"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Creating Club...
                  </>
                ) : (
                  <>
                    <Shield className="mr-2 h-5 w-5" />
                    Create Club & Get PIN
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={loading}
                className="w-full h-12 border-2"
              >
                Cancel
              </Button>
            </div>

            <div className="mt-6 p-4 bg-primary/5 rounded-xl border-2 border-primary/20">
              <p className="text-sm text-foreground text-center font-medium">
                After submission, you&apos;ll receive an <strong>8-digit PIN</strong> via email. Use this PIN to verify your club and gain organizer access.
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
      </div>
    </div>
  )
}
