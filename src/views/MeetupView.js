import { ref, reactive, computed, watch } from 'vue';
import {
  room, meetup, openMeetup, canRun, isOpen, saveState, meetPeople, meetRoster, myMember, askedMeetup, personByPid,
  closeMeetup, reopenMeetup, deleteMeetup, setHidden, setMyGoing, renameMeetup, say, explain,
} from '../store.js';
import { fmtShort, parseKey, MSHORT, WD_LONG } from '../lib/dates.js';
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
    const dayLabel = computed(() => {
      if (!result.value.date) return '';
      return WD_LONG[parseKey(result.value.date).getDay()] + ' ' + fmtShort(result.value.date);
    });
    const stub = computed(() => {
      if (!result.value.date) return null;
      const d = parseKey(result.value.date);
      return { m: MSHORT[d.getMonth()], d: d.getDate(), wd: WD_LONG[d.getDay()] };
    });

    // ----- tab bar counts -----
    const drawsLeft = computed(() => {
      const c = (meetup.data && meetup.data.drawCount) || {};
      return Math.max(0, 3 - (c.date || 0)) + Math.max(0, 3 - (c.place || 0));
    });

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
      const going = hiddenPids.value.has(p.pid);
      try {
        if (myMember.value && p.pid === myMember.value.pid) await setMyGoing(going);
        else await setHidden(p.pid, !going);
      } catch (e) { say(explain(e), 'error'); }
    }
    const notGoing = computed(() => !!myMember.value && hiddenPids.value.has(myMember.value.pid));
    const guests = computed(() => meetRoster.value.filter((p) => p.meetId).length);
    const creator = computed(() => meetup.data && personByPid.value.get(meetup.data.createdBy));
    const entered = computed(() => meetPeople.value.filter((p) => meetup.avail.some((a) => a.pid === p.pid && a.dates)).length);

    async function rename(title) {
      try { await renameMeetup(title); say('เปลี่ยนชื่อนัดแล้ว'); } catch (e) { say(explain(e), 'error'); }
    }

    return {
      room, meetup, canRun, isOpen, saveState, tab, sending, result, deciding, decide, dayLabel, confirmKey, close, reopen, remove,
      meetPeople, meetRoster, myMember, hiddenPids, toggleHidden, notGoing, stub, drawsLeft, guests, creator, entered, chipStyle, rename,
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

      <div v-if="isOpen && notGoing" class="sheet outlined row between" style="flex-direction: row; align-items: center">
        <span class="grow">คุณอยู่ในสถานะ <b>ไม่ไปรอบนี้</b> วันว่างและโหวตของคุณยังไม่ถูกนับ</span>
        <button class="btn sm primary" @click="toggleHidden(myMember)">ไปด้วย</button>
      </div>

      <!-- สรุปนัด: a quiet line while finding a day; a gold ticket once the meetup is done. -->
      <section v-if="isOpen" class="summary-bar" aria-label="สรุปนัด">
        <component :is="canRun ? 'button' : 'span'" class="sum-item" :type="canRun ? 'button' : null" @click="canRun && decide('date')">
          <span class="ic" aria-hidden="true">📅</span>
          <b v-if="result.date">{{ dayLabel }}</b><span v-else class="muted">ยังไม่ได้เลือกวัน</span>
        </component>
        <span class="sum-sep" aria-hidden="true"></span>
        <component :is="canRun ? 'button' : 'span'" class="sum-item" :type="canRun ? 'button' : null" @click="canRun && decide('place')">
          <span class="ic" aria-hidden="true">📍</span>
          <b v-if="result.placeTitle">{{ result.placeTitle }}</b><span v-else class="muted">ยังไม่ได้เลือกสถานที่</span>
        </component>
        <span v-if="canRun" class="small muted sum-hint" style="margin-left: auto">แตะเพื่อสรุป</span>
      </section>
      <section v-else class="done-ticket ticket" aria-label="นัดสำเร็จ">
        <div class="stub">
          <template v-if="stub"><span class="small" style="font-weight: 600">{{ stub.m }}</span><b>{{ stub.d }}</b><span class="small">{{ stub.wd }}</span></template>
          <b v-else aria-label="ไม่ได้ระบุวัน">–</b>
        </div>
        <div class="body">
          <span class="small gold-ink" style="font-weight: 600">นัดสำเร็จ 🎉</span>
          <b style="font-size: 17px; overflow-wrap: anywhere">{{ result.placeTitle || 'ยังไม่ได้เลือกสถานที่' }}</b>
          <span class="small muted">ไป {{ meetPeople.length }} คน<template v-if="result.placeUrl"> · <a :href="result.placeUrl" target="_blank" rel="noopener noreferrer">แผนที่</a></template></span>
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
              <button v-if="isOpen && (canRun || (myMember && p.pid === myMember.pid))" class="btn sm ghost" @click="toggleHidden(p)">
                {{ hiddenPids.has(p.pid) ? 'ไปด้วย' : 'ไม่ไปรอบนี้' }}
              </button>
            </li>
          </ul>
          <p class="small muted" style="margin: 0" v-if="creator">ผู้สร้างนัด: {{ creator.name }}</p>
          <p class="small muted" style="margin: 0">"ไม่ไปรอบนี้": ไม่นับวันว่างและโหวตของคนนั้น สถานที่ที่เขาเสนอยังอยู่ให้โหวตได้ เจ้าตัวกด "ไปด้วย" เองได้ถ้าเปลี่ยนใจ</p>
        </div>
      </details>

      <nav class="tabbar" role="tablist" aria-label="ส่วนของนัด">
        <button type="button" role="tab" :aria-selected="tab === 'dates'" @click="tab = 'dates'">
          <b><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2"></rect><path d="M4 10h16M9 3v4M15 3v4"></path></svg>วันว่าง</b>
          <small>ลงแล้ว {{ entered }}/{{ meetPeople.length }}</small>
        </button>
        <button type="button" role="tab" :aria-selected="tab === 'places'" @click="tab = 'places'">
          <b><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z"></path><circle cx="12" cy="10" r="2.2"></circle></svg>สถานที่</b>
          <small>{{ meetup.places.length }} ที่</small>
        </button>
        <button type="button" role="tab" :aria-selected="tab === 'draw'" @click="tab = 'draw'">
          <b><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"></rect><circle cx="9" cy="9" r="1.2" fill="currentColor"></circle><circle cx="15" cy="15" r="1.2" fill="currentColor"></circle><circle cx="15" cy="9" r="1.2" fill="currentColor"></circle><circle cx="9" cy="15" r="1.2" fill="currentColor"></circle></svg>สุ่ม</b>
          <small>{{ drawsLeft ? 'เหลือ ' + drawsLeft + ' ครั้ง' : 'สุ่มครบแล้ว' }}</small>
        </button>
      </nav>

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
