import { ref, reactive, computed, watch } from 'vue';
import {
  room, meetup, openMeetup, canRun, isOpen, saveState, meetPeople, meetRoster, myMember, askedMeetup, personByPid,
  closeMeetup, reopenMeetup, deleteMeetup, setHidden, renameMeetup, say, explain,
} from '../store.js';
import { fmtLong } from '../lib/dates.js';
import { chipStyle } from '../lib/palette.js';
import CalendarPanel from '../components/CalendarPanel.js';
import PlacesPanel from '../components/PlacesPanel.js';
import DrawPanel from '../components/DrawPanel.js';
import EditableTitle from '../components/EditableTitle.js';
import SendSheet from '../components/SendSheet.js';
import DecideSheet from '../components/DecideSheet.js';

export default {
  name: 'MeetupView',
  components: { CalendarPanel, PlacesPanel, DrawPanel, EditableTitle, SendSheet, DecideSheet },
  props: { roomId: String, meetId: String },
  setup(props) {
    watch(() => [props.roomId, props.meetId], ([r, m]) => openMeetup(r, m), { immediate: true });
    const tab = ref('dates');

    // Fresh from "ถามว่าว่างไหม?": open "ส่งให้เพื่อน" straight away.
    const sending = ref(false);
    watch(() => meetup.data, (d) => { if (d && askedMeetup.value === props.meetId) { askedMeetup.value = ''; sending.value = true; } }, { immediate: true });

    // ----- decisions -----
    const result = computed(() => (meetup.data && meetup.data.result) || {});
    const deciding = reactive({ kind: '', preset: '' });
    function decide(kind, preset = '') { deciding.kind = kind; deciding.preset = preset; }
    const dayLabel = computed(() => (result.value.date ? fmtLong(result.value.date) : ''));

    // ----- close / reopen / delete -----
    const confirmKey = ref('');
    async function close() {
      if (!result.value.date && !result.value.placeId && confirmKey.value !== 'close') { confirmKey.value = 'close'; return; }
      confirmKey.value = '';
      try { await closeMeetup(); say('ปิดนัดแล้ว'); } catch (e) { say(explain(e), 'error'); }
    }
    async function reopen() {
      try { await reopenMeetup(); say('เปิดนัดอีกครั้งแล้ว'); } catch (e) { say(explain(e), 'error'); }
    }
    async function remove() {
      if (confirmKey.value !== 'delete') { confirmKey.value = 'delete'; return; }
      try { await deleteMeetup(); location.hash = '#r-' + props.roomId; say('ลบนัดแล้ว'); } catch (e) { say(explain(e), 'error'); }
    }

    // ----- who is in this meetup -----
    const hiddenPids = computed(() => new Set(meetup.avail.filter((a) => a.hidden).map((a) => a.pid)));
    async function toggleHidden(p) {
      try { await setHidden(p.pid, !hiddenPids.value.has(p.pid)); } catch (e) { say(explain(e), 'error'); }
    }
    const guests = computed(() => meetRoster.value.filter((p) => p.meetId).length);
    const creator = computed(() => meetup.data && personByPid.value.get(meetup.data.createdBy));
    const entered = computed(() => meetPeople.value.filter((p) => meetup.avail.some((a) => a.pid === p.pid && a.dates)).length);

    async function rename(title) {
      try { await renameMeetup(title); say('เปลี่ยนชื่อนัดแล้ว'); } catch (e) { say(explain(e), 'error'); }
    }

    return {
      room, meetup, canRun, isOpen, saveState, tab, sending, result, deciding, decide, dayLabel, confirmKey, close, reopen, remove,
      meetPeople, meetRoster, myMember, hiddenPids, toggleHidden, guests, creator, entered, chipStyle, rename,
    };
  },
  template: /* html */ `
  <section class="stack" style="gap: 14px">
    <a v-if="room.data" :href="'#r-' + room.id" class="small muted row" style="text-decoration: none; gap: 4px">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"></path></svg>
      {{ room.data.name }}
    </a>
    <p v-if="meetup.loaded && !meetup.data" class="sheet">ไม่พบนัดนี้ <a :href="'#r-' + roomId">กลับไปที่แก๊ง</a></p>

    <template v-if="meetup.data">
      <header class="row between" style="align-items: flex-start">
        <div class="grow">
          <EditableTitle :value="meetup.data.title" :can-edit="canRun" :max="60" label="ชื่อนัด" @save="rename" />
          <p class="muted small" style="margin: 2px 0 0">
            <template v-if="isOpen">ลงวันว่างแล้ว {{ entered }} จาก {{ meetPeople.length }} คน</template>
            <template v-else>ปิดนัดแล้ว</template>
            <span v-if="saveState"> ({{ saveState }})</span>
          </p>
        </div>
        <button v-if="isOpen && myMember" class="btn sm" @click="sending = true">ชวนเพิ่ม</button>
      </header>

      <!-- สรุปนัด: day and place, decided separately -->
      <section class="gold-card stack" :class="{ ticket: !isOpen }" style="gap: 8px; padding: 12px 16px; align-items: stretch" aria-label="สรุปนัด">
        <div class="row between small gold-ink"><b>{{ isOpen ? 'สรุปนัด' : 'นัดแล้ว' }}</b></div>
        <div class="row between">
          <span class="row" style="font-size: 16px"><span aria-hidden="true">📅</span>
            <b v-if="result.date">{{ dayLabel }}</b><span v-else class="muted">ยังไม่ได้เลือกวัน</span></span>
          <button v-if="canRun && isOpen" class="btn sm ghost" @click="decide('date')">{{ result.date ? 'แก้' : 'สรุปวัน' }}</button>
        </div>
        <div class="row between">
          <span class="row" style="font-size: 16px; min-width: 0"><span aria-hidden="true">📍</span>
            <template v-if="result.placeId || result.placeTitle">
              <b>{{ result.placeTitle }}</b>
              <a v-if="result.placeUrl" :href="result.placeUrl" target="_blank" rel="noopener noreferrer" class="small">แผนที่</a>
            </template>
            <span v-else class="muted">ยังไม่ได้เลือกสถานที่</span></span>
          <button v-if="canRun && isOpen" class="btn sm ghost" @click="decide('place')">{{ result.placeId ? 'แก้' : 'สรุปสถานที่' }}</button>
        </div>
      </section>

      <details class="sheet" style="padding: 0">
        <summary class="row between" style="padding: 12px 16px; cursor: pointer; list-style: none">
          <span><b>ใครอยู่ในนัดนี้</b> <span class="small muted">{{ meetRoster.length }} คน<template v-if="guests"> · แขก {{ guests }}</template></span></span>
          <span class="chips"><span v-for="p in meetRoster" :key="p.pid" class="chip" :class="{ me: myMember && p.pid === myMember.pid }" :style="chipStyle(p.color)" :aria-label="p.name">{{ p.name.charAt(0) }}</span></span>
        </summary>
        <div class="stack" style="padding: 0 16px 14px">
          <ul style="list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px">
            <li v-for="p in meetRoster" :key="p.pid" class="row between">
              <span class="row" :style="hiddenPids.has(p.pid) ? 'opacity: .45' : ''">
                <span class="chip" :style="chipStyle(p.color)">{{ p.name.charAt(0) }}</span>
                <span :style="hiddenPids.has(p.pid) ? 'text-decoration: line-through' : ''">{{ p.name }}</span>
                <span v-if="p.meetId" class="tag">แขก</span>
                <span v-if="hiddenPids.has(p.pid)" class="tag">ไม่ไป</span>
              </span>
              <button v-if="canRun && isOpen" class="btn sm ghost" @click="toggleHidden(p)">
                {{ hiddenPids.has(p.pid) ? 'ไปด้วย' : 'ไม่ไปรอบนี้' }}
              </button>
            </li>
          </ul>
          <p class="small muted" style="margin: 0" v-if="creator">ผู้สร้างนัด: {{ creator.name }}</p>
          <p class="small muted" style="margin: 0" v-if="canRun">"ไม่ไปรอบนี้": ไม่นับวันว่างและโหวตของคนนั้น สถานที่ที่เขาเสนอยังอยู่ให้โหวตได้</p>
        </div>
      </details>

      <div class="tabs">
        <div class="seg" role="tablist" aria-label="ส่วนของนัด">
          <button type="button" role="tab" :aria-selected="tab === 'dates'" @click="tab = 'dates'">วันว่าง</button>
          <button type="button" role="tab" :aria-selected="tab === 'places'" @click="tab = 'places'">สถานที่</button>
          <button type="button" role="tab" :aria-selected="tab === 'draw'" @click="tab = 'draw'">สุ่ม</button>
        </div>
      </div>

      <CalendarPanel v-if="tab === 'dates'" />
      <PlacesPanel v-else-if="tab === 'places'" />
      <DrawPanel v-else @decide="(d) => decide(d.kind, d.value)" />

      <div v-if="canRun" class="row" style="justify-content: flex-end; padding-top: 8px">
        <button class="btn sm ghost danger" @click="remove">{{ confirmKey === 'delete' ? 'กดอีกครั้ง: ลบนัดถาวร' : 'ลบนัด' }}</button>
        <button v-if="isOpen" class="btn" @click="close">{{ confirmKey === 'close' ? 'ยังไม่ได้สรุปอะไรเลย กดอีกครั้งเพื่อปิด' : 'ปิดนัด' }}</button>
        <button v-else class="btn" @click="reopen">เปิดนัดอีกครั้ง</button>
      </div>
    </template>

    <SendSheet v-if="sending" @close="sending = false" />
    <DecideSheet v-if="deciding.kind" :kind="deciding.kind" :preset="deciding.preset" @close="deciding.kind = ''" />
  </section>`,
};
