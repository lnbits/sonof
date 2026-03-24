<template>
  <q-layout view="hHh Lpr fFf" :class="pageShellClass">
    <q-header :class="headerClass">
      <q-toolbar class="q-px-sm q-py-sm">
        <q-btn flat round icon="menu" @click="drawerOpen = !drawerOpen" />
        <div class="text-h6 text-weight-bold q-ml-sm">{{ clientTitle }}</div>
        <q-space />
        <q-btn
          flat
          round
          :icon="$q.dark.isActive ? 'light_mode' : 'dark_mode'"
          @click="toggleDarkMode"
        />
        <q-btn flat round icon="hub" @click="relayDialog = true" />
        <q-btn
          flat
          round
          icon="settings"
          :class="needsSettingsAttention ? 'animated pulse infinite slower' : ''"
          @click="settingsDialog = true"
        />
        <q-btn
          flat
          round
          icon="fa-brands fa-github"
          :class="needsGithubAttention ? 'animated pulse infinite slower' : ''"
          @click="githubDialog = true"
        />
      </q-toolbar>
    </q-header>

    <q-drawer
      v-model="drawerOpen"
      show-if-above
      bordered
      :breakpoint="900"
      :width="300"
      :class="drawerClass"
    >
      <div class="column fit no-wrap">
        <div class="q-px-md q-pb-sm">
          <q-card flat bordered :class="cardClass">
            <q-card-section class="row items-center q-col-gutter-sm">
              <div class="col">
                <div class="text-caption text-grey-5">Operator</div>
                <div class="text-body2 ellipsis">
                  {{ operatorNpub || 'No operator nsec saved yet' }}
                </div>
              </div>

              <div class="col-auto">
                <q-btn
                  flat
                  round
                  icon="sync"
                  :loading="state.syncing"
                  @click="runSync"
                />
              </div>
            </q-card-section>
          </q-card>
        </div>

        <div class="q-px-md q-pb-sm">
          <q-btn
            unelevated
            no-caps
            color="grey-8"
            text-color="white"
            icon="add"
            class="full-width"
            label="Start chat"
            @click="chatDialog = true"
          />
        </div>

        <q-scroll-area class="col">
          <div class="q-px-sm q-pb-md">
            <div class="text-overline text-grey-5 q-px-sm q-pb-xs">Chats</div>

            <q-list separator :dark="$q.dark.isActive">
              <q-item
                v-for="chat in state.chats"
                :key="chat.id"
                clickable
                :active="chat.id === state.activeChatId"
                active-class="bg-grey-8"
                class="rounded-borders q-mb-xs"
                @click="setActiveChat(chat.id)"
              >
                <q-item-section>
                  <q-item-label>{{ chat.title }}</q-item-label>
                  <q-item-label caption class="text-grey-5">
                    {{ chat.summary || chat.npub }}
                  </q-item-label>
                </q-item-section>

                <q-item-section side class="text-caption text-grey-5">
                  {{ formatDate(chat.lastMessageAt) }}
                </q-item-section>
              </q-item>

              <q-item v-if="!state.chats.length">
                <q-item-section>
                  <q-item-label class="text-grey-5">No chats yet</q-item-label>
                  <q-item-label caption class="text-grey-6">
                    Start one to generate a dedicated OpenClaw chat key.
                  </q-item-label>
                </q-item-section>
              </q-item>
            </q-list>

            <div class="text-overline text-grey-5 q-px-sm q-py-sm">Repos</div>

            <q-list separator :dark="$q.dark.isActive">
              <q-item v-for="repo in state.repos" :key="repo.fullName" clickable @click="openRepo(repo.fullName)">
                <q-item-section>
                  <q-item-label>{{ repo.fullName }}</q-item-label>
                  <q-item-label caption class="text-grey-5">
                    {{ repo.chatNpubs.length }} linked {{ repo.chatNpubs.length === 1 ? 'chat' : 'chats' }}
                  </q-item-label>
                </q-item-section>
              </q-item>

              <q-item v-if="!state.repos.length">
                <q-item-section>
                  <q-item-label class="text-grey-5">No repos linked yet</q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </div>
        </q-scroll-area>

        <div class="q-pa-md">
          <q-list dense :dark="$q.dark.isActive" class="text-body2 text-grey-5">
            <q-item class="q-px-none">
              <q-item-section side class="text-grey-6">*</q-item-section>
              <q-item-section>create an OpenClaw bot</q-item-section>
            </q-item>
            <q-item class="q-px-none">
              <q-item-section side class="text-grey-6">*</q-item-section>
              <q-item-section>give OpenClaw a Nostr nsec and GitHub account</q-item-section>
            </q-item>
            <q-item class="q-px-none">
              <q-item-section side class="text-grey-6">*</q-item-section>
              <q-item-section>Connect to OpenClaw's npub from this client</q-item-section>
            </q-item>
            <q-item class="q-px-none">
              <q-item-section>
                <q-btn
                  flat
                  dense
                  no-caps
                  color="grey-5"
                  label="Connection prompt"
                  @click="promptDialog = true"
                />
              </q-item-section>
            </q-item>
          </q-list>
        </div>
      </div>
    </q-drawer>

    <q-page-container>
      <router-view />
    </q-page-container>

    <q-dialog v-model="relayDialog">
      <q-card :class="dialogCardClass">
        <q-card-section class="row items-center">
          <div class="text-h6">Relays</div>
          <q-space />
          <q-btn flat round icon="sync" :loading="state.syncing" @click="runSync" />
        </q-card-section>

        <q-separator dark />

        <q-card-section class="q-gutter-sm">
          <q-input
            v-model="relayDraft"
            dark
            filled
            dense
            label="Add relay"
            placeholder="wss://relay.example.com"
            @keyup.enter="handleAddRelay"
          >
            <template #append>
              <q-btn flat round icon="add" @click="handleAddRelay" />
            </template>
          </q-input>

          <q-list separator :dark="$q.dark.isActive">
            <q-item v-for="relay in state.relays" :key="relay.url">
              <q-item-section>
                <q-item-label>{{ relay.url }}</q-item-label>
                <q-item-label caption class="text-grey-5">
                  {{ relayStatus(relay.url) }}
                </q-item-label>
              </q-item-section>

              <q-item-section side>
                <div class="row items-center q-gutter-sm">
                  <q-toggle
                    :model-value="relay.enabled"
                    color="positive"
                    @update:model-value="toggleRelay(relay.url, $event)"
                  />
                  <q-btn flat round icon="close" @click="removeRelay(relay.url)" />
                </div>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
      </q-card>
    </q-dialog>

    <q-dialog v-model="githubDialog">
      <q-card :class="dialogCardClass">
        <q-card-section>
          <div class="text-h6">GitHub access</div>
          <div class="text-body2 text-grey-5">
            Save a token locally so repo and PR lookups avoid low unauthenticated rate limits.
          </div>
        </q-card-section>

        <q-separator dark />

        <q-card-section class="q-gutter-md">
          <q-input
            v-model="settingsDraft.githubToken"
            dark
            filled
            dense
            type="password"
            label="GitHub token"
            autocomplete="off"
          />

          <q-btn unelevated no-caps color="grey-8" text-color="white" label="Save token" @click="saveIdentitySettings" />
        </q-card-section>
      </q-card>
    </q-dialog>

    <q-dialog v-model="settingsDialog">
      <q-card :class="dialogCardClass">
        <q-card-section>
          <div class="text-h6">Settings</div>
          <div class="text-body2 text-grey-5">
            Save the identities Sonof needs to connect to OpenClaw.
          </div>
        </q-card-section>

        <q-separator dark />

        <q-card-section class="q-gutter-md">
          <q-input
            v-model="settingsDraft.operatorNsec"
            dark
            filled
            dense
            type="password"
            label="Your operator nsec"
            autocomplete="off"
          />

          <q-input
            v-model="settingsDraft.primaryBotNpub"
            dark
            filled
            dense
            label="Primary OpenClaw npub"
            autocomplete="off"
          />
        </q-card-section>

        <q-separator dark />

        <q-card-actions align="right">
          <q-btn flat no-caps label="Cancel" v-close-popup />
          <q-btn unelevated no-caps color="grey-8" text-color="white" label="Save keys" @click="saveIdentitySettings" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="chatDialog">
      <q-card :class="dialogCardClass">
        <q-card-section>
          <div class="text-h6">Start chat</div>
          <div class="text-body2 text-grey-5">
            Create a new chat identity for OpenClaw and send the bootstrap DM through its primary identity.
          </div>
          <div class="text-caption text-grey-6 q-mt-sm">
            Status and repo or PR metadata should come back privately over encrypted NIP-04 DMs from the chat identity.
          </div>
        </q-card-section>

        <q-separator dark />

        <q-card-section class="q-gutter-md">
          <q-banner v-if="needsSettingsAttention" rounded class="bg-grey-9 text-grey-4">
            Save your operator nsec and the primary OpenClaw npub in Settings before starting a chat.
          </q-banner>

          <q-input v-model="chatDraft.title" :dark="$q.dark.isActive" filled dense label="Chat title" />

          <q-input
            v-model="chatDraft.repoFullName"
            :dark="$q.dark.isActive"
            filled
            dense
            label="GitHub repo"
            placeholder="owner/repo"
          />

          <q-input
            v-model="chatDraft.note"
            :dark="$q.dark.isActive"
            filled
            autogrow
            label="Opening note"
            placeholder="What should OpenClaw work on?"
          />
        </q-card-section>

        <q-separator dark />

        <q-card-actions align="right">
          <q-btn flat no-caps label="Cancel" v-close-popup />
          <q-btn
            unelevated
            no-caps
            color="white"
            text-color="dark"
            label="Start chat"
            :disable="needsSettingsAttention"
            @click="handleStartChat"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="repoDialog">
      <q-card :class="dialogCardClass">
        <q-card-section class="row items-center">
          <div>
            <div class="text-h6">{{ state.repoGraph?.repo || 'Repo graph' }}</div>
            <div class="text-caption text-grey-5">
              {{ state.repoGraph?.defaultBranch ? `Default branch: ${state.repoGraph.defaultBranch}` : '' }}
            </div>
          </div>
          <q-space />
          <q-btn
            v-if="state.repoGraph?.repoUrl"
            flat
            no-caps
            icon="open_in_new"
            label="Open repo"
            :href="state.repoGraph.repoUrl"
            target="_blank"
          />
        </q-card-section>

        <q-separator dark />

        <q-card-section v-if="state.loadingRepoGraph" class="q-gutter-md">
          <q-linear-progress indeterminate color="white" />
          <div class="text-grey-5">Loading branch data from GitHub…</div>
        </q-card-section>

        <q-card-section v-else-if="state.repoGraph">
          <q-banner v-if="state.repoGraph.pullRequest" inline-actions rounded class="bg-grey-9 text-white q-mb-md">
            <div class="text-subtitle2">
              PR #{{ state.repoGraph.pullRequest.number }} · {{ state.repoGraph.pullRequest.title }}
            </div>
            <div class="text-caption text-grey-5">
              {{ state.repoGraph.pullRequest.head }} -> {{ state.repoGraph.pullRequest.base }}
            </div>

            <template #action>
              <q-btn
                flat
                no-caps
                icon="open_in_new"
                label="Open PR"
                :href="state.repoGraph.pullRequest.url"
                target="_blank"
              />
            </template>
          </q-banner>

          <q-timeline color="white" layout="dense">
            <q-timeline-entry
              v-for="branch in state.repoGraph.branches"
              :key="branch.name"
              :title="branch.name"
              :subtitle="branch.sha"
            >
              <div class="row q-gutter-sm">
                <q-chip
                  square
                  dense
                  :color="branch.role === 'default' ? 'white' : branch.role === 'pr-head' ? 'positive' : branch.role === 'pr-base' ? 'info' : 'grey-8'"
                  :text-color="branch.role === 'default' ? 'dark' : 'white'"
                >
                  {{ branch.role }}
                </q-chip>
                <q-chip v-if="branch.protected" square dense color="warning" text-color="dark">
                  protected
                </q-chip>
              </div>
            </q-timeline-entry>
          </q-timeline>
        </q-card-section>
      </q-card>
    </q-dialog>

    <q-dialog v-model="promptDialog">
      <q-card :class="dialogCardClass" style="min-width: 320px; max-width: 760px; width: 100%">
        <q-card-section class="row items-center">
          <div class="text-h6">OpenClaw Prompt</div>
          <q-space />
          <q-btn flat round icon="content_copy" :disable="!canGeneratePrompt" @click="copyPrompt" />
        </q-card-section>

        <q-separator dark />

        <q-card-section class="q-gutter-md">
          <q-banner v-if="!canGeneratePrompt" rounded class="bg-grey-9 text-grey-4">
            Save your operator nsec and the OpenClaw primary npub first, then reopen this dialog.
          </q-banner>

          <q-input
            v-else
            :model-value="clawbotPrompt"
            dark
            filled
            autogrow
            type="textarea"
            readonly
          />
        </q-card-section>
      </q-card>
    </q-dialog>
  </q-layout>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { Notify, useQuasar } from 'quasar'
