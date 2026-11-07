import { useCallback, useEffect, useRef, useState } from "react";
import { getSocket, connectSocket } from "../services/socket";
import { chatService } from "../services/chatService";
import "../styles/chat.css";

interface User {
  id: string;
  username: string;
  displayName: string;
  avatarColor: string;
}

interface Message {
  _id: string;
  type: "private" | "global";
  text: string;
  sender: any;
  createdAt: string;
  readAt?: string | null;
}

type ChatMode = "global" | "private";

export default function Chat() {
  const [me, setMe] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [mode, setMode] = useState<ChatMode>("global");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [typing, setTyping] = useState("");
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<number | undefined>(undefined);

  const currentUserId = me?.id;

  const loadMessages = useCallback(async () => {
    try {
      const data =
        mode === "global"
          ? await chatService.getGlobalMessages()
          : selectedUser
            ? await chatService.getPrivateMessages(selectedUser.id)
            : { messages: [] };

      setMessages(data.messages || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load messages");
    } finally {
      setLoading(false);
    }
  }, [mode, selectedUser]);

  const loadUsers = useCallback(async () => {
    try {
      const data = await chatService.getUsers(search);
      setUsers(data.users || []);
    } catch (err) {
      console.error(err);
    }
  }, [search]);

  useEffect(() => {
    Promise.all([
      chatService.getMe(),
      chatService.getUsers(),
    ])
      .then(([meData, usersData]) => {
        setMe(meData.user);
        setUsers(usersData.users || []);
      })
      .catch(err => {
        setError(err.message || "Please login first.");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(loadUsers, 300);
    return () => window.clearTimeout(timer);
  }, [loadUsers]);

  useEffect(() => {
    const socket = connectSocket();

    const receiveMessage = (message: Message) => {
      const senderId =
        typeof message.sender === "string"
          ? message.sender
          : message.sender?._id;

      const relevant =
        message.type === "global"
          ? mode === "global"
          : mode === "private" &&
            selectedUser &&
            (
              senderId === selectedUser.id ||
              senderId === currentUserId
            );

      if (relevant) {
        setMessages(previous => {
          if (previous.some(item => item._id === message._id)) {
            return previous;
          }

          return [...previous, message];
        });
      }

      if (
        message.type === "private" &&
        senderId !== currentUserId &&
        mode === "private" &&
        selectedUser?.id === senderId
      ) {
        socket.emit("chat:read", {
          senderId,
        });
      }
    };

    const onTyping = (data: any) => {
      const relevant =
        data.type === "global"
          ? mode === "global"
          : mode === "private" &&
            selectedUser?.id === data.userId;

      if (relevant) {
        setTyping(`${data.username} is typing...`);
      }
    };

    const stopTyping = () => setTyping("");

    const presence = (data: any) => {
      setOnlineUsers(previous => {
        if (data.online) {
          return [...new Set([...previous, data.userId])];
        }

        return previous.filter(id => id !== data.userId);
      });
    };

    socket.on("chat:message", receiveMessage);
    socket.on("chat:typing", onTyping);
    socket.on("chat:stop-typing", stopTyping);
    socket.on("presence:update", presence);

    return () => {
      socket.off("chat:message", receiveMessage);
      socket.off("chat:typing", onTyping);
      socket.off("chat:stop-typing", stopTyping);
      socket.off("presence:update", presence);
    };
  }, [mode, selectedUser, currentUserId]);

  useEffect(() => {
    setLoading(true);
    setMessages([]);
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  const openPrivateChat = (user: User) => {
    setSelectedUser(user);
    setMode("private");
    setTyping("");
  };

  const openGlobalChat = () => {
    setSelectedUser(null);
    setMode("global");
    setTyping("");
  };

  const sendMessage = () => {
    const text = input.trim();

    if (!text || sending) return;

    const socket = getSocket();

    if (!socket.connected) {
      setError("Chat connection unavailable. Please retry.");
      return;
    }

    setSending(true);
    setError("");

    socket.emit(
      "chat:send",
      {
        type: mode,
        recipientId: selectedUser?.id,
        text,
      },
      (response: any) => {
        setSending(false);

        if (!response?.success) {
          setError(response?.error || "Message could not be sent.");
          return;
        }

        setInput("");
        socket.emit("chat:stop-typing", {
          type: mode,
          recipientId: selectedUser?.id,
        });
      }
    );
  };

  const handleTyping = (value: string) => {
    setInput(value);

    const socket = getSocket();

    if (mode === "private" && !selectedUser) return;

    socket.emit("chat:typing", {
      type: mode,
      recipientId: selectedUser?.id,
    });

    window.clearTimeout(typingTimer.current);

    typingTimer.current = window.setTimeout(() => {
      socket.emit("chat:stop-typing", {
        type: mode,
        recipientId: selectedUser?.id,
      });
    }, 1500);
  };

  const isOwnMessage = (message: Message) => {
    const senderId =
      typeof message.sender === "string"
        ? message.sender
        : message.sender?._id;

    return senderId === currentUserId;
  };

  const formatTime = (date: string) =>
    new Date(date).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="chat-page">
      <aside className="chat-sidebar">
        <div className="chat-brand">
          <div>
            <h2>Messages</h2>
            <p>Connect with your community</p>
          </div>
          <span className="chat-brand-icon">✦</span>
        </div>

        <div className="chat-search">
          <span>⌕</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search people..."
          />
        </div>

        <button
          className={`chat-list-item global-item ${
            mode === "global" ? "active" : ""
          }`}
          onClick={openGlobalChat}
        >
          <div className="global-avatar">🌍</div>
          <div className="chat-list-info">
            <strong>Global Community</strong>
            <span>Chat with everyone</span>
          </div>
          <span className="online-indicator" />
        </button>

        <div className="chat-list-heading">
          <span>PEOPLE</span>
          <span>{users.length}</span>
        </div>

        <div className="chat-user-list">
          {users.map(user => (
            <button
              key={user.id}
              className={`chat-list-item ${
                selectedUser?.id === user.id ? "active" : ""
              }`}
              onClick={() => openPrivateChat(user)}
            >
              <div
                className="chat-avatar"
                style={{ background: user.avatarColor }}
              >
                {user.displayName.charAt(0).toUpperCase()}
                {onlineUsers.includes(user.id) && (
                  <span className="avatar-online" />
                )}
              </div>

              <div className="chat-list-info">
                <strong>{user.displayName}</strong>
                <span>@{user.username}</span>
              </div>
            </button>
          ))}

          {users.length === 0 && (
            <p className="chat-empty-small">No users found.</p>
          )}
        </div>

        <div className="chat-profile">
          <div
            className="chat-avatar"
            style={{ background: me?.avatarColor || "#6366f1" }}
          >
            {me?.displayName?.charAt(0).toUpperCase() || "U"}
          </div>

          <div className="chat-list-info">
            <strong>{me?.displayName || "My Account"}</strong>
            <span>My account</span>
          </div>
        </div>
      </aside>

      <section className="chat-main">
        <header className="chat-header">
          <div className="chat-header-user">
            <div className="header-avatar">
              {mode === "global"
                ? "🌍"
                : selectedUser?.displayName?.charAt(0).toUpperCase()}
            </div>

            <div>
              <h3>
                {mode === "global"
                  ? "Global Community"
                  : selectedUser?.displayName}
              </h3>

              <span>
                {mode === "global"
                  ? "Everyone can participate"
                  : selectedUser
                    ? `@${selectedUser.username}`
                    : ""}
              </span>
            </div>
          </div>

          <div className="chat-header-status">
            <span className="online-indicator" />
            {mode === "global"
              ? "Community"
              : selectedUser && onlineUsers.includes(selectedUser.id)
                ? "Online"
                : "Offline"}
          </div>
        </header>

        <div className="chat-messages">
          {loading ? (
            <div className="chat-placeholder">
              Loading messages...
            </div>
          ) : (
            <>
              <div className="chat-welcome">
                <div className="welcome-icon">
                  {mode === "global" ? "🌍" : "💬"}
                </div>

                <h2>
                  {mode === "global"
                    ? "Welcome to Global Chat"
                    : `Chat with ${selectedUser?.displayName}`}
                </h2>

                <p>
                  {mode === "global"
                    ? "Meet people and share your thoughts with the community."
                    : "Your private conversation starts here."}
                </p>
              </div>

              {messages.map(message => {
                const own = isOwnMessage(message);

                const sender =
                  typeof message.sender === "string"
                    ? null
                    : message.sender;

                return (
                  <div
                    key={message._id}
                    className={`message-row ${
                      own ? "own-message" : ""
                    }`}
                  >
                    <div className="message-content">
                      {!own && mode === "global" && (
                        <span className="message-sender">
                          {sender?.displayName || "User"}
                        </span>
                      )}

                      <div className="message-bubble">
                        {message.text}
                      </div>

                      <div className="message-meta">
                        {formatTime(message.createdAt)}
                        {own && message.readAt && (
                          <span className="read-receipt">✓✓</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {typing && (
                <div className="typing-indicator">
                  {typing}
                </div>
              )}

              <div ref={bottomRef} />
            </>
          )}
        </div>

        {error && (
          <div className="chat-error">{error}</div>
        )}

        <form
          className="chat-composer"
          onSubmit={e => {
            e.preventDefault();
            sendMessage();
          }}
        >
          <input
            value={input}
            onChange={e => handleTyping(e.target.value)}
            placeholder="Write your message..."
            maxLength={2000}
          />

          <span className="character-count">
            {input.length}/2000
          </span>

          <button
            type="submit"
            disabled={!input.trim() || sending}
          >
            {sending ? "..." : "➤"}
          </button>
        </form>
      </section>
    </div>
  );
}