import { computed, reactive, readonly } from 'vue'
import { SimplePool, finalizeEvent, generateSecretKey, getPublicKey, nip04, nip19 } from 'nostr-tools'

const STORAGE_KEY = 'sonof-client-state-v1'
const POPULAR_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://relay.snort.social',
  'wss://nostr.wine',
]

const state = reactive({
  initialized: false,
  syncing: false,
  sending: false,
  loadingRepoGraph: false,
  settings: {
    operatorNsec: '',
    primaryBotNpub: '',
    primaryBotName: '',
    githubToken: '',
  },
  relays: POPULAR_RELAYS.map((url) => ({
    url,
    enabled: true,
  })),
  chats: [],
  repos: [],
  activeChatId: null,
  connectionStatus: {},
  repoGraph: null,
  lastError: '',
})

const pool = new SimplePool({
  onRelayConnectionFailure(url) {
    state.connectionStatus = {
      ...state.connectionStatus,
      [url]: false,
    }
  },
  onRelayConnectionSuccess(url) {
    state.connectionStatus = {
      ...state.connectionStatus,
      [url]: true,
    }
  },
})

let subscriptions = []

function enabledRelayUrls() {
  return state.relays.filter((relay) => relay.enabled).map((relay) => relay.url)
}

function isClient() {
  return typeof window !== 'undefined'
}

function randomId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function decodeNsec(nsec) {
  if (!nsec) {
    return null
  }

  const decoded = nip19.decode(nsec.trim())

  return decoded.type === 'nsec' ? decoded.data : null
}

function decodeNpub(npub) {
  if (!npub) {
    return null
  }

  const decoded = nip19.decode(npub.trim())

  return decoded.type === 'npub' ? decoded.data : null
}

function operatorSecretKey() {
  return decodeNsec(state.settings.operatorNsec)
}

function operatorPubkey() {
  const secretKey = operatorSecretKey()

  return secretKey ? getPublicKey(secretKey) : ''
}

function operatorNpub() {
  const pubkey = operatorPubkey()

  return pubkey ? nip19.npubEncode(pubkey) : ''
}

function primaryBotPubkey() {
  return decodeNpub(state.settings.primaryBotNpub) || ''
}

function chatPubkey(chat) {
  return decodeNpub(chat.npub) || ''
}

function activeChat() {
  return state.chats.find((chat) => chat.id === state.activeChatId) || null
}

