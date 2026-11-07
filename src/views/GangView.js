import { ref, computed, watch } from 'vue';
import { room, openRoom, people, myMember, isHost, inGang, renameRoom, personByPid, say, explain } from '../store.js';
import { chipStyle } from '../lib/palette.js';
import { fmtShort } from '../lib/dates.js';
import EditableTitle from '../components/EditableTitle.js';
import AskSheet from '../components/AskSheet.js';

export default {
  name: 'GangView',
  components: { EditableTitle, AskSheet },
  props: { roomId: String },
  setup(props) {
    watch(() => props.roomId, (id) => openRoom(id), { immediate: true });
    const asking = ref(false);
    const gang = computed(() => people.value.filter((p) => !p.meetId));
    const open = computed(() => room.meetups.filter((m) => m.status === 'open'));
    const done = computed(() => room.meetups.filter((m) => m.status !== 'open'));
    const guestsOf = (id) => people.value.filter((p) => p.meetId === id).length;
    const creatorName = (m) => (personByPid.value.get(m.createdBy) || {}).name || '';
    const summary = (m) => {
      const r = m.result || {};
      return [r.date ? '📅 ' + fmtShort(r.date) : '', r.placeTitle ? '📍 ' + r.placeTitle : ''].filter(Boolean).join(' · ');
    };
    async function rename(name) {
      try { await renameRoom(name); say('เปลี่ยนชื่อแก๊งแล้ว'); } catch (e) { say(explain(e), 'error'); }
    }
    return { room, myMember, isHost, inGang, gang, open, done, guestsOf, creatorName, summary, asking, rename, chipStyle };
  },
  template: /* html */ `
  <section class="stack" style="gap: 16px">
    <a href="#" class="small muted row" style="text-decoration: none; gap: 4px">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"></path></svg>
      หน้าแรก
    </a>
    <p v-if="room.error" class="sheet">{{ room.error }} <a href="#">กลับหน้าแรก</a></p>
    <p v-else-if="room.loaded && !room.data" class="sheet">ไม่พบแก๊งนี้ อาจถูกลบไปแล้ว <a href="#">กลับหน้าแรก</a></p>

    <template v-if="room.data && myMember">
      <header class="stack" style="gap: 10px">
        <EditableTitle :value="room.data.name" :can-edit="isHost" :max="40" label="ชื่อแก๊ง" size="32px" @save="rename" />
        <div class="row between">
          <span class="chips" :aria-label="'แก๊ง ' + gang.length + ' คน'">
            <span v-for="p in gang" :key="p.pid" class="chip lg" :class="{ me: p.pid === myMember.pid }" :style="chipStyle(p.color)" :title="p.name">{{ p.name.charAt(0) }}</span>
          </span>
          <a v-if="inGang" :href="'#manage-' + room.id" class="btn sm">จัดการแก๊ง</a>
        </div>
        <p v-if="!inGang" class="small muted" style="margin: 0">คุณเป็นแขก เห็นแค่นัดที่ถูกชวนมา</p>
      </header>

      <button v-if="inGang" class="btn primary display" style="min-height: 56px; font-size: 20px; border-radius: 16px" @click="asking = true">ถามว่าว่างไหม?</button>

      <section class="sheet" style="padding: 0; gap: 0; overflow: hidden">
        <h2 style="padding: 14px 16px 6px; font-size: 16px">นัดที่เปิดอยู่</h2>
        <a v-for="m in open" :key="m.id" class="row" :href="'#m-' + room.id + '-' + m.id" style="text-decoration: none; color: inherit; padding: 12px 16px; border-top: 1px solid var(--line); flex-wrap: nowrap">
          <span class="grow"><b>{{ m.title }}</b><br>
            <span class="small muted">{{ summary(m) || 'ยังไม่ได้สรุป' }}<template v-if="guestsOf(m.id)"> · แขก {{ guestsOf(m.id) }}</template></span></span>
          <span v-if="creatorName(m)" class="tag">{{ creatorName(m) }}</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" class="muted" style="flex: none"><path d="M9 6l6 6-6 6"></path></svg>
        </a>
        <p v-if="!open.length" class="small muted" style="margin: 0; padding: 4px 16px 14px">ยังไม่มีนัดที่เปิดอยู่<template v-if="inGang"> กด "ถามว่าว่างไหม?" เพื่อเริ่มนัดใหม่</template></p>
      </section>

      <section v-if="done.length" class="sheet" style="padding: 0; gap: 0; overflow: hidden">
        <h2 style="padding: 14px 16px 6px; font-size: 16px">ประวัติ</h2>
        <a v-for="m in done" :key="m.id" class="row" :href="'#m-' + room.id + '-' + m.id" style="text-decoration: none; color: inherit; padding: 12px 16px; border-top: 1px solid var(--line); flex-wrap: nowrap">
          <span class="grow"><b>{{ m.title }}</b><br><span class="small muted">ปิดแล้ว<template v-if="summary(m)"> · {{ summary(m) }}</template></span></span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" class="muted" style="flex: none"><path d="M9 6l6 6-6 6"></path></svg>
        </a>
      </section>
    </template>

    <AskSheet v-if="asking" :gangs="[{ id: room.id, name: room.data.name }]" :preset="room.id" @close="asking = false" />
  </section>`,
};
