import React, { useState } from "react";
import {
  Plus,
  MessageSquare,
  Trash2,
  Edit2,
  Check,
  X,
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import type { ChatSession } from "../../types/ai";

interface SessionSidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  isLoading: boolean;
  onSelectSession: (sessionId: string) => void;
  onNewChat: () => void;
  onRenameSession: (sessionId: string, newTitle: string) => Promise<void>;
  onDeleteSession: (sessionId: string) => Promise<void>;
  isOpen: boolean;
  onToggleOpen: () => void;
}

export const SessionSidebar: React.FC<SessionSidebarProps> = ({
  sessions,
  activeSessionId,
  isLoading,
  onSelectSession,
  onNewChat,
  onRenameSession,
  onDeleteSession,
  isOpen,
  onToggleOpen,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [isSubmittingRename, setIsSubmittingRename] = useState(false);

  // Deletion modal state
  const [sessionToDelete, setSessionToDelete] = useState<ChatSession | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const filteredSessions = sessions.filter((s) => {
    const title = s.title || "New Conversation";
    return title.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleStartRename = (session: ChatSession, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSessionId(session.id);
    setEditTitle(session.title || "New Conversation");
  };

  const handleCancelRename = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingSessionId(null);
    setEditTitle("");
  };

  const handleSaveRename = async (sessionId: string, e?: React.FormEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    const trimmed = editTitle.trim();
    if (!trimmed) {
      handleCancelRename();
      return;
    }

    try {
      setIsSubmittingRename(true);
      await onRenameSession(sessionId, trimmed);
      setEditingSessionId(null);
    } catch {
      // Error is handled in page via toast
    } finally {
      setIsSubmittingRename(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!sessionToDelete) return;
    try {
      setIsDeleting(true);
      await onDeleteSession(sessionToDelete.id);
      setSessionToDelete(null);
    } catch {
      // Error handled via toast
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
    } catch {
      return "";
    }
  };

  if (!isOpen) {
    return (
      <div className="hidden sm:flex flex-col items-center py-3 px-2 border-r border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onToggleOpen}
          className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          title="Open session sidebar"
        >
          <ChevronRight className="w-5 h-5" />
        </Button>
        <div className="mt-4">
          <Button
            type="button"
            variant="default"
            size="icon"
            onClick={onNewChat}
            className="w-10 h-10 rounded-xl shadow-xs"
            title="New Chat"
          >
            <Plus className="w-5 h-5" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <aside
        className="w-72 sm:w-80 border-r border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 flex flex-col h-full shrink-0 select-none z-20"
        aria-label="Chat Sessions Sidebar"
      >
        {/* Top Header with New Chat & Collapse */}
        <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Conversations
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onToggleOpen}
              className="h-7 w-7 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              title="Collapse sidebar"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
          </div>

          <Button
            type="button"
            onClick={onNewChat}
            className="w-full justify-start gap-2 h-10 bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs font-medium"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>New Chat</span>
          </Button>

          {/* Search bar */}
          {sessions.length > 3 && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search chats..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {isLoading && sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin mb-2 text-indigo-500" />
              <p className="text-xs">Loading sessions...</p>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400 dark:text-slate-500">
              {searchQuery ? "No matching chats found." : "No previous conversations."}
            </div>
          ) : (
            filteredSessions.map((session) => {
              const isActive = session.id === activeSessionId;
              const isEditing = editingSessionId === session.id;

              return (
                <div
                  key={session.id}
                  onClick={() => !isEditing && onSelectSession(session.id)}
                  className={`group relative flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-xs transition-colors cursor-pointer ${
                    isActive
                      ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-200 font-medium border border-indigo-200/80 dark:border-indigo-800/60 shadow-xs"
                      : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60"
                  }`}
                >
                  {isEditing ? (
                    <form
                      onSubmit={(e) => handleSaveRename(session.id, e)}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 w-full"
                    >
                      <input
                        type="text"
                        autoFocus
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") handleCancelRename();
                        }}
                        className="flex-1 px-2 py-1 text-xs rounded border border-indigo-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={isSubmittingRename}
                        className="p-1 text-emerald-600 hover:text-emerald-700 disabled:opacity-50"
                        title="Save"
                      >
                        {isSubmittingRename ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelRename}
                        className="p-1 text-slate-400 hover:text-slate-600"
                        title="Cancel"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  ) : (
                    <>
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <MessageSquare
                          className={`w-4 h-4 shrink-0 ${
                            isActive
                              ? "text-indigo-600 dark:text-indigo-400"
                              : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300"
                          }`}
                        />
                        <div className="truncate flex-1">
                          <p className="truncate leading-tight">
                            {session.title || "New Conversation"}
                          </p>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">
                            {formatDate(session.createdAt)}
                          </span>
                        </div>
                      </div>

                      {/* Action buttons (Rename, Delete) */}
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={(e) => handleStartRename(session, e)}
                          className="p-1 rounded text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors"
                          title="Rename chat"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSessionToDelete(session);
                          }}
                          className="p-1 rounded text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors"
                          title="Delete chat"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-400 dark:text-slate-500 text-center">
          {sessions.length} {sessions.length === 1 ? "chat session" : "chat sessions"}
        </div>
      </aside>

      {/* Confirmation Dialog for Session Deletion */}
      <ConfirmDialog
        isOpen={Boolean(sessionToDelete)}
        title="Delete Conversation"
        description={`Are you sure you want to delete "${sessionToDelete?.title || "this chat"}"? All messages and citation history within this session will be permanently deleted.`}
        confirmLabel="Delete Session"
        variant="destructive"
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setSessionToDelete(null)}
      />
    </>
  );
};
