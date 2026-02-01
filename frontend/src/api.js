const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8000/api'

export function getUsername() {
  return localStorage.getItem('cf_username') ?? 'demo'
}

export function setUsername(username) {
  localStorage.setItem('cf_username', username)
}

async function apiFetch(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-User': getUsername(),
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `Request failed: ${res.status}`)
  }

  return res.status === 204 ? null : res.json()
}

export const api = {
  listPosts: () => apiFetch('/posts/'),
  createPost: (body) => apiFetch('/posts/', { method: 'POST', body: { body } }),
  getPost: (id) => apiFetch(`/posts/${id}/`),
  createComment: (postId, body, parentId = null) =>
    apiFetch(`/posts/${postId}/comments/`, { method: 'POST', body: { body, parent_id: parentId } }),
  likePost: (postId) => apiFetch(`/posts/${postId}/like/`, { method: 'POST' }),
  unlikePost: (postId) => apiFetch(`/posts/${postId}/like/`, { method: 'DELETE' }),
  likeComment: (commentId) => apiFetch(`/comments/${commentId}/like/`, { method: 'POST' }),
  unlikeComment: (commentId) => apiFetch(`/comments/${commentId}/like/`, { method: 'DELETE' }),
  leaderboard: () => apiFetch('/leaderboard/'),
}
