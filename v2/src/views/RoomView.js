import { ref, computed, watch } from 'vue';
import { room, openRoom, people, myMember, isHost, createMeetup, renameRoom, session, say, explain } from '../store.js';
import EditableTitle from '../components/EditableTitle.js';
import { chipStyle } from '../lib/palette.js';
import { prettyCode } from '../lib/codes.js';
import { parseKey, MSHORT, WD_LONG } from '../../../src/lib/dates.js';

export default {
  name: 'RoomView',
  components: { EditableTitle },
  props: { roomId: String },
  setup(props) {
    watch(() => props.roomId, (id) => openRoom(id), { immediate: true });

    const open = computed(() => room.meetups.filter((m) => m.status === 'open'));
    const done = computed(() => room.meetups.filter((m) => m.status === 'done'));
    const latestDone = computed(() => done.value[0] || null);

    const title = ref('');
    const creating = ref(false);
    async function newMeetup() {
      const t = title.value.trim();
      if (!t) return;
      creating.value = true;
      try { const id = await createMeetup(t.slice(0, 60)); title.value = ''; location.hash = '#m-' + props.roomId + '-' + id; }
      catch (e) { say(explain(e), 'error'); }
      creating.value = false;
    }

    // The gang: everyone who is not a guest of a single meetup.
    const gang = computed(() => people.value.filter((p) => !p.meetId));

    async function rename(name) {
      try { await renameRoom(name); say('เปลี่ยนชื่อแก๊งแล้ว'); } catch (e) { say(explain(e), 'error'); }
    }

    const dayOf = (k) => { if (!k) return null; const d = parseKey(k); return { d: d.getDate(), m: MSHORT[d.getMonth()], w: WD_LONG[d.getDay()] }; };
    const inviteText = computed(() => room.data
      ? 'มานัดกันใน "ว่างไหม" ห้อง ' + room.data.name + '\nเข้าด้วย Google แล้วใส่รหัสห้อง ' + prettyCode(room.data.joinCode) + '\n' + location.origin + location.pathname
      : '');
    async function copyInvite() {
      try { await navigator.clipboard.writeText(inviteText.value); say('คัดลอกแล้ว ส่งในแชทได้เลย'); }
      catch { say('คัดลอกไม่ได้ กดค้างที่รหัสห้องเพื่อคัดลอกเอง', 'error'); }
    }

    return {
      rename, room, people, gang, myMember, isHost, session, open, done, latestDone, title, creating, newMeetup, dayOf, chipStyle, prettyCode, copyInvite,
    };
  },
  template: /* html */ `
  <section class="stack" style="gap: 18px">
    <p v-if="room.error" class="sheet err">{{ room.error }}</p>
    <p v-else-if="room.loaded && !room.data" class="sheet">ไม่พบห้องนี้ หรือคุณไม่ได้อยู่ในห้องนี้แล้ว <a href="#">กลับหน้าแรก</a></p>

    <template v-if="room.data">
      <header class="row between" style="align-items: flex-end">
        <div class="grow">
          <p class="small muted" style="margin: 0">ห้อง</p>
          <EditableTitle :value="room.data.name" :can-edit="isHost" :max="40" label="ชื่อแก๊ง" size="32px" @save="rename" />
        </div>
        <a :href="'#members-' + room.data.id" class="chips" :aria-label="'แก๊ง ' + gang.length + ' คน'" style="text-decoration: none">
          <span v-for="p in gang" :key="p.pid" class="chip" :class="{ me: myMember && p.pid === myMember.pid }" :style="chipStyle(p.color)">{{ p.name.charAt(0) }}</span>
        </a>
      </header>

      <!-- latest concluded meetup as a gold ticket -->
      <a v-if="latestDone && latestDone.result" :href="'#m-' + room.data.id + '-' + latestDone.id" class="ticket" style="text-decoration: none; display: grid; grid-template-columns: 84px minmax(0, 1fr); background: var(--gold-soft); border: 2px solid var(--gold); border-radius: 16px; overflow: hidden">
        <span v-if="dayOf(latestDone.result.date)" style="background: var(--gold); color: var(--ink-fixed); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 12px 0 12px 10px">
          <span class="small" style="font-weight: 600">{{ dayOf(latestDone.result.date).m }}</span>
          <span class="display" style="font-size: 32px; line-height: 1">{{ dayOf(latestDone.result.date).d }}</span>
          <span class="small">{{ dayOf(latestDone.result.date).w }}</span>
        </span>
        <span v-else></span>
        <span style="padding: 12px 22px 12px 14px; border-left: 2px dashed var(--gold); display: flex; flex-direction: column; gap: 2px">
          <span class="small gold-ink" style="font-weight: 600">สรุปนัดแล้ว: {{ latestDone.title }}</span>
          <span style="font-weight: 600; font-size: 17px">{{ latestDone.result.placeTitle || 'ยังไม่ได้เลือกที่' }}</span>
        </span>
      </a>

      <section class="stack">
        <div class="row between">
          <h2>นัดที่กำลังหาวัน</h2>
        </div>
        <div class="list">
          <a v-for="m in open" :key="m.id" class="item" :href="'#m-' + room.data.id + '-' + m.id">
            <span class="grow"><b>{{ m.title }}</b></span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M9 6l6 6-6 6"></path></svg>
          </a>
          <p class="muted small" v-if="!open.length">ยังไม่มีนัดที่เปิดอยู่<span v-if="!isHost"> รอเจ้าของห้องสร้างนัด</span></p>
        </div>
        <form v-if="isHost" class="row" @submit.prevent="newMeetup">
          <label for="mtitle" class="small" style="position:absolute;left:-9999px">ชื่อนัดใหม่</label>
          <input id="mtitle" class="input grow" v-model="title" maxlength="60" placeholder="นัดใหม่ เช่น ข้าวเย็นปลายปี">
          <button class="btn primary" type="submit" :disabled="creating || !title.trim()">สร้างนัด</button>
        </form>
      </section>

      <section class="ink-band row between">
        <div class="grow">
          <div class="small muted">ชวนเพื่อนที่มี Google: รหัสห้อง</div>
          <div class="code-pill" style="font-size: 22px">{{ prettyCode(room.data.joinCode) }}</div>
        </div>
        <button class="btn sm" style="background: transparent; color: inherit; border-color: var(--on-ink-2)" @click="copyInvite">คัดลอกคำชวน</button>
      </section>

      <section class="stack" v-if="done.length">
        <h2>เคยไปกันแล้ว</h2>
        <div class="list">
          <a v-for="m in done" :key="m.id" class="item" :href="'#m-' + room.data.id + '-' + m.id" style="border: 0; border-bottom: 1px solid var(--line); border-radius: 0; background: transparent; padding: 10px 4px">
            <span class="display small muted" style="width: 64px; flex: none" v-if="m.result && dayOf(m.result.date)">{{ dayOf(m.result.date).d }} {{ dayOf(m.result.date).m }}</span>
            <span class="grow"><b>{{ m.title }}</b><br><span class="small muted">{{ (m.result && m.result.placeTitle) || '' }}</span></span>
          </a>
        </div>
      </section>
    </template>
  </section>`,
};