function persist() {
  if (!isClient()) {
    return
  }

  const payload = {
    settings: state.settings,
    relays: state.relays,
    chats: state.chats,
    repos: state.repos,
    activeChatId: state.activeChatId,
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}

function normalizeMessage(message) {
  return {
    id: message.id || randomId(),
    author: message.author || 'system',
    content: message.content || '',
    imageUrl: message.imageUrl || '',
    imageName: message.imageName || '',
    createdAt: message.createdAt || new Date().toISOString(),
    direction: message.direction || 'system',
  }
}

function normalizeChat(chat) {
  return {
    id: chat.id || randomId(),
    title: chat.title || 'Untitled chat',
    npub: chat.npub || '',
    repoFullName: chat.repoFullName || '',
    prUrl: chat.prUrl || '',
    prNumber: chat.prNumber || null,
    summary: chat.summary || '',
    lastMessageAt: chat.lastMessageAt || new Date().toISOString(),
    messages: Array.isArray(chat.messages) ? chat.messages.map(normalizeMessage) : [],
  }
}

function load() {
  if (!isClient()) {
    state.initialized = true
    return
  }

  const raw = window.localStorage.getItem(STORAGE_KEY)

  if (!raw) {
    state.initialized = true
    return
  }

  try {
    const saved = JSON.parse(raw)

    state.settings = {
      ...state.settings,
      ...(saved.settings || {}),
    }
    state.relays = Array.isArray(saved.relays) && saved.relays.length > 0 ? saved.relays : state.relays
    state.chats = Array.isArray(saved.chats) ? saved.chats.map(normalizeChat) : []
    state.repos = Array.isArray(saved.repos) ? saved.repos : []
    state.activeChatId = saved.activeChatId || state.chats[0]?.id || null
  } catch (error) {
    state.lastError = error instanceof Error ? error.message : 'Failed to load local data'
  } finally {
    state.initialized = true
  }
}

function setActiveChat(chatId) {
  state.activeChatId = chatId
  persist()
}

function setLastError(error) {
  state.lastError = error instanceof Error ? error.message : String(error || '')
}

function resetLastError() {
  state.lastError = ''
}

function updateRepoLinks(repoFullName, chatNpub) {
  if (!repoFullName || !chatNpub) {
    return
  }

  const existing = state.repos.find((repo) => repo.fullName === repoFullName)

  if (!existing) {
    state.repos.unshift({
      fullName: repoFullName,
      chatNpubs: [chatNpub],
    })
    return
  }

  if (!existing.chatNpubs.includes(chatNpub)) {
    existing.chatNpubs.push(chatNpub)
  }
}

function parseGithubMetadata(text) {
  const value = text || ''
  const prMatch = value.match(/github\.com\/([\w.-]+\/[\w.-]+)\/pull\/(\d+)/i)

  if (prMatch) {
    return {
      repoFullName: prMatch[1],
      prUrl: prMatch[0].startsWith('http') ? prMatch[0] : `https://${prMatch[0]}`,
      prNumber: Number(prMatch[2]),
    }
  }

  const repoMatch =
    value.match(/github\.com\/([\w.-]+\/[\w.-]+)/i) ||
    value.match(/\b([\w.-]+\/[\w.-]+)#\d+\b/i) ||
    value.match(/\b([\w.-]+\/[\w.-]+)\b/i)

  if (repoMatch) {
    return {
      repoFullName: repoMatch[1],
      prUrl: '',
      prNumber: null,
    }
  }

  return {
    repoFullName: '',
    prUrl: '',
    prNumber: null,
  }
}

function upsertChat(chat) {
  const normalized = normalizeChat(chat)
  const index = state.chats.findIndex((item) => item.id === normalized.id)

  if (index === -1) {
    state.chats.unshift(normalized)
  } else {
    state.chats[index] = normalized
  }

  state.chats.sort((left, right) => new Date(right.lastMessageAt) - new Date(left.lastMessageAt))

  if (!state.activeChatId) {
    state.activeChatId = normalized.id
  }
}

function appendMessage(chatId, message) {
  const chat = state.chats.find((item) => item.id === chatId)

  if (!chat) {
    return
  }

  if (chat.messages.some((item) => item.id === message.id)) {
    return
  }

  chat.messages.push(normalizeMessage(message))
  chat.messages.sort((left, right) => new Date(left.createdAt) - new Date(right.createdAt))
  chat.lastMessageAt = message.createdAt
  persist()
}

function syncConnectionSnapshot() {
  state.connectionStatus = Object.fromEntries(pool.listConnectionStatus().entries())
}

async function ensureRelayConnections() {
  const relays = enabledRelayUrls()

  await Promise.all(
    relays.map((url) =>
      pool.ensureRelay(url).catch(() => {
        state.connectionStatus = {
          ...state.connectionStatus,
          [url]: false,
        }
      }),
    ),
  )

  syncConnectionSnapshot()
}

function closeSubscriptions() {
  subscriptions.forEach((subscription) => subscription.close())
  subscriptions = []
}

function targetPubkeys() {
  return state.chats.map(chatPubkey).filter(Boolean)
}

function resolveChatFromEvent(event) {
  const operator = operatorPubkey()
  const outgoing = event.pubkey === operator
  const peerPubkey = outgoing
    ? event.tags.find((tag) => tag[0] === 'p')?.[1] || ''
    : event.pubkey

  return state.chats.find((chat) => chatPubkey(chat) === peerPubkey) || null
}

function parseDmPayload(content) {
  let parsed

  try {
    parsed = JSON.parse(content)
  } catch {
    return {
      content,
      imageUrl: '',
      imageName: '',
    }
  }

  if (!parsed?.type) {
    return {
      content,
      imageUrl: '',
      imageName: '',
    }
  }

  if (parsed.type === 'sonof-status') {
    return {
      kind: 'status',
      content: parsed.summary || parsed.status || '',
      imageUrl: '',
      imageName: '',
      summary: parsed.summary || parsed.status || '',
      repoFullName: sanitizeRepo(parsed.repo || parsed.repository || ''),
      prUrl: parsed.pr_url || '',
      prNumber: Number(parsed.pr_number || 0) || null,
    }
  }

  if (parsed.type !== 'sonof-message') {
    return {
      content,
      imageUrl: '',
      imageName: '',
    }
  }

  return {
    kind: 'message',
    content: parsed.text || '',
    imageUrl: parsed.image?.dataUrl || '',
    imageName: parsed.image?.name || '',
  }
}

function decryptDm(event) {
  const secretKey = operatorSecretKey()
  const chat = resolveChatFromEvent(event)

  if (!secretKey || !chat) {
    return null
  }

  const peerPubkey = chatPubkey(chat)
  const content = nip04.decrypt(secretKey, peerPubkey, event.content)

  return {
    chat,
    payload: parseDmPayload(content),
    outgoing: event.pubkey === operatorPubkey(),
  }
}

function subscribeToMessages() {
  closeSubscriptions()

  const relays = enabledRelayUrls()
  const operator = operatorPubkey()
  const peers = targetPubkeys()

  if (!relays.length || !operator || !peers.length) {
    return
  }

  const since = Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 14
  const sharedHandler = (event) => {
    try {
      const decrypted = decryptDm(event)

      if (!decrypted) {
        return
      }

      const createdAt = new Date(event.created_at * 1000).toISOString()

      if (decrypted.payload.kind === 'status') {
        decrypted.chat.summary = decrypted.payload.summary || decrypted.chat.summary
        decrypted.chat.repoFullName = decrypted.payload.repoFullName || decrypted.chat.repoFullName
        decrypted.chat.prUrl = decrypted.payload.prUrl || decrypted.chat.prUrl
        decrypted.chat.prNumber = decrypted.payload.prNumber || decrypted.chat.prNumber
        decrypted.chat.lastMessageAt = createdAt

        if (decrypted.chat.repoFullName) {
          updateRepoLinks(decrypted.chat.repoFullName, decrypted.chat.npub)
        }

        persist()
        return
      }

      appendMessage(decrypted.chat.id, {
        id: event.id,
        author: decrypted.outgoing ? 'you' : 'openclaw',
        content: decrypted.payload.content,
        imageUrl: decrypted.payload.imageUrl,
        imageName: decrypted.payload.imageName,
        createdAt,
        direction: decrypted.outgoing ? 'outgoing' : 'incoming',
      })
    } catch {
      // Ignore events that do not decrypt for this operator key.
    }
  }

  subscriptions.push(
    pool.subscribeMany(relays, { kinds: [4], authors: peers, '#p': [operator], since }, { onevent: sharedHandler }),
  )
  subscriptions.push(
    pool.subscribeMany(relays, { kinds: [4], authors: [operator], '#p': peers, since }, { onevent: sharedHandler }),
  )
}

function parseProfileContent(content) {
  try {
    const parsed = JSON.parse(content)
    const explicitRepo = sanitizeRepo(parsed.repo || parsed.repository || '')
    const githubMeta = parseGithubMetadata(
      [
        parsed.summary,
        parsed.about,
        parsed.website,
        parsed.pull_request,
        parsed.pr_url,
        explicitRepo,
      ]
        .filter(Boolean)
        .join(' '),
    )

    return {
      raw: parsed,
      summary: parsed.summary || parsed.about || parsed.description || '',
      name: parsed.display_name || parsed.name || '',
      repoFullName: explicitRepo || githubMeta.repoFullName,
      prUrl: parsed.pr_url || githubMeta.prUrl,
      prNumber: Number(parsed.pr_number || githubMeta.prNumber || 0) || null,
    }
  } catch {
    return {
      raw: null,
      summary: content,
      name: '',
      ...parseGithubMetadata(content),
    }
  }
}

async function refreshPrimaryProfile() {
  const relays = enabledRelayUrls()
  const pubkey = primaryBotPubkey()

  if (!relays.length || !pubkey) {
    return
  }

  const events = await pool.querySync(relays, { kinds: [0], authors: [pubkey] }, { maxWait: 1500 })
  const latest = events.sort((left, right) => right.created_at - left.created_at)[0]

  if (!latest) {
    return
  }

  const parsed = parseProfileContent(latest.content)

  if (parsed.name) {
    state.settings.primaryBotName = parsed.name
    persist()
  }
}

async function syncNostr() {
  resetLastError()
  state.syncing = true

  try {
    await ensureRelayConnections()
    await refreshPrimaryProfile()
    subscribeToMessages()
  } catch (error) {
    setLastError(error)
    throw error
  } finally {
    state.syncing = false
  }
}

function sanitizeRepo(repoFullName) {
  return (repoFullName || '').trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\/+$/, '')
}

async function publishEncryptedMessage(targetPubkey, plainText) {
  const secretKey = operatorSecretKey()

  if (!secretKey) {
    throw new Error('Add your operator nsec before sending messages.')
  }

  if (!targetPubkey) {
    throw new Error('Missing target pubkey for this message.')
  }

  const event = finalizeEvent(
    {
      kind: 4,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['p', targetPubkey]],
      content: nip04.encrypt(secretKey, targetPubkey, plainText),
    },
    secretKey,
  )

  const relays = enabledRelayUrls()

  if (!relays.length) {
    throw new Error('Add at least one relay before sending messages.')
  }

  await Promise.all(pool.publish(relays, event))

  return event
}

