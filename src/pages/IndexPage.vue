<template>
  <q-page :class="pageClass">
    <div class="column fit">
      <div v-if="activeChat" class="col column no-wrap">
        <div v-if="!showCenteredSystemMessage" class="q-px-md q-pt-md q-pb-sm">
          <q-card flat bordered :class="panelClass">
            <q-card-section class="row items-start q-col-gutter-md">
              <div class="col-12 col-md">
                <div class="text-overline text-grey-5">Active chat</div>
                <div class="text-h5">{{ activeChat.title }}</div>
                <div class="text-body2 text-grey-4">
                  {{ activeChat.summary || 'Waiting for a private status DM from the OpenClaw chat identity.' }}
                </div>
              </div>

              <div class="col-12 col-md-auto">
                <div class="row q-gutter-sm">
                  <q-chip square dense color="grey-8" text-color="white">
                    {{ activeChat.npub }}
                  </q-chip>
                  <q-chip v-if="activeChat.repoFullName" square dense color="grey-8" text-color="white">
                    {{ activeChat.repoFullName }}
                  </q-chip>
                </div>

                <div class="row q-gutter-sm q-mt-sm">
                  <q-btn
                    v-if="activeChat.prUrl"
                    flat
                    no-caps
                    icon="call_split"
                    label="Open PR"
                    :href="activeChat.prUrl"
                    target="_blank"
                  />
                  <q-btn
                    v-if="activeChat.repoFullName"
                    flat
                    no-caps
                    icon="device_hub"
                    label="Repo graph"
                    @click="handleRepoGraph(activeChat.repoFullName, activeChat.prNumber)"
                  />
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>

        <div
          v-if="showCenteredSystemMessage"
          class="col column flex-center q-px-md q-pb-xl"
        >
          <div class="col-12 col-md-8 col-lg-6">
            <q-banner rounded :class="bannerClass">
              {{ centeredSystemMessage }}
            </q-banner>
          </div>
        </div>

        <q-scroll-area v-else class="col">
          <div class="q-px-md q-pb-lg">
            <div v-for="message in activeChat.messages" :key="message.id" class="q-mb-sm">
              <template v-if="message.direction !== 'system'">
                <q-chat-message
                  v-if="message.content"
                  :name="message.author === 'you' ? 'You' : 'OpenClaw'"
                  :text="[message.content]"
                  :sent="message.direction === 'outgoing'"
                  :stamp="formatTime(message.createdAt)"
                  :bg-color="message.direction === 'outgoing' ? 'white' : 'grey-9'"
                  :text-color="message.direction === 'outgoing' ? 'dark' : 'white'"
                />

                <div
                  v-if="message.imageUrl"
                  class="row q-mt-sm"
                  :class="message.direction === 'outgoing' ? 'justify-end' : 'justify-start'"
                >
                  <q-card flat bordered :class="`${panelClass} col-12 col-sm-8 col-md-6`">
                    <q-img :src="message.imageUrl" :alt="message.imageName || 'Chat image'" spinner-color="white" />
                    <q-card-section v-if="message.imageName" class="text-caption text-grey-5 q-py-sm">
                      {{ message.imageName }}
                    </q-card-section>
                  </q-card>
                </div>
              </template>

              <q-banner
                v-else
                rounded
                inline-actions
                :class="bannerClass"
              >
                {{ message.content }}
              </q-banner>
            </div>
          </div>
        </q-scroll-area>
      </div>

      <div v-else class="absolute-full column flex-center q-px-md">
        <div class="full-width">
          <div class="row justify-center">
            <div class="col-12 col-md-10 col-lg-8 text-center">
            </div>
          </div>

          <div class="row justify-center">
            <div class="col-12 col-md-9 col-lg-7">
              <input
                ref="imageInputRef"
                class="hidden"
                type="file"
                accept="image/*"
                @change="handleImageSelected"
              />

              <q-banner v-if="selectedImage" rounded :class="`${bannerClass} q-mb-sm`">
                <div class="row items-center q-col-gutter-md">
                  <div class="col-auto">
                    <q-avatar square rounded size="56px">
                      <img :src="selectedImage.dataUrl" alt="Selected attachment preview" />
                    </q-avatar>
                  </div>
                  <div class="col">
                    <div class="text-body2">{{ selectedImage.name }}</div>
                    <div class="text-caption text-grey-5">Image attached and ready to send</div>
                  </div>
                  <div class="col-auto">
                    <q-btn flat round icon="close" @click="clearSelectedImage" />
                  </div>
                </div>
              </q-banner>

                              <q-input
                  v-model="composer"
                  :dark="$q.dark.isActive"
                  outlined
                  rounded
                  autogrow
                  :class="composerInputClass"
                  input-class="text-subtitle1"
                  placeholder="Build anything"
                  @keyup.enter.exact.prevent="handleSend"
                >
                  <template #prepend>
                    <q-btn flat round dense icon="add" @click="openImagePicker" />
                  </template>

                  <template #append>
                    <q-btn
                      flat
                      round
                      dense
                      icon="send"
                      :loading="state.sending"
                      @click="handleSend"
                    />
                  </template>
                </q-input>
            </div>
          </div>
        </div>
      </div>

      <div v-if="activeChat" class="q-pa-md">
        <div class="row justify-center">
          <div class="col-12 col-md-9 col-lg-7">
            <input
              ref="imageInputRef"
              class="hidden"
              type="file"
              accept="image/*"
              @change="handleImageSelected"
            />

              <q-banner v-if="selectedImage" rounded :class="`${bannerClass} q-mb-sm`">
              <div class="row items-center q-col-gutter-md">
                <div class="col-auto">
                  <q-avatar square rounded size="56px">
                    <img :src="selectedImage.dataUrl" alt="Selected attachment preview" />
                  </q-avatar>
                </div>
                <div class="col">
                  <div class="text-body2">{{ selectedImage.name }}</div>
                  <div class="text-caption text-grey-5">Image attached and ready to send</div>
                </div>
                <div class="col-auto">
                  <q-btn flat round icon="close" @click="clearSelectedImage" />
                </div>
              </div>
            </q-banner>

                          <q-input
                v-model="composer"
                :dark="$q.dark.isActive"
                outlined
                rounded
                autogrow
                :class="composerInputClass"
                input-class="text-subtitle1"
                placeholder="Build anything"
                @keyup.enter.exact.prevent="handleSend"
              >
                <template #prepend>
                  <q-btn flat round dense icon="add" @click="openImagePicker" />
                </template>

                <template #append>
                  <q-btn
                    flat
                    round
                    dense
                    icon="send"
                    :loading="state.sending"
                    @click="handleSend"
                  />
                </template>
              </q-input>
          </div>
        </div>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Notify, useQuasar } from 'quasar'
