"use client"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { Bot, CircleDashed, History, MoreHorizontal, Rocket } from "lucide-react"
import { AgentStatusCard } from "@/components/agent-status-card"
import type { ChatMessage } from "@/components/chat-message"

type Conversation = {
  id: string
  title: string
  preview: string
  messages: ChatMessage[]
}

export function AppSidebar({
  status = "Idle",
  conversations = [],
  activeId,
  onSelectConversation,
}: {
  status?: "Idle" | "Listening" | "Thinking" | "Executing"
  conversations?: Conversation[]
  activeId?: string
  onSelectConversation?: (id: string) => void
}) {
  return (
    <Sidebar
      variant="sidebar"
      collapsible="icon"
      className="border-r border-white/10 bg-[rgba(255,255,255,0.03)] text-white z-50"
    >
      <SidebarHeader>
        <div className="flex items-center gap-2 rounded-lg p-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-md"
            style={{
              background: "linear-gradient(135deg, rgba(0,191,255,0.2), rgba(255,0,255,0.2))",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <Bot className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-medium text-white/90">Assistant</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-white/60">Agent Status</SidebarGroupLabel>
          <SidebarGroupContent>
            <AgentStatusCard status={status} />
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-2 text-white/60">
            <History className="h-4 w-4" />
            Past Conversations
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <ScrollArea className="h-[40vh] pr-2">
              <SidebarMenu>
                {conversations.map((c) => (
                  <SidebarMenuItem key={c.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={c.id === activeId}
                      className={cn("data-[active=true]:text-white hover:scale-[1.01] transition")}
                      style={
                        c.id === activeId
                          ? {
                              background:
                                "linear-gradient(135deg, rgba(var(--accent-1),0.12), rgba(var(--accent-2),0.08))",
                            }
                          : {}
                      }
                    >
                      <button onClick={() => onSelectConversation?.(c.id)}>
                        <div
                          className="flex h-8 w-8 items-center justify-center rounded-md ring-1 ring-white/10"
                          style={{
                            background:
                              "linear-gradient(135deg, rgba(var(--accent-1),0.08), rgba(var(--accent-2),0.06))",
                          }}
                        >
                          <CircleDashed className="h-4 w-4 text-white/70" />
                        </div>
                        <span className="truncate">
                          {c.title}
                          <span className="ml-1 text-xs text-white/40">· {c.preview}</span>
                        </span>
                        <MoreHorizontal className="ml-auto" />
                      </button>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </ScrollArea>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center gap-2 rounded-md p-2 text-xs text-white/50">
          <Rocket className="h-4 w-4" />
          <span>v0 UI Core</span>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