async function startChat({ title, repoFullName, note }) {
  const operator = operatorPubkey()
  const primaryPubkey = primaryBotPubkey()

  if (!operator) {
    throw new Error('Add your operator nsec before starting a chat.')
  }

  if (!primaryPubkey) {
    throw new Error('Add the OpenClaw primary npub before starting a chat.')
  }

  const repo = sanitizeRepo(repoFullName)
  const chatSecretKey = generateSecretKey()
  const chatPubkeyHex = getPublicKey(chatSecretKey)
  const chatNsec = nip19.nsecEncode(chatSecretKey)
  const chatNpub = nip19.npubEncode(chatPubkeyHex)
  const bootstrapPayload = JSON.stringify({
    command: 'start_chat',
    title: title.trim() || 'New chat',
    chat_nsec: chatNsec,
    chat_npub: chatNpub,
    repo,
    note: note.trim(),
    status_protocol: 'private_nip04_sonof_status',
    requested_at: new Date().toISOString(),
  })
  const bootstrapEvent = await publishEncryptedMessage(primaryPubkey, bootstrapPayload)
  const chat = normalizeChat({
    id: randomId(),
    title: title.trim() || `Chat ${state.chats.length + 1}`,
    npub: chatNpub,
    repoFullName: repo,
    summary: 'Bootstrap sent to the primary OpenClaw identity. Waiting for a private status DM from the chat identity.',
    prUrl: '',
    prNumber: null,
    lastMessageAt: new Date(bootstrapEvent.created_at * 1000).toISOString(),
    messages: [
      {
        id: `${bootstrapEvent.id}-bootstrap`,
        author: 'system',
        content: `Started with ${chatNpub}${repo ? ` for ${repo}` : ''}. The generated nsec was sent only to the primary OpenClaw identity.`,
        createdAt: new Date(bootstrapEvent.created_at * 1000).toISOString(),
        direction: 'system',
      },
    ],
  })

  upsertChat(chat)
  state.activeChatId = chat.id
  updateRepoLinks(chat.repoFullName, chat.npub)
  persist()
  await syncNostr()

  return chat
}