import { useSonofClient } from 'src/composables/useSonofClient'

const $q = useQuasar()
const { activeChat, loadRepoGraph, sendMessageToActiveChat, state } = useSonofClient()

const composer = ref('')
const imageInputRef = ref(null)
const selectedImage = ref(null)
const pageClass = computed(() =>
  `${$q.dark.isActive ? 'bg-dark text-white' : 'bg-grey-2 text-dark'} fit relative-position`,
)
const panelClass = computed(() =>
  $q.dark.isActive ? 'bg-grey-10 text-white' : 'bg-white text-dark',
)
const bannerClass = computed(() =>
  $q.dark.isActive ? 'bg-grey-9 text-grey-3' : 'bg-grey-2 text-dark',
)
const composerInputClass = computed(() =>
  `${$q.dark.isActive ? 'text-white' : 'text-dark'} q-px-sm`,
)
const centeredSystemMessage = computed(() => {
  const messages = activeChat.value?.messages || []

  return messages.length === 1 && messages[0].direction === 'system' ? messages[0].content : ''
})
const showCenteredSystemMessage = computed(() => Boolean(centeredSystemMessage.value))

function toast(message, type = 'positive') {
  Notify.create({
    message,
    color: type,
    textColor: type === 'warning' ? 'dark' : 'white',
    position: 'top',
  })
}

function formatTime(value) {
  return new Date(value).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function openImagePicker() {
  imageInputRef.value?.click()
}

function clearSelectedImage() {
  selectedImage.value = null

  if (imageInputRef.value) {
    imageInputRef.value.value = ''
  }
}

function handleImageSelected(event) {
  const [file] = event.target.files || []

  if (!file) {
    return
  }

  if (!file.type.startsWith('image/')) {
    toast('Choose an image file', 'negative')
    clearSelectedImage()
    return
  }

  if (file.size > 1024 * 1024 * 1.5) {
    toast('Keep images under 1.5 MB for encrypted DM payloads', 'negative')
    clearSelectedImage()
    return
  }

  const reader = new FileReader()

  reader.onload = () => {
    selectedImage.value = {
      name: file.name,
      mimeType: file.type,
      dataUrl: String(reader.result || ''),
    }
  }
  reader.onerror = () => {
    toast('Unable to read image file', 'negative')
    clearSelectedImage()
  }
  reader.readAsDataURL(file)
}

async function handleSend() {
  try {
    await sendMessageToActiveChat(composer.value, selectedImage.value)
    composer.value = ''
    clearSelectedImage()
  } catch (error) {
    toast(error instanceof Error ? error.message : 'Failed to send message', 'negative')
  }
}

async function handleRepoGraph(repoFullName, prNumber) {
  try {
    await loadRepoGraph(repoFullName, prNumber)
    window.dispatchEvent(new CustomEvent('sonof-open-repo-graph'))
  } catch (error) {
    toast(error instanceof Error ? error.message : 'Failed to load repo graph', 'negative')
  }
}
</script>
