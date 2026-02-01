import { useEffect, useMemo, useState } from 'react'

import { api, getUsername, setUsername } from './api'

function Button({ children, variant = 'primary', ...props }) {
  const cls =
    variant === 'ghost'
      ? 'px-3 py-1.5 rounded-md text-sm border border-slate-300 hover:bg-slate-100'
      : variant === 'danger'
        ? 'px-3 py-1.5 rounded-md text-sm bg-rose-600 text-white hover:bg-rose-700'
        : 'px-3 py-1.5 rounded-md text-sm bg-slate-900 text-white hover:bg-slate-800'

  return (
    <button className={cls} {...props}>
      {children}
    </button>
  )
}

function Textarea({ className = '', ...props }) {
  return (
    <textarea
      className={`w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400 ${className}`}
      {...props}
    />
  )
}

function Input({ className = '', ...props }) {
  return (
    <input
      className={`w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400 ${className}`}
      {...props}
    />
  )
}

function formatTs(ts) {
  try {
    return new Date(ts).toLocaleString()
  } catch {
    return String(ts)
  }
}

function updateCommentTree(list, targetId, updater) {
  return list.map((c) => {
    if (c.id === targetId) {
      return updater(c)
    }
    if (c.children?.length) {
      return { ...c, children: updateCommentTree(c.children, targetId, updater) }
    }
    return c
  })
}

function insertReply(list, parentId, newComment) {
  if (parentId == null) return [newComment, ...list]

  return list.map((c) => {
    if (c.id === parentId) {
      return { ...c, children: [...(c.children ?? []), newComment] }
    }
    if (c.children?.length) {
      return { ...c, children: insertReply(c.children, parentId, newComment) }
    }
    return c
  })
}

