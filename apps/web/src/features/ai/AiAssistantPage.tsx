import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Bot,
  PanelRightClose,
  PanelRightOpen,
  Sidebar as SidebarIcon,
  Sparkles,
} from "lucide-react";
import { SessionSidebar } from "./SessionSidebar";
import { ChatMessageItem } from "./ChatMessageItem";
import { ChatInputArea } from "./ChatInputArea";
import { CitationsPanel } from "./CitationsPanel";
import { CitationModal } from "./CitationModal";
import { EmptyChatState } from "./EmptyChatState";
import { aiApi } from "./api";
import { documentsApi } from "../documents/api";
import { toast } from "../../components/ui/toast";
import { BackButton } from "../../components/ui/BackButton";
import type { ChatSession, ChatMessage, Citation, DoneEvent } from "../../types/ai";
import type { DocumentItem } from "../../types/documents";

export const AiAssistantPage: React.FC = () => {
  // Sessions state
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  // Chat messages and input
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Citations panel & modal state
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
  const [activeMessageCitations, setActiveMessageCitations] = useState<Citation[]>([]);
  const [isCitationsPanelOpen, setIsCitationsPanelOpen] = useState(false);
  const [isCitationModalOpen, setIsCitationModalOpen] = useState(false);

  // Real READY documents state for starter chips
  const [readyDocs, setReadyDocs] = useState<DocumentItem[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);

  // Layout sidebar visibility
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Streaming & scrolling references
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamingTextRef = useRef("");
  const batchedTokensRef = useRef("");
  const flushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatScrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isUserAtBottomRef = useRef(true);

  // Auto-scroll logic (scroll only if user is at the bottom)
  const handleScroll = useCallback(() => {
    const el = chatScrollContainerRef.current;
    if (!el) return;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isUserAtBottomRef.current = distanceToBottom <= 80;
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    if (isUserAtBottomRef.current && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior, block: "end" });
    }
  }, []);

  // Fetch all chat sessions on mount
  const loadSessions = useCallback(async () => {
    try {
      setIsLoadingSessions(true);
      const data = await aiApi.getSessions();
      setSessions(data);
    } catch (err: unknown) {
      toast.error((err as Error)?.message || "Failed to load chat history");
    } finally {
      setIsLoadingSessions(false);
    }
  }, []);

  // Fetch real READY documents (max 4) for starter chips
  const loadReadyDocs = useCallback(async () => {
    try {
      setIsLoadingDocs(true);
      const res = await documentsApi.getDocuments({ status: "READY", limit: 4 });
      setReadyDocs(res?.documents || []);
    } catch {
      setReadyDocs([]);
    } finally {
      setIsLoadingDocs(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
    loadReadyDocs();
  }, [loadSessions, loadReadyDocs]);

  // Load messages when active session changes
  const loadSessionMessages = useCallback(async (sessionId: string) => {
    try {
      setIsLoadingMessages(true);
      setErrorMessage(null);
      const session = await aiApi.getSessionById(sessionId);
      if (session && session.messages) {
        setMessages(session.messages);
      } else {
        setMessages([]);
      }
      // Force scroll to bottom on initial load
      isUserAtBottomRef.current = true;
      setTimeout(() => scrollToBottom("auto"), 50);
    } catch (err: unknown) {
      toast.error((err as Error)?.message || "Failed to load conversation messages");
      setMessages([]);
    } finally {
      setIsLoadingMessages(false);
    }
  }, [scrollToBottom]);

  const handleSelectSession = (sessionId: string) => {
    if (isStreaming) {
      handleStopStreaming();
    }
    setActiveSessionId(sessionId);
    loadSessionMessages(sessionId);
    setSelectedCitation(null);
  };

  const handleNewChat = () => {
    if (isStreaming) {
      handleStopStreaming();
    }
    setActiveSessionId(null);
    setMessages([]);
    setSelectedCitation(null);
    setIsCitationsPanelOpen(false);
    setErrorMessage(null);
  };

  const handleRenameSession = async (sessionId: string, newTitle: string) => {
    try {
      const updated = await aiApi.renameSession(sessionId, newTitle);
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, title: updated.title } : s))
      );
      toast.success("Conversation renamed");
    } catch (err: unknown) {
      toast.error((err as Error)?.message || "Failed to rename session");
      throw err;
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await aiApi.deleteSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        handleNewChat();
      }
      toast.success("Conversation deleted");
    } catch (err: unknown) {
      toast.error((err as Error)?.message || "Failed to delete session");
      throw err;
    }
  };

  const handleStopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current);
      flushTimeoutRef.current = null;
    }

    setIsStreaming(false);

    // Finalize assistant message with whatever was streamed so far
    setMessages((prev) =>
      prev.map((msg) =>
        msg.isStreaming ? { ...msg, isStreaming: false } : msg
      )
    );
  };

  // Submit thumbs up or thumbs down feedback
  const handleFeedback = async (messageId: string, value: 1 | -1) => {
    try {
      await aiApi.submitFeedback(messageId, { feedback: value });
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === messageId) {
            const current = msg.feedback;
            return {
              ...msg,
              feedback: current === value ? null : value,
            };
          }
          return msg;
        })
      );
      toast.success(
        value === 1
          ? "Thank you! Feedback recorded."
          : "Thank you for the feedback. We will work to improve."
      );
    } catch (err: unknown) {
      toast.error((err as Error)?.message || "Failed to submit feedback");
    }
  };

  // Open citation in Citation Modal
  const handleSelectCitation = (citation: Citation) => {
    setSelectedCitation(citation);
    setIsCitationModalOpen(true);
  };

  // Regenerate response for an assistant message
  const handleRegenerate = (assistantMessageId: string) => {
    if (isStreaming) return;

    // Find the assistant message index
    const assistantIndex = messages.findIndex((m) => m.id === assistantMessageId);
    if (assistantIndex === -1) return;

    // Find the preceding user message
    let precedingUserPrompt = "";
    for (let i = assistantIndex - 1; i >= 0; i--) {
      if (messages[i].role === "user" || messages[i].role === "USER") {
        precedingUserPrompt = messages[i].content;
        break;
      }
    }

    if (precedingUserPrompt) {
      handleSendMessage(precedingUserPrompt);
    }
  };

  // Send message and stream answer
  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || isStreaming) return;

    setInput("");
    setErrorMessage(null);

    const userMessageId = `user-${Date.now()}`;
    const userMessage: ChatMessage = {
      id: userMessageId,
      role: "user",
      content: query,
      createdAt: new Date().toISOString(),
    };

    const tempAssistantId = `assistant-temp-${Date.now()}`;
    const initialAssistantMessage: ChatMessage = {
      id: tempAssistantId,
      role: "assistant",
      content: "",
      citations: [],
      isStreaming: true,
      createdAt: new Date().toISOString(),
    };

    // Append both to chat
    setMessages((prev) => [...prev, userMessage, initialAssistantMessage]);

    // Reset streaming references
    streamingTextRef.current = "";
    batchedTokensRef.current = "";
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    setIsStreaming(true);

    // Ensure we start scrolled to bottom
    isUserAtBottomRef.current = true;
    setTimeout(() => scrollToBottom("smooth"), 20);

    const flushBatchedTokens = () => {
      if (!batchedTokensRef.current) return;
      batchedTokensRef.current = "";
      const currentFullText = streamingTextRef.current;

      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempAssistantId ? { ...m, content: currentFullText } : m
        )
      );

      scrollToBottom("smooth");
    };

    try {
      await aiApi.streamChat(
        {
          message: query,
          sessionId: activeSessionId || undefined,
          signal: abortController.signal,
        },
        {
          onToken: (token: string) => {
            streamingTextRef.current += token;
            batchedTokensRef.current += token;

            // Batch token updates every 35ms to avoid re-rendering entire chat tree on every single token
            if (!flushTimeoutRef.current) {
              flushTimeoutRef.current = setTimeout(() => {
                flushTimeoutRef.current = null;
                flushBatchedTokens();
              }, 35);
            }
          },

          onCitations: (citations: Citation[]) => {
            setActiveMessageCitations(citations);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === tempAssistantId ? { ...m, citations } : m
              )
            );
          },

          onDone: (doneData: DoneEvent) => {
            if (flushTimeoutRef.current) {
              clearTimeout(flushTimeoutRef.current);
              flushTimeoutRef.current = null;
            }

            const finalContent = doneData.content || streamingTextRef.current;
            const finalCitations = doneData.citations || [];
            setActiveMessageCitations(finalCitations);

            setMessages((prev) =>
              prev.map((m) =>
                m.id === tempAssistantId
                  ? {
                      ...m,
                      id: doneData.messageId,
                      content: finalContent,
                      citations: finalCitations,
                      tokensUsed: doneData.tokensUsed,
                      latencyMs: doneData.latencyMs,
                      notFound: doneData.notFound,
                      isStreaming: false,
                    }
                  : m
              )
            );

            // If new session was created by backend, set active session and reload sessions list
            if (!activeSessionId && doneData.sessionId) {
              setActiveSessionId(doneData.sessionId);
              loadSessions();
            }

            setIsStreaming(false);
            abortControllerRef.current = null;
            scrollToBottom("smooth");
          },

          onError: (errMessage: string) => {
            if (flushTimeoutRef.current) {
              clearTimeout(flushTimeoutRef.current);
              flushTimeoutRef.current = null;
            }

            setErrorMessage(errMessage);
            setIsStreaming(false);
            abortControllerRef.current = null;

            // If assistant message has some content, finalize it; otherwise remove placeholder
            setMessages((prev) => {
              const currentAssistant = prev.find((m) => m.id === tempAssistantId);
              if (currentAssistant && currentAssistant.content.trim()) {
                return prev.map((m) =>
                  m.id === tempAssistantId ? { ...m, isStreaming: false } : m
                );
              }
              return prev.filter((m) => m.id !== tempAssistantId);
            });
          },
        }
      );
    } catch (err: unknown) {
      if ((err as Error)?.name !== "AbortError") {
        setErrorMessage((err as Error)?.message || "Failed to communicate with AI Assistant");
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    }
  };

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full overflow-hidden bg-slate-100 dark:bg-slate-950">
      {/* Session Sidebar (New Chat, Rename, Delete) */}
      <SessionSidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        isLoading={isLoadingSessions}
        onSelectSession={handleSelectSession}
        onNewChat={handleNewChat}
        onRenameSession={handleRenameSession}
        onDeleteSession={handleDeleteSession}
        isOpen={isSidebarOpen}
        onToggleOpen={() => setIsSidebarOpen((prev) => !prev)}
      />

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col h-full min-w-0 bg-white dark:bg-slate-900 overflow-hidden relative">
        {/* Chat Area Top Bar */}
        <header className="h-14 px-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xs z-10">
          <div className="flex items-center gap-3 min-w-0">
            <BackButton />

            {!isSidebarOpen && (
              <button
                type="button"
                onClick={() => setIsSidebarOpen(true)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Open conversations sidebar"
              >
                <SidebarIcon className="w-5 h-5" />
              </button>
            )}

            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {activeSession?.title || "New Conversation"}
                </h1>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-emerald-500" />
                  RAG Grounded Intelligence
                </p>
              </div>
            </div>
          </div>

          {/* Right Toolbar Controls */}
          <div className="flex items-center gap-2">
            {selectedCitation && !isCitationModalOpen && (
              <button
                type="button"
                onClick={() => setIsCitationModalOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-colors cursor-pointer"
                title="View document citation"
              >
                <PanelRightOpen className="w-4 h-4" />
                <span className="hidden sm:inline">View Citation</span>
              </button>
            )}

            {isCitationsPanelOpen && (
              <button
                type="button"
                onClick={() => setIsCitationsPanelOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Close citations panel"
              >
                <PanelRightClose className="w-4 h-4" />
              </button>
            )}
          </div>
        </header>

        {/* Messages Scroll Area */}
        <div
          ref={chatScrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-2 sm:p-4 md:p-6 space-y-4"
        >
          {isLoadingMessages ? (
            <div className="flex items-center justify-center h-full text-slate-400 gap-2">
              <Bot className="w-5 h-5 animate-spin text-indigo-500" />
              <span className="text-sm">Loading conversation...</span>
            </div>
          ) : messages.length === 0 ? (
            <EmptyChatState
              readyDocs={readyDocs}
              isLoadingDocs={isLoadingDocs}
              onSelectSuggestion={(q) => handleSendMessage(q)}
            />
          ) : (
            <div className="max-w-4xl mx-auto space-y-3">
              {messages.map((message) => (
                <ChatMessageItem
                  key={message.id}
                  message={message}
                  isStreamingActive={isStreaming}
                  onSelectCitation={handleSelectCitation}
                  onFeedback={handleFeedback}
                  onRegenerate={handleRegenerate}
                />
              ))}
              <div ref={messagesEndRef} className="h-2" />
            </div>
          )}
        </div>

        {/* Chat Input Area with Stop Button and Rate Limit Notification */}
        <ChatInputArea
          input={input}
          setInput={setInput}
          onSend={() => handleSendMessage()}
          onStop={handleStopStreaming}
          isStreaming={isStreaming}
          disabled={isLoadingMessages}
          errorMessage={errorMessage}
          onClearError={() => setErrorMessage(null)}
          starterDocs={readyDocs}
          isLoadingDocs={isLoadingDocs}
          onSelectPrompt={(prompt) => handleSendMessage(prompt)}
        />
      </main>

      {/* Citation Modal */}
      <CitationModal
        isOpen={isCitationModalOpen}
        citation={selectedCitation}
        allCitations={activeMessageCitations}
        onSelectCitation={(c) => setSelectedCitation(c)}
        onClose={() => setIsCitationModalOpen(false)}
      />

      {/* Citations Side Panel (optional expanded view) */}
      <CitationsPanel
        isOpen={isCitationsPanelOpen}
        citation={selectedCitation}
        allCitations={activeMessageCitations}
        onSelectCitation={(c) => setSelectedCitation(c)}
        onClose={() => setIsCitationsPanelOpen(false)}
      />
    </div>
  );
};

export default AiAssistantPage;