import { useSonofClient } from 'src/composables/useSonofClient'

const $q = useQuasar()
const {
  addRelay,
  clientTitle,
  loadRepoGraph,
  operatorNpub,
  removeRelay,
  saveSettings,
  setActiveChat,
  startChat,
  state,
  syncNostr,
  toggleRelay,
} = useSonofClient()

const drawerOpen = ref($q.screen.gt.sm)
const relayDialog = ref(false)
const githubDialog = ref(false)
const settingsDialog = ref(false)
const chatDialog = ref(false)
const repoDialog = ref(false)
const promptDialog = ref(false)
const relayDraft = ref('')

const settingsDraft = reactive({
  operatorNsec: state.settings.operatorNsec,
  primaryBotNpub: state.settings.primaryBotNpub,
  githubToken: state.settings.githubToken,
})

const chatDraft = reactive({
  title: '',
  repoFullName: '',
  note: '',
})
const needsSettingsAttention = computed(
  () => !state.settings.operatorNsec.trim() || !state.settings.primaryBotNpub.trim(),
)
const needsGithubAttention = computed(() => !state.settings.githubToken.trim())
const canGeneratePrompt = computed(
  () => Boolean(state.settings.operatorNsec.trim() && state.settings.primaryBotNpub.trim()),
)
const pageShellClass = computed(() =>
  $q.dark.isActive ? 'bg-dark text-white' : 'bg-grey-2 text-dark',
)
const headerClass = computed(() =>
  $q.dark.isActive ? 'bg-dark text-white' : 'bg-white text-dark',
)
const drawerClass = computed(() =>
  $q.dark.isActive ? 'bg-grey-10 text-white' : 'bg-white text-dark',
)
const cardClass = computed(() =>
  $q.dark.isActive ? 'bg-grey-9 text-white' : 'bg-grey-2 text-dark',
)
const dialogCardClass = computed(() =>
  $q.dark.isActive ? 'bg-grey-10 text-white' : 'bg-white text-dark',
)
const clawbotPrompt = computed(() => {
  const relays = state.relays.filter((relay) => relay.enabled).map((relay) => relay.url)

  return [
    'You are OpenClaw and will communicate with the Sonof client over Nostr.',
    '',
    'Connection contract:',
    `- Primary OpenClaw npub: ${state.settings.primaryBotNpub || '<set primary npub>'}`,
    `- Operator npub: ${operatorNpub.value || '<save operator nsec in Sonof first>'}`,
    `- Preferred relays: ${relays.join(', ') || '<enable at least one relay>'}`,
    '',
    'Expected behavior:',
    '- Monitor your primary identity for NIP-04 DMs from the operator.',
    '- A start_chat bootstrap DM contains chat_nsec, chat_npub, repo, note, and status_protocol.',
    '- Import the provided chat_nsec and use that chat identity for the project conversation.',
    '- Send private status updates back as encrypted kind 4 DMs from the per-chat identity.',
    '- A status DM payload should be JSON with type set to sonof-status and fields like summary, repo, pr_url, pr_number, and status.',
    '- Reply to the operator over NIP-04 DM from the per-chat identity, not the primary identity.',
    '- If work references a GitHub repository or PR, include repo and pr_url or pr_number in the status DM payload.',
    '',
    'Private status DM example:',
    JSON.stringify(
      {
        type: 'sonof-status',
        summary: 'Investigating the requested change and preparing a patch.',
        repo: 'owner/repo',
        pr_url: 'https://github.com/owner/repo/pull/123',
        pr_number: 123,
        status: 'working',
      },
      null,
      2,
    ),
  ].join('\n')
})