function Leaderboard({ rows, loading }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-900">Leaderboard (24h)</div>
        <div className="text-xs text-slate-500">Top 5</div>
      </div>
      <div className="mt-3 space-y-2">
        {loading ? (
          <div className="text-sm text-slate-500">Loading...</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-slate-500">No karma yet.</div>
        ) : (
          rows.map((r, idx) => (
            <div key={r.user.id} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 text-right text-xs font-semibold text-slate-500">
                  {idx + 1}
                </div>
                <div className="text-sm text-slate-900">{r.user.username}</div>
              </div>
              <div className="text-sm font-semibold text-slate-900">{r.karma}</div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function CommentItem({ comment, onReply, onToggleLike }) {
  const [replyOpen, setReplyOpen] = useState(false)
  const [replyBody, setReplyBody] = useState('')
  const [busy, setBusy] = useState(false)

  const likeLabel = comment.liked_by_me ? 'Unlike' : 'Like'

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-slate-900">
            <span className="font-semibold">{comment.author.username}</span>
            <span className="ml-2 text-xs text-slate-500">{formatTs(comment.created_at)}</span>
          </div>
          <div className="mt-1 text-sm text-slate-800 whitespace-pre-wrap">{comment.body}</div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <div className="text-xs text-slate-600">{comment.like_count} likes</div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => onToggleLike(comment)}
              disabled={busy}
              type="button"
            >
              {likeLabel}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setReplyOpen((v) => !v)}
              disabled={busy}
              type="button"
            >
              Reply
            </Button>
          </div>
        </div>
      </div>

      {replyOpen ? (
        <div className="mt-3">
          <Textarea
            rows={3}
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
            placeholder="Write a reply..."
          />
          <div className="mt-2 flex justify-end gap-2">
            <Button
              variant="ghost"
              type="button"
              onClick={() => {
                setReplyOpen(false)
                setReplyBody('')
              }}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={busy || replyBody.trim().length === 0}
              onClick={async () => {
                setBusy(true)
                try {
                  await onReply(comment.id, replyBody.trim())
                  setReplyBody('')
                  setReplyOpen(false)
                } finally {
                  setBusy(false)
                }
              }}
            >
              Reply
            </Button>
          </div>
        </div>
      ) : null}

      {comment.children?.length ? (
        <div className="mt-3 space-y-2 pl-4 border-l border-slate-200">
          {comment.children.map((child) => (
            <CommentItem
              key={child.id}
              comment={child}
              onReply={onReply}
              onToggleLike={onToggleLike}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function App() {
  const [usernameInput, setUsernameInput] = useState(getUsername())
  const [activePostId, setActivePostId] = useState(null)

  const [posts, setPosts] = useState([])
  const [postsLoading, setPostsLoading] = useState(true)

  const [post, setPost] = useState(null)
  const [postLoading, setPostLoading] = useState(false)

  const [leaderboardRows, setLeaderboardRows] = useState([])
  const [leaderboardLoading, setLeaderboardLoading] = useState(true)

  const [newPostBody, setNewPostBody] = useState('')
  const [newCommentBody, setNewCommentBody] = useState('')
  const [error, setError] = useState('')

  const apiUser = useMemo(() => getUsername(), [usernameInput])

  async function refreshPosts() {
    setPostsLoading(true)
    try {
      const data = await api.listPosts()
      setPosts(data)
    } finally {
      setPostsLoading(false)
    }
  }

  async function refreshLeaderboard() {
    setLeaderboardLoading(true)
    try {
      const data = await api.leaderboard()
      setLeaderboardRows(data)
    } finally {
      setLeaderboardLoading(false)
    }
  }

  async function loadPost(id) {
    setPostLoading(true)
    try {
      const data = await api.getPost(id)
      setPost(data)
    } finally {
      setPostLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    async function boot() {
      try {
        await refreshPosts()
        await refreshLeaderboard()
      } catch (e) {
        if (!cancelled) setError(String(e.message ?? e))
      }
    }
    boot()

    const id = setInterval(() => {
      refreshLeaderboard().catch(() => {})
    }, 15000)

    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [apiUser])

  useEffect(() => {
    if (activePostId == null) {
      setPost(null)
      return
    }
    loadPost(activePostId).catch((e) => setError(String(e.message ?? e)))
  }, [activePostId])

  async function handleCreatePost() {
    const body = newPostBody.trim()
    if (!body) return
    setError('')
    try {
      await api.createPost(body)
      setNewPostBody('')
      await refreshPosts()
    } catch (e) {
      setError(String(e.message ?? e))
    }
  }

  async function handleCreateComment(parentId, body) {
    if (!post) return
    setError('')
    try {
      const newComment = await api.createComment(post.id, body, parentId)
      setPost((prev) => ({
        ...prev,
        comments: insertReply(prev.comments ?? [], parentId, newComment),
      }))
    } catch (e) {
      setError(String(e.message ?? e))
      throw e
    }
  }

  async function togglePostLike(p) {
    setError('')
    try {
      const res = p.liked_by_me ? await api.unlikePost(p.id) : await api.likePost(p.id)

      setPosts((prev) =>
        prev.map((x) =>
          x.id === p.id
            ? { ...x, liked_by_me: res.liked, like_count: res.like_count }
            : x,
        ),
      )

      if (post && post.id === p.id) {
        setPost((prev) => ({ ...prev, liked_by_me: res.liked, like_count: res.like_count }))
      }

      refreshLeaderboard().catch(() => {})
    } catch (e) {
      setError(String(e.message ?? e))
    }
  }

  async function toggleCommentLike(c) {
    if (!post) return
    setError('')
    try {
      const res = c.liked_by_me ? await api.unlikeComment(c.id) : await api.likeComment(c.id)
      setPost((prev) => ({
        ...prev,
        comments: updateCommentTree(prev.comments ?? [], c.id, (old) => ({
          ...old,
          liked_by_me: res.liked,
          like_count: res.like_count,
        })),
      }))
      refreshLeaderboard().catch(() => {})
    } catch (e) {
      setError(String(e.message ?? e))
    }
  }

  return (
    <div className="min-h-full bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between gap-4">
          <div>
            <div className="text-lg font-semibold text-slate-900">Community Feed</div>
            <div className="text-xs text-slate-500">
              Auth: <span className="font-mono">X-User</span> header (prototype)
            </div>
          </div>

          <div className="flex items-end gap-2 w-[320px]">
            <div className="w-full">
              <div className="text-xs font-semibold text-slate-700">Username</div>
              <Input
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="e.g. alice"
              />
            </div>
            <Button
              type="button"
              onClick={() => {
                const next = usernameInput.trim() || 'demo'
                setUsername(next)
                setUsernameInput(next)
                setActivePostId(null)
                setPost(null)
                refreshPosts().catch(() => {})
                refreshLeaderboard().catch(() => {})
              }}
            >
              Set
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
              {error}
            </div>
          ) : null}

          {activePostId == null ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-900">Create post</div>
              <div className="mt-2">
                <Textarea
                  rows={4}
                  value={newPostBody}
                  onChange={(e) => setNewPostBody(e.target.value)}
                  placeholder="Share something with the community..."
                />
              </div>
              <div className="mt-2 flex justify-end">
                <Button
                  type="button"
                  onClick={handleCreatePost}
                  disabled={newPostBody.trim().length === 0}
                >
                  Post
                </Button>
              </div>
            </div>
          ) : null}

          {activePostId == null ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-900">Feed</div>
                <Button variant="ghost" type="button" onClick={() => refreshPosts().catch(() => {})}>
                  Refresh
                </Button>
              </div>

              {postsLoading ? (
                <div className="text-sm text-slate-500">Loading...</div>
              ) : posts.length === 0 ? (
                <div className="text-sm text-slate-500">No posts yet.</div>
              ) : (
                posts.map((p) => (
                  <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-sm text-slate-900">
                          <span className="font-semibold">{p.author.username}</span>
                          <span className="ml-2 text-xs text-slate-500">{formatTs(p.created_at)}</span>
                        </div>
                        <div className="mt-2 text-sm text-slate-800 whitespace-pre-wrap">{p.body}</div>
                        <div className="mt-2 text-xs text-slate-500">
                          {p.comment_count} comments
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <div className="text-xs text-slate-600">{p.like_count} likes</div>
                        <div className="flex gap-2">
                          <Button variant="ghost" type="button" onClick={() => togglePostLike(p)}>
                            {p.liked_by_me ? 'Unlike' : 'Like'}
                          </Button>
                          <Button variant="ghost" type="button" onClick={() => setActivePostId(p.id)}>
                            Open
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Button variant="ghost" type="button" onClick={() => setActivePostId(null)}>
                  Back
                </Button>
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => activePostId && loadPost(activePostId).catch(() => {})}
                >
                  Refresh
                </Button>
              </div>

              {postLoading || !post ? (
                <div className="text-sm text-slate-500">Loading...</div>
              ) : (
                <>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-sm text-slate-900">
                          <span className="font-semibold">{post.author.username}</span>
                          <span className="ml-2 text-xs text-slate-500">{formatTs(post.created_at)}</span>
                        </div>
                        <div className="mt-2 text-sm text-slate-800 whitespace-pre-wrap">{post.body}</div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className="text-xs text-slate-600">{post.like_count} likes</div>
                        <Button variant="ghost" type="button" onClick={() => togglePostLike(post)}>
                          {post.liked_by_me ? 'Unlike' : 'Like'}
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="text-sm font-semibold text-slate-900">Add comment</div>
                    <div className="mt-2">
                      <Textarea
                        rows={3}
                        value={newCommentBody}
                        onChange={(e) => setNewCommentBody(e.target.value)}
                        placeholder="Write a comment..."
                      />
                    </div>
                    <div className="mt-2 flex justify-end">
                      <Button
                        type="button"
                        disabled={newCommentBody.trim().length === 0}
                        onClick={async () => {
                          const body = newCommentBody.trim()
                          setNewCommentBody('')
                          await handleCreateComment(null, body)
                        }}
                      >
                        Comment
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="text-sm font-semibold text-slate-900">Thread</div>
                    {(post.comments ?? []).length === 0 ? (
                      <div className="text-sm text-slate-500">No comments yet.</div>
                    ) : (
                      <div className="space-y-2">
                        {(post.comments ?? []).map((c) => (
                          <CommentItem
                            key={c.id}
                            comment={c}
                            onReply={handleCreateComment}
                            onToggleLike={toggleCommentLike}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <Leaderboard rows={leaderboardRows} loading={leaderboardLoading} />
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-sm font-semibold text-slate-900">Karma rules</div>
            <div className="mt-2 text-sm text-slate-700">
              <div>Post like: +5 karma</div>
              <div>Comment like: +1 karma</div>
            </div>
            <div className="mt-3 text-xs text-slate-500">
              Leaderboard counts only karma earned in the last 24 hours.
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