async function sendMessageToActiveChat(text, image = null) {
  const chat = activeChat()
  const body = text.trim()

  if (!chat) {
    throw new Error('Choose a chat before sending a message.')
  }

  if (!body && !image?.dataUrl) {
    throw new Error('Type a message or attach an image first.')
  }

  state.sending = true
  resetLastError()

  try {
    const payload = image?.dataUrl
      ? JSON.stringify({
          type: 'sonof-message',
          text: body,
          image: {
            name: image.name || 'attachment',
            mimeType: image.mimeType || 'image/*',
            dataUrl: image.dataUrl,
          },
        })
      : body
    const event = await publishEncryptedMessage(chatPubkey(chat), payload)

    appendMessage(chat.id, {
      id: event.id,
      author: 'you',
      content: body,
      imageUrl: image?.dataUrl || '',
      imageName: image?.name || '',
      createdAt: new Date(event.created_at * 1000).toISOString(),
      direction: 'outgoing',
    })
  } catch (error) {
    setLastError(error)
    throw error
  } finally {
    state.sending = false
  }
}

async function fetchGitHub(path) {
  const headers = {
    Accept: 'application/vnd.github+json',
  }

  if (state.settings.githubToken) {
    headers.Authorization = `Bearer ${state.settings.githubToken.trim()}`
  }

  const response = await fetch(`https://api.github.com${path}`, { headers })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`GitHub request failed (${response.status}): ${errorText || response.statusText}`)
  }

  return response.json()
}