function formatDate(value) {
  return new Date(value).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  })
}

function relayStatus(url) {
  const connected = state.connectionStatus[url]

  return connected === undefined ? 'Not connected yet' : connected ? 'Connected' : 'Offline'
}

function toast(message, type = 'positive') {
  Notify.create({
    message,
    color: type,
    textColor: type === 'warning' ? 'dark' : 'white',
    position: 'top',
  })
}

async function copyPrompt() {
  try {
    await navigator.clipboard.writeText(clawbotPrompt.value)
    toast('Prompt copied')
  } catch {
    toast('Unable to copy prompt', 'negative')
  }
}

function openRepoGraphDialog() {
  repoDialog.value = true
}

function toggleDarkMode() {
  const next = !$q.dark.isActive

  $q.dark.set(next)

  if (typeof window !== 'undefined') {
    window.localStorage.setItem('sonof-dark-mode', JSON.stringify(next))
  }
}

function saveIdentitySettings() {
  saveSettings({
    operatorNsec: settingsDraft.operatorNsec.trim(),
    primaryBotNpub: settingsDraft.primaryBotNpub.trim(),
    githubToken: settingsDraft.githubToken.trim(),
  })
  toast('Local settings updated')
}

async function runSync() {
  try {
    await syncNostr()
    toast('Relay sync complete')
  } catch (error) {
    toast(error instanceof Error ? error.message : 'Sync failed', 'negative')
  }
}

