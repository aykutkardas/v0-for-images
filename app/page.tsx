"use client"

import type React from "react"
import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog"
import { Send, Settings, User, Bot, Paperclip, Eye, Plus, MessageSquare, Trash2, Download } from "lucide-react"
import type { ChatMessage, GeneratedImage, Conversation } from "@/lib/indexeddb"
import {
  useConversations,
  useCurrentConversation,
  useSettings,
  useUpdateSettings,
  useSaveConversation,
  useDeleteConversation,
  useGenerateImage,
} from "@/lib/queries"
import modelEndpoints from "@/lib/model-endpoints.json"

export default function ImageEditor() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [prompt, setPrompt] = useState("")
  const [showSettings, setShowSettings] = useState(false)
  const [hoveredVersion, setHoveredVersion] = useState<string | null>(null)
  const [selectedVersion, setSelectedVersion] = useState<GeneratedImage | null>(null)
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [isHistoryAnimating, setIsHistoryAnimating] = useState(false)
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([])
  const [localGeneratedImages, setLocalGeneratedImages] = useState<GeneratedImage[]>([])
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false)
  const [tempFalKey, setTempFalKey] = useState("")

  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { data: conversations = [], refetch: refetchConversations } = useConversations()
  const { data: currentConversation } = useCurrentConversation(currentConversationId)
  const { data: settings } = useSettings()
  const updateSettings = useUpdateSettings()
  const saveConversation = useSaveConversation()
  const deleteConversation = useDeleteConversation()
  const generateImageMutation = useGenerateImage()

  const falKey = settings?.falKey || ""
  const selectedModel = settings?.selectedModel || "fal-ai/nano-banana/edit"

  useEffect(() => {
    if (settingsDialogOpen) {
      setTempFalKey(falKey)
    }
  }, [settingsDialogOpen, falKey])

  useEffect(() => {
    if (currentConversation) {
      setLocalMessages(currentConversation.messages || [])
      const limitedImages = (currentConversation.generatedImages || []).slice(0, 20)
      setLocalGeneratedImages(limitedImages)
      if (limitedImages.length > 0) {
        const latestImage = limitedImages[0]
        setSelectedVersion(latestImage)
        setSelectedImage(latestImage.url)
      }
    }
  }, [currentConversation])

  useEffect(() => {
    if (currentConversationId && (localMessages.length > 0 || localGeneratedImages.length > 0)) {
      const title =
        localMessages.length > 0
          ? localMessages[0].content.slice(0, 50) + (localMessages[0].content.length > 50 ? "..." : "")
          : "New Conversation"

      const limitedMessages = localMessages.slice(-50)
      const limitedImages = localGeneratedImages.slice(0, 20)

      console.log("[v0] Saving conversation with messages:", limitedMessages.length, "images:", limitedImages.length)

      saveConversation.mutate(
        {
          id: currentConversationId,
          title,
          messages: limitedMessages,
          generatedImages: limitedImages,
          createdAt: currentConversation?.createdAt || Date.now(),
          updatedAt: Date.now(),
        },
        {
          onSuccess: () => {
            console.log("[v0] Conversation saved successfully")
            refetchConversations()
          },
          onError: (error) => {
            console.error("[v0] Failed to save conversation:", error)
          },
        },
      )
    }
  }, [localMessages, localGeneratedImages, currentConversationId, currentConversation?.createdAt])

  const handleSaveFalKey = useCallback(() => {
    updateSettings.mutate({ falKey: tempFalKey })
    setSettingsDialogOpen(false)
  }, [tempFalKey, updateSettings])

  const toggleHistory = useCallback(() => {
    if (showHistory) {
      setIsHistoryAnimating(false)
      setTimeout(() => {
        setShowHistory(false)
      }, 300)
    } else {
      setShowHistory(true)
      setTimeout(() => {
        setIsHistoryAnimating(true)
      }, 10)
    }
  }, [showHistory])

  const createNewConversation = useCallback(() => {
    if (currentConversationId && localMessages.length === 0 && localGeneratedImages.length === 0) {
      console.log("[v0] Current conversation is already empty, not creating new one")
      return
    }

    const newId = Date.now().toString()
    const newConversation: Conversation = {
      id: newId,
      title: "New Conversation",
      messages: [],
      generatedImages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    saveConversation.mutate(newConversation, {
      onSuccess: () => {
        refetchConversations()
      },
    })

    setCurrentConversationId(newId)
    setLocalMessages([])
    setLocalGeneratedImages([])
    setSelectedImage(null)
    setSelectedVersion(null)
    setPrompt("")
  }, [saveConversation, refetchConversations, currentConversationId, localMessages.length, localGeneratedImages.length])

  const loadConversation = useCallback((conversationId: string) => {
    setCurrentConversationId(conversationId)
  }, [])

  const handleDeleteConversation = useCallback(
    (conversationId: string, e: React.MouseEvent) => {
      e.stopPropagation()
      if (deleteConversation.isPending) {
        return
      }

      console.log("[v0] Attempting to delete conversation:", conversationId)

      deleteConversation.mutate(conversationId, {
        onSuccess: () => {
          console.log("[v0] Successfully deleted conversation:", conversationId)
          refetchConversations()

          if (currentConversationId === conversationId) {
            console.log("[v0] Deleted conversation was current, switching to another")
            if (conversations.length > 1) {
              const remaining = conversations.filter((c) => c.id !== conversationId)
              if (remaining.length > 0) {
                loadConversation(remaining[0].id)
              } else {
                createNewConversation()
              }
            } else {
              createNewConversation()
            }
          }
        },
        onError: (error) => {
          console.error("[v0] Failed to delete conversation:", error)
        },
      })
    },
    [
      currentConversationId,
      conversations,
      loadConversation,
      createNewConversation,
      deleteConversation,
      refetchConversations,
    ],
  )

  const handleImageUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (e) => {
          const result = e.target?.result as string
          setSelectedImage(result)
          if (localGeneratedImages.length === 0) {
            const originalImage: GeneratedImage = {
              id: Date.now().toString() + "_original",
              url: result,
              prompt: "Original image",
              timestamp: Date.now(),
              model: "Original",
            }
            setLocalGeneratedImages([originalImage])
            setSelectedVersion(originalImage)
          }
        }
        reader.onerror = () => {
          console.error("[v0] FileReader error")
          reader.abort()
        }
        reader.readAsDataURL(file)
      }
      if (event.target) {
        event.target.value = ""
      }
    },
    [localGeneratedImages.length],
  )

  const playNotificationSound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      oscillator.frequency.setValueAtTime(800, audioContext.currentTime)
      oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1)

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)

      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.3)
    } catch (error) {
      console.log("[v0] Audio notification not supported:", error)
    }
  }, [])

  const handleGenerateImage = useCallback(async () => {
    if (!falKey || !prompt) return

    const attachmentImage = selectedImage || (localGeneratedImages.length > 0 ? localGeneratedImages[0].url : null)
    if (!attachmentImage) return

    let conversationId = currentConversationId

    if (!conversationId) {
      conversationId = Date.now().toString()
      setCurrentConversationId(conversationId)
    }

    if (localGeneratedImages.length === 0 && selectedImage) {
      const originalImage: GeneratedImage = {
        id: Date.now().toString() + "_original",
        url: selectedImage,
        prompt: "Original image",
        timestamp: Date.now(),
        model: "Original",
      }
      setLocalGeneratedImages([originalImage])
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: "user",
      content: prompt,
      image: attachmentImage,
      timestamp: Date.now(),
    }

    const updatedMessages = [...localMessages.slice(-49), userMessage]
    setLocalMessages(updatedMessages)

    const modelDisplayName = modelEndpoints.find((model) => model.endpoint === selectedModel)?.label || "Unknown Model"

    generateImageMutation.mutate(
      { falKey, prompt, imageUrl: attachmentImage, model: selectedModel },
      {
        onSuccess: (data) => {
          const newImage: GeneratedImage = {
            id: Date.now().toString() + "_gen",
            url: data.imageUrl,
            prompt,
            timestamp: Date.now(),
            model: modelDisplayName,
          }

          const assistantMessage: ChatMessage = {
            id: Date.now().toString() + "_assistant",
            type: "assistant",
            content: "Here's your edited image:",
            generatedImage: newImage,
            timestamp: Date.now(),
          }

          setLocalGeneratedImages((prev) => {
            const newImages = [newImage, ...prev]
            if (newImages.length > 20) {
              return newImages.slice(0, 20)
            }
            return newImages
          })

          setLocalMessages((prev) => [...prev.slice(-49), assistantMessage])
          setSelectedVersion(newImage)
          setSelectedImage(newImage.url)
          setPrompt("")

          playNotificationSound()
        },
        onError: (error) => {
          console.error("Error generating image:", error)
          const errorMessage: ChatMessage = {
            id: Date.now().toString() + "_error",
            type: "assistant",
            content: `Sorry, there was an error generating your image: ${error.message || "Unknown error occurred"}`,
            timestamp: Date.now(),
          }
          setLocalMessages((prev) => [...prev.slice(-49), errorMessage])
        },
      },
    )
  }, [
    falKey,
    prompt,
    selectedImage,
    localGeneratedImages,
    currentConversationId,
    selectedModel,
    generateImageMutation,
    modelEndpoints,
    localMessages,
    playNotificationSound,
  ])

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [localMessages, localGeneratedImages, scrollToBottom])

  return (
    <div
      className="h-screen bg-black flex flex-col relative"
      style={{
        scrollbarWidth: "none",
        msOverflowStyle: "none",
      }}
    >
      <style jsx global>{`
        ::-webkit-scrollbar {
          display: none;
        }
        * {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        *::-webkit-scrollbar {
          display: none;
        }
      `}</style>

      <div className="h-12 flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleHistory}
            className="text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800/80 h-8 px-2 transition-all duration-200 hover:scale-105"
          >
            <MessageSquare className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={createNewConversation}
            className="text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800/80 h-8 px-2 transition-all duration-200 hover:scale-105"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        <div></div>

        <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={`h-8 px-2 transition-all duration-200 hover:scale-105 ${
                !falKey
                  ? "animate-pulse bg-orange-500/20 text-orange-400 hover:text-orange-300 hover:bg-orange-500/30 border border-orange-500/30 shadow-lg shadow-orange-500/20"
                  : "text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800/80"
              }`}
            >
              <Settings className="w-4 h-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-zinc-950 border-neutral-200/20 text-zinc-50">
            <DialogHeader>
              <DialogTitle className="text-zinc-50">Settings</DialogTitle>
              <DialogDescription className="text-zinc-400">
                Configure your API settings and preferences.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="fal-key" className="text-sm text-zinc-300">
                  FAL API Key
                </Label>
                <Input
                  id="fal-key"
                  type="password"
                  placeholder="Enter your FAL API key"
                  value={tempFalKey}
                  onChange={(e) => setTempFalKey(e.target.value)}
                  className="mt-1 bg-zinc-950 border-neutral-200/20 text-zinc-50 placeholder-zinc-500 focus:border-zinc-500 focus:ring-0 transition-colors duration-200"
                />
                <p className="text-xs text-zinc-500 mt-1 mb-2">
                  Get your API key from{" "}
                  <a
                    href="https://fal.ai/dashboard/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 underline transition-colors duration-200"
                  >
                    fal.ai/dashboard/keys
                  </a>
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setSettingsDialogOpen(false)}
                  className="border-neutral-200/20 text-zinc-300 hover:bg-zinc-800 bg-zinc-950/80 hover:text-zinc-50 transition-all duration-200"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveFalKey}
                  className="bg-zinc-50 hover:bg-zinc-200 text-zinc-900 transition-all duration-200 hover:scale-105"
                >
                  Save
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {showHistory && (
        <>
          <div
            className={`fixed inset-0 bg-black/30 z-40 transition-all duration-300 ease-out ${
              isHistoryAnimating ? "opacity-100 backdrop-blur-sm" : "opacity-0"
            }`}
            onClick={toggleHistory}
          />
          <div
            className={`fixed top-12 left-0 w-80 h-[calc(100vh-3rem)] bg-zinc-950/95 backdrop-blur-xl border-t rounded-tr-lg border-r border-neutral-200/20 flex flex-col z-50 shadow-2xl transition-all duration-300 ease-out ${
              isHistoryAnimating ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            <div className="p-4 border-b bg-zinc-950/50 border-neutral-200/20 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-50">History</h2>
              <Button
                onClick={createNewConversation}
                className="w-fit text-zinc-50 hover:scale-105 transition-transform duration-200"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {conversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className={`p-3 rounded-lg cursor-pointer mb-2 group hover:bg-zinc-800/80 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg ${
                    currentConversationId === conversation.id ? "bg-zinc-800/60 ring-1 ring-neutral-200/20" : ""
                  }`}
                  onClick={() => loadConversation(conversation.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-zinc-50 truncate">{conversation.title}</h3>
                      <p className="text-xs text-zinc-400 mt-1">{conversation.messages.length} messages</p>
                      <p className="text-xs text-zinc-500">{new Date(conversation.updatedAt).toLocaleDateString()}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={deleteConversation.isPending}
                      className={`opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 hover:scale-110 ${
                        deleteConversation.isPending ? "cursor-not-allowed opacity-50" : ""
                      }`}
                      onClick={(e) => handleDeleteConversation(conversation.id, e)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="flex-1 flex">
        <div className="w-1/3 flex flex-col bg-black" style={{ minWidth: "400px" }}>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[calc(100vh-11rem)]">
            {localMessages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-zinc-500">
                  <Bot className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Start a conversation by uploading an image and describing your edit</p>
                </div>
              </div>
            ) : (
              localMessages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${message.type === "user" ? "justify-start" : "justify-start"} animate-in slide-in-from-bottom-2 duration-300`}
                >
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-zinc-800 mt-0">
                    {message.type === "user" ? (
                      <User className="w-4 h-4 text-zinc-300" />
                    ) : (
                      <Bot className="w-4 h-4 text-zinc-300" />
                    )}
                  </div>
                  <div className="max-w-[80%]">
                    <div className="rounded-lg px-3 pb-3  space-y-2 text-zinc-50">
                      {message.type === "assistant" && message.generatedImage && (
                        <div className="flex items-center gap-2 mb-2 pt-1">
                          {(() => {
                            const model = modelEndpoints.find((m) => m.label === message.generatedImage?.model)
                            return model ? (
                              <img
                                src={model.logo || "/placeholder.svg"}
                                alt={model.label}
                                className="w-4 h-4 flex-shrink-0"
                              />
                            ) : null
                          })()}
                          <span className="text-xs text-zinc-400 font-medium">{message.generatedImage.model}</span>
                        </div>
                      )}
                      <p className="text-sm">{message.content}</p>
                      {message.image && (
                        <img
                          src={message.image || "/placeholder.svg"}
                          alt="Uploaded"
                          className="w-auto h-9 rounded-lg border border-zinc-600 hover:border-zinc-500 transition-colors duration-200"
                        />
                      )}
                      {message.generatedImage && (
                        <div className="relative inline-block">
                          <img
                            src={message.generatedImage.url || "/placeholder.svg"}
                            alt="Generated"
                            className="w-auto h-9 rounded-lg border border-zinc-600 hover:border-zinc-500 transition-colors duration-200"
                          />
                          <div className="absolute -top-1 -right-1 bg-zinc-50 text-zinc-950 px-1.5 py-0.5 rounded-full text-xs font-bold min-w-[18px] h-[18px] flex items-center justify-center">
                            v{(() => {
                              const imageIndex = localGeneratedImages.findIndex(
                                (img) => img.id === message.generatedImage?.id,
                              )
                              return imageIndex >= 0 ? localGeneratedImages.length - 1 - imageIndex : 1
                            })()}
                          </div>
                        </div>
                      )}
                      <p className="text-xs text-zinc-500">{new Date(message.timestamp).toLocaleTimeString()}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
            {generateImageMutation.isPending && (
              <div className="flex gap-3 justify-start animate-in slide-in-from-bottom-2 duration-300">
                <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-zinc-300" />
                </div>
                <div className="flex-1 max-w-[80%]">
                  <div className="px-3 pb-3 pt-1.5">
                    <div className="flex items-center gap-2">
                      <img src="/logos/fal.svg" alt="Loading" className="w-4 h-4 animate-spin" />
                      <span className="text-sm text-zinc-300">Generating image...</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 border-t border-neutral-200/20 bg-zinc-800/20">
            <div className="flex gap-2">
              <Textarea
                placeholder="Describe how you want to edit the image..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={generateImageMutation.isPending}
                className="flex-1 min-h-[60px] resize-none bg-black border-neutral-200/20 text-zinc-50 placeholder-zinc-500 focus:border-zinc-500 focus:ring-0 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 focus:shadow-lg focus:shadow-zinc-800/50"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleGenerateImage()
                  }
                }}
              />
              <Button
                onClick={handleGenerateImage}
                disabled={
                  !falKey ||
                  !prompt ||
                  (!selectedImage && localGeneratedImages.length === 0) ||
                  generateImageMutation.isPending
                }
                size="lg"
                className="flex-shrink-0 bg-zinc-50 hover:bg-zinc-200 text-zinc-900 disabled:bg-zinc-800 disabled:text-zinc-500 transition-all duration-200 hover:scale-105 hover:shadow-lg disabled:hover:scale-100"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex gap-2 mt-2 relative">
              <div>
                <Select
                  value={selectedModel}
                  onValueChange={(value) => updateSettings.mutate({ selectedModel: value })}
                  disabled={generateImageMutation.isPending}
                >
                  <SelectTrigger className="w-fit h-8 bg-zinc-950/80 border-neutral-200/20 text-zinc-50 focus:border-zinc-500 focus:ring-0 text-xs whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-900/80 transition-colors duration-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-950/95 backdrop-blur-xl border-neutral-200/20">
                    {modelEndpoints.map((model) => (
                      <SelectItem
                        key={model.endpoint}
                        value={model.endpoint}
                        className="text-zinc-50 focus:bg-zinc-800 focus:text-zinc-50 text-xs whitespace-nowrap hover:bg-zinc-800/80 transition-colors duration-200"
                      >
                        <div className="flex items-center gap-2">
                          <img
                            src={model.logo || "/placeholder.svg"}
                            alt={model.label}
                            className="w-3 h-3 flex-shrink-0"
                          />
                          <span className="truncate">{model.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={generateImageMutation.isPending}
                  className="flex-shrink-0 h-9 px-3 border-neutral-200/20 text-zinc-400 hover:bg-zinc-800/80 bg-zinc-950/80 hover:text-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105 disabled:hover:scale-100"
                >
                  <Paperclip className="w-4 h-4" />
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                {(selectedImage || (localGeneratedImages.length > 0 && localGeneratedImages[0])) && (
                  <div className="relative">
                    <img
                      src={selectedImage || localGeneratedImages[0]?.url || "/placeholder.svg"}
                      alt="Attachment"
                      className="w-9 h-9 rounded-lg object-cover border border-neutral-200/20 hover:border-zinc-500 transition-colors duration-200"
                    />
                    <div className="absolute -top-1 -right-1 bg-zinc-50 text-zinc-950 px-1.5 py-0.5 rounded-full text-xs font-bold min-w-[18px] h-[18px] flex items-center justify-center">
                      v
                      {selectedVersion
                        ? localGeneratedImages.findIndex((img) => img.id === selectedVersion.id) >= 0
                          ? localGeneratedImages.length -
                            1 -
                            localGeneratedImages.findIndex((img) => img.id === selectedVersion.id)
                          : 0
                        : localGeneratedImages.length > 0
                          ? localGeneratedImages.length - 1
                          : 0}
                    </div>
                  </div>
                )}
              </div>

              <div className="absolute bottom-0 right-0 flex items-center gap-1 text-xs text-zinc-500">
                <span>Powered by</span>
                <a
                  href="https://fal.ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:opacity-100 transition-all duration-200 hover:scale-110"
                >
                  <img src="/logos/fal-logo.svg" alt="fal" className="h-3 opacity-70" />
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="w-2/3 flex flex-col relative overflow-hidden border-t border-l border-neutral-200/20 rounded-tl-lg bg-black backdrop-blur-sm">
          <div className="p-4 border-b border-neutral-200/20 bg-zinc-800/30 backdrop-blur-sm">
            <h2 className="text-lg font-semibold text-zinc-50">Preview</h2>
            <p className="text-sm text-zinc-400">
              {selectedVersion
                ? `Selected: v${localGeneratedImages.findIndex((img) => img.id === selectedVersion.id) >= 0 ? localGeneratedImages.length - 1 - localGeneratedImages.findIndex((img) => img.id === selectedVersion.id) : 0}`
                : localGeneratedImages.length > 0
                  ? `Latest: v${localGeneratedImages.length - 1}`
                  : "No images generated"}
            </p>
          </div>

          <div className="flex-1 relative p-6 flex items-center justify-center">
            {selectedImage || localGeneratedImages.length > 0 ? (
              <div className="relative group">
                <img
                  src={
                    hoveredVersion
                      ? localGeneratedImages.find((img) => img.id === hoveredVersion)?.url || "/placeholder.svg"
                      : (selectedVersion || localGeneratedImages[0])?.url || selectedImage || "/placeholder.svg"
                  }
                  alt="Preview image"
                  className="max-w-full max-h-[500px] object-contain rounded-lg shadow-2xl transition-all duration-300 group-hover:shadow-3xl"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const currentImage = hoveredVersion
                      ? localGeneratedImages.find((img) => img.id === hoveredVersion)
                      : selectedVersion || localGeneratedImages[0]

                    if (currentImage?.url || selectedImage) {
                      const link = document.createElement("a")
                      link.href = currentImage?.url || selectedImage || ""
                      const versionNumber = currentImage
                        ? localGeneratedImages.findIndex((img) => img.id === currentImage.id) >= 0
                          ? localGeneratedImages.length -
                            1 -
                            localGeneratedImages.findIndex((img) => img.id === currentImage.id)
                          : 0
                        : 0
                      link.download = `image-edit-v${versionNumber}-${Date.now()}.png`
                      document.body.appendChild(link)
                      link.click()
                      document.body.removeChild(link)
                    }
                  }}
                  className="absolute top-4 right-4 bg-zinc-950/90 hover:bg-zinc-800/90 text-zinc-50 border border-neutral-200/20 h-8 w-8 p-0 backdrop-blur-sm transition-all duration-200 hover:scale-110"
                >
                  <Download className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="text-center text-zinc-500">
                <Eye className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>Generated images will appear here</p>
                <p className="text-sm mt-2">Start by uploading an image and describing your edit</p>
              </div>
            )}

            {(selectedImage || localGeneratedImages.length > 0) && (
              <div className="absolute top-0 right-0 bg-zinc-950/95 backdrop-blur-xl border-l border-neutral-200/20 p-2 h-full">
                <div className="flex flex-col gap-1">
                  {localGeneratedImages.map((image, index) => {
                    const versionNumber = localGeneratedImages.length - 1 - index
                    const isSelected = selectedVersion?.id === image.id
                    const isOriginalHighlighted =
                      !selectedVersion && versionNumber === 0 && localGeneratedImages.length === 1
                    const shouldHighlight = isSelected || isOriginalHighlighted

                    return (
                      <div
                        key={image.id}
                        className="relative"
                        onMouseEnter={() => setHoveredVersion(image.id)}
                        onMouseLeave={() => setHoveredVersion(null)}
                      >
                        <div
                          className={
                            "w-12 h-12 relative cursor-pointer hover:scale-110 transition-all duration-200 hover:shadow-lg"
                          }
                          onClick={() => {
                            setSelectedVersion(image)
                            setSelectedImage(image.url)
                          }}
                        >
                          <img
                            src={image.url || "/placeholder.svg"}
                            alt={`Version ${versionNumber}`}
                            className={`w-full h-full object-cover rounded-lg border-2 transition-all duration-200 ${
                              shouldHighlight
                                ? "border-white shadow-lg shadow-white/20"
                                : "border-neutral-200/20 hover:border-zinc-500"
                            }`}
                          />
                          <div
                            className={`absolute -top-1 -right-1 px-1 py-0.5 rounded text-xs font-medium border transition-all duration-200 ${
                              shouldHighlight
                                ? "bg-zinc-50 text-zinc-950 border-zinc-50 shadow-lg"
                                : "bg-zinc-950/90 text-zinc-50 border-neutral-200/20 backdrop-blur-sm"
                            }`}
                          >
                            v{versionNumber}
                          </div>
                        </div>

                        {hoveredVersion === image.id && (
                          <div className="absolute top-0 right-full mr-2 z-50 bg-zinc-950/95 backdrop-blur-xl border border-neutral-200/20 rounded-lg p-3 w-64 shadow-2xl animate-in slide-in-from-right-2 duration-200">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-zinc-50 font-medium text-sm">Version {versionNumber}</span>
                                <span className="text-zinc-400 text-xs">
                                  {new Date(image.timestamp).toLocaleString()}
                                </span>
                              </div>
                              <p className="text-zinc-300 text-sm">{image.prompt}</p>
                              {image.model && (
                                <div className="flex items-center gap-2">
                                  {(() => {
                                    const model = modelEndpoints.find((m) => m.label === image.model)
                                    return model ? (
                                      <img
                                        src={model.logo || "/placeholder.svg"}
                                        alt={model.label}
                                        className="w-4 h-4 flex-shrink-0"
                                      />
                                    ) : null
                                  })()}
                                  <div className="flex items-center gap-1">
                                    <span className="text-zinc-400 text-xs">Model:</span>
                                    <span className="text-zinc-300 text-xs font-medium">{image.model}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