async function loadRepoGraph(repoFullName, prNumber = null) {
  const repo = sanitizeRepo(repoFullName)

  if (!repo) {
    throw new Error('Missing repository name.')
  }

  state.loadingRepoGraph = true
  resetLastError()

  try {
    const [repoData, branches, pullRequest] = await Promise.all([
      fetchGitHub(`/repos/${repo}`),
      fetchGitHub(`/repos/${repo}/branches?per_page=8`),
      prNumber ? fetchGitHub(`/repos/${repo}/pulls/${prNumber}`) : Promise.resolve(null),
    ])

    state.repoGraph = {
      repo: repoData.full_name,
      repoUrl: repoData.html_url,
      defaultBranch: repoData.default_branch,
      updatedAt: repoData.updated_at,
      branches: branches.map((branch) => ({
        name: branch.name,
        sha: branch.commit?.sha?.slice(0, 7) || '',
        protected: Boolean(branch.protected),
        role:
          branch.name === repoData.default_branch
            ? 'default'
            : pullRequest?.head?.ref === branch.name
              ? 'pr-head'
              : pullRequest?.base?.ref === branch.name
                ? 'pr-base'
                : 'branch',
      })),
      pullRequest: pullRequest
        ? {
            number: pullRequest.number,
            title: pullRequest.title,
            url: pullRequest.html_url,
            head: pullRequest.head?.ref,
            base: pullRequest.base?.ref,
            state: pullRequest.state,
          }
        : null,
    }
  } catch (error) {
    setLastError(error)
    throw error
  } finally {
    state.loadingRepoGraph = false
  }
}

function addRelay(url) {
  const normalized = (url || '').trim()

  if (!normalized) {
    throw new Error('Relay URL is empty.')
  }

  if (!state.relays.some((relay) => relay.url === normalized)) {
    state.relays.push({ url: normalized, enabled: true })
    persist()
  }
}

function removeRelay(url) {
  state.relays = state.relays.filter((relay) => relay.url !== url)
  persist()
}

function toggleRelay(url, enabled) {
  const relay = state.relays.find((item) => item.url === url)

  if (!relay) {
    return
  }

  relay.enabled = enabled
  persist()
}

function saveSettings(updates) {
  state.settings = {
    ...state.settings,
    ...updates,
  }
  persist()
}

function chatByRepo(repoFullName) {
  const repo = sanitizeRepo(repoFullName)

  return state.chats.filter((chat) => chat.repoFullName === repo)
}

const clientTitle = computed(() => {
  const suffix = state.settings.primaryBotName?.trim()

  return suffix ? `sonof${suffix}` : 'sonof'
})

const activeChatState = computed(() => activeChat())
const operatorNpubState = computed(() => operatorNpub())

export function useSonofClient() {
  if (!state.initialized) {
    load()
  }

  return {
    state: readonly(state),
    clientTitle,
    activeChat: activeChatState,
    operatorNpub: operatorNpubState,
    addRelay,
    chatByRepo,
    loadRepoGraph,
    refreshPrimaryProfile,
    removeRelay,
    saveSettings,
    sendMessageToActiveChat,
    setActiveChat,
    startChat,
    syncNostr,
    toggleRelay,
  }
}