function handleAddRelay() {
  try {
    addRelay(relayDraft.value)
    relayDraft.value = ''
    toast('Relay added')
  } catch (error) {
    toast(error instanceof Error ? error.message : 'Unable to add relay', 'negative')
  }
}

async function handleStartChat() {
  try {
    await startChat(chatDraft)
    chatDraft.title = ''
    chatDraft.repoFullName = ''
    chatDraft.note = ''
    chatDialog.value = false
    drawerOpen.value = true
    toast('Chat bootstrap sent')
  } catch (error) {
    toast(error instanceof Error ? error.message : 'Failed to start chat', 'negative')
  }
}

async function openRepo(repoFullName) {
  try {
    await loadRepoGraph(repoFullName)
    repoDialog.value = true
  } catch (error) {
    toast(error instanceof Error ? error.message : 'Failed to load repo graph', 'negative')
  }
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    const savedDarkMode = window.localStorage.getItem('sonof-dark-mode')

    if (savedDarkMode !== null) {
      $q.dark.set(JSON.parse(savedDarkMode))
    }
  }

  window.addEventListener('sonof-open-repo-graph', openRepoGraphDialog)

  if (state.settings.operatorNsec && state.settings.primaryBotNpub) {
    void runSync()
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('sonof-open-repo-graph', openRepoGraphDialog)
})

watch(
  clientTitle,
  (value) => {
    if (typeof document !== 'undefined') {
      document.title = value
    }
  },
  { immediate: true },
)
</script>
